from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from dotenv import load_dotenv
from pathlib import Path
import anthropic
import os
import sys

load_dotenv(Path(__file__).parent.parent.parent / ".env")

sys.path.append(str(Path(__file__).parent.parent.parent))
from api.database import get_db, open_conn, USE_SQLITE
from scripts.context_builder import get_context
from api.routes.auth import verifiera_token

# Haiku 5.5: ~10x billigare än Haiku 4.5 (legacy). Byt utan kodändring via COACH_MODELL.
COACH_MODELL = os.environ.get("COACH_MODELL", "claude-haiku-5-5")

router = APIRouter()

ph = "?" if USE_SQLITE else "%s"
MAX_HISTORIK = 30          # senaste meddelandena i samtalet som skickas till modellen
MAX_MEDDELANDE = 4000      # tecken per meddelande från atleten


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MEDDELANDE)
    samtal_id: int

    @field_validator("message")
    @classmethod
    def inte_tomt(cls, v):
        if not v.strip():
            raise ValueError("tomt meddelande")
        return v.strip()


class NyttSamtal(BaseModel):
    titel: Optional[str] = Field(default=None, max_length=200)


def kort_titel(text: str, max_len: int = 60) -> str:
    text = " ".join((text or "").split())
    if len(text) <= max_len:
        return text or "Nytt samtal"
    return text[:max_len].rsplit(" ", 1)[0] + "…"


def _värde(rad, nyckel, index):
    return rad[nyckel] if not isinstance(rad, tuple) else rad[index]


def äger_samtal(c, samtal_id, user_id):
    c.execute(f"SELECT id FROM samtal WHERE id = {ph} AND user_id = {ph}", (samtal_id, user_id))
    if not c.fetchone():
        raise HTTPException(status_code=404, detail="Samtalet hittades inte")


def bygg_historik(rader):
    """Meddelanden i ordning → API-format. Slår ihop följande meddelanden med samma roll
    (t.ex. om ett svar avbröts) och ser till att historiken börjar med användaren."""
    ut = []
    for roll, innehåll in rader:
        if ut and ut[-1]["role"] == roll:
            ut[-1]["content"] += "\n\n" + innehåll
        else:
            ut.append({"role": roll, "content": innehåll})
    while ut and ut[0]["role"] != "user":
        ut.pop(0)
    return ut

class SparaPassRequest(BaseModel):
    datum: str
    typ: str
    distans_km: float = None
    tempo: str = None
    pulszon: str = None
    syfte: str = None

def get_system_prompt() -> str:
    prompt_path = Path(__file__).parent.parent.parent / "coach" / "system_prompt.txt"
    with open(prompt_path) as f:
        return f.read()

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    token = authorization.split(" ")[1]
    return verifiera_token(token)

@router.post("/save-pass")
def save_pass(req: SparaPassRequest, db=Depends(get_db), user=Depends(get_current_user)):
    ph = "?" if USE_SQLITE else "%s"
    c = db.cursor()
    c.execute(f"""
        INSERT INTO planerade_pass (user_id, datum, typ, distans_km, tempo, pulszon, syfte)
        VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
    """, (user["user_id"], req.datum, req.typ, req.distans_km, req.tempo, req.pulszon, req.syfte))
    db.commit()
    return {"ok": True}

@router.post("/samtal")
def skapa_samtal(req: NyttSamtal, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"INSERT INTO samtal (user_id, titel) VALUES ({ph}, {ph}) RETURNING id",
              (user["user_id"], kort_titel(req.titel or "")))
    samtal_id = _värde(c.fetchone(), "id", 0)
    db.commit()
    return {"id": samtal_id}


@router.get("/samtal")
def lista_samtal(db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"""
        SELECT s.id, s.titel, s.uppdaterad, COUNT(m.id) AS antal
        FROM samtal s LEFT JOIN meddelanden m ON m.samtal_id = s.id
        WHERE s.user_id = {ph}
        GROUP BY s.id, s.titel, s.uppdaterad
        HAVING COUNT(m.id) > 0
        ORDER BY s.uppdaterad DESC LIMIT 50
    """, (user["user_id"],))
    ut = []
    for r in c.fetchall():
        d = dict(r)
        if hasattr(d["uppdaterad"], "isoformat"):
            d["uppdaterad"] = d["uppdaterad"].isoformat()
        ut.append(d)
    return ut


@router.get("/samtal/{samtal_id}")
def hämta_samtal(samtal_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    äger_samtal(c, samtal_id, user["user_id"])
    c.execute(f"SELECT roll, innehall FROM meddelanden WHERE samtal_id = {ph} ORDER BY id", (samtal_id,))
    return {"id": samtal_id, "meddelanden": [{"role": _värde(r, "roll", 0), "content": _värde(r, "innehall", 1)}
                                             for r in c.fetchall()]}


@router.delete("/samtal/{samtal_id}")
def ta_bort_samtal(samtal_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    äger_samtal(c, samtal_id, user["user_id"])
    c.execute(f"DELETE FROM meddelanden WHERE samtal_id = {ph}", (samtal_id,))
    c.execute(f"DELETE FROM samtal WHERE id = {ph} AND user_id = {ph}", (samtal_id, user["user_id"]))
    db.commit()
    return {"ok": True}


@router.post("/chat")
async def chat(request: ChatRequest, user=Depends(get_current_user)):
    user_id = user["user_id"]

    # Ägarkoll och historik innan något skickas till modellen. Egen anslutning eftersom
    # svaret strömmas — FastAPI:s get_db hinner stängas innan strömmen är klar.
    conn = open_conn()
    try:
        c = conn.cursor()
        äger_samtal(c, request.samtal_id, user_id)
        c.execute(f"SELECT roll, innehall FROM meddelanden WHERE samtal_id = {ph} ORDER BY id DESC LIMIT {MAX_HISTORIK}",
                  (request.samtal_id,))
        tidigare = [(_värde(r, "roll", 0), _värde(r, "innehall", 1)) for r in c.fetchall()][::-1]
        if not tidigare:
            c.execute(f"UPDATE samtal SET titel = {ph} WHERE id = {ph}", (kort_titel(request.message), request.samtal_id))
        c.execute(f"INSERT INTO meddelanden (samtal_id, roll, innehall) VALUES ({ph}, {ph}, {ph})",
                  (request.samtal_id, "user", request.message))
        c.execute(f"UPDATE samtal SET uppdaterad = CURRENT_TIMESTAMP WHERE id = {ph}", (request.samtal_id,))
        conn.commit()
    finally:
        conn.close()

    messages = bygg_historik(tidigare + [("user", request.message)])

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    träningskontext = get_context(veckor=12, user_id=user_id)
    system = get_system_prompt()
    system += f"\n\n== ANVÄNDARENS TRÄNINGSDATA ==\n{träningskontext}"

    def generate():
        svar = []
        try:
            with client.messages.stream(
                model=COACH_MODELL,
                max_tokens=10000,
                system=system,
                messages=messages
            ) as stream:
                for text in stream.text_stream:
                    svar.append(text)
                    yield text
        except Exception:
            yield "\n\n⚠️ Coachen kunde inte svara just nu. Försök igen om en stund."
            return
        finally:
            text = "".join(svar).strip()
            if text:
                spara = open_conn()
                try:
                    spara.cursor().execute(
                        f"INSERT INTO meddelanden (samtal_id, roll, innehall) VALUES ({ph}, {ph}, {ph})",
                        (request.samtal_id, "assistant", text))
                    spara.commit()
                finally:
                    spara.close()

    return StreamingResponse(generate(), media_type="text/plain")
