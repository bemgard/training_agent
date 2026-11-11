"""Feedback från streckgubben, tumme upp/ner på coachen och Calles inkorg (bara admin)."""
import json
from typing import Optional, Literal, Dict, Any
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"
MAX_PER_DYGN = 30
KONTEXT_FÄLT = {"flik", "enhet", "bredd", "version", "fraga"}


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    return verifiera_token(authorization.split(" ")[1])


def _v(r, k, i):
    return r[k] if not isinstance(r, tuple) else r[i]


def är_admin(c, user_id) -> bool:
    c.execute(f"SELECT admin FROM users WHERE id = {ph}", (user_id,))
    r = c.fetchone()
    return bool(r and _v(r, "admin", 0))


def kräv_admin(db=Depends(get_db), user=Depends(get_current_user)):
    if not är_admin(db.cursor(), user["user_id"]):
        raise HTTPException(status_code=403, detail="Bara för admin")
    return user


class NyFeedback(BaseModel):
    typ: Literal["fel", "ide", "gillar", "annat"]
    text: str = Field(min_length=1, max_length=2000)
    kontext: Dict[str, Any] = {}

    @field_validator("text")
    @classmethod
    def inte_tom(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("tom text")
        return v

    @field_validator("kontext")
    @classmethod
    def bara_kända_fält(cls, v):
        # Bara korta, kända fält — inget godtyckligt innehåll från klienten
        return {k: str(val)[:60] for k, val in v.items() if k in KONTEXT_FÄLT}


class Betyg(BaseModel):
    kalla: Literal["insikt", "chatt"]
    ref: str = Field(min_length=1, max_length=60)
    betyg: Literal[-1, 1]
    orsak: Optional[str] = Field(default=None, max_length=300)
    utdrag: Optional[str] = Field(default=None, max_length=300)


class AdminÄndring(BaseModel):
    status: Literal["ny", "planerad", "klar", "avvisad"]
    svar: Optional[str] = Field(default=None, max_length=500)


@router.post("/feedback")
def skicka_feedback(req: NyFeedback, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    tidsgräns = "datetime('now', '-1 day')" if USE_SQLITE else "now() - interval '1 day'"
    c.execute(f"SELECT COUNT(*) AS n FROM feedback WHERE user_id = {ph} AND skapad > {tidsgräns}", (user["user_id"],))
    if _v(c.fetchone(), "n", 0) >= MAX_PER_DYGN:
        raise HTTPException(status_code=429, detail="Tack! Du har skickat mycket idag — fortsätt gärna i morgon.")
    c.execute(f"INSERT INTO feedback (user_id, typ, text, kontext) VALUES ({ph}, {ph}, {ph}, {ph})",
              (user["user_id"], req.typ, req.text, json.dumps(req.kontext, ensure_ascii=False)))
    db.commit()
    return {"ok": True}


@router.get("/feedback/status")
def feedback_status(db=Depends(get_db), user=Depends(get_current_user)):
    """Det appen behöver vid start: är användaren admin, och finns svar från Calle som inte visats."""
    c = db.cursor()
    c.execute(f"SELECT id, typ, text, svar FROM feedback WHERE user_id = {ph} AND status = 'klar' "
              f"AND svar IS NOT NULL AND svar_sett = {ph} ORDER BY uppdaterad", (user["user_id"], False))
    nyheter = [dict(r) for r in c.fetchall()]
    admin = är_admin(c, user["user_id"])
    nya = None
    if admin:
        c.execute("SELECT COUNT(*) AS n FROM feedback WHERE status = 'ny'")
        nya = _v(c.fetchone(), "n", 0)
    return {"admin": admin, "nyheter": nyheter, "nya_i_inkorgen": nya}


@router.post("/feedback/{feedback_id}/sett")
def markera_sett(feedback_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"UPDATE feedback SET svar_sett = {ph} WHERE id = {ph} AND user_id = {ph}", (True, feedback_id, user["user_id"]))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Hittades inte")
    db.commit()
    return {"ok": True}


@router.post("/betyg")
def betygsätt(req: Betyg, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"""
        INSERT INTO coach_betyg (user_id, kalla, ref, betyg, orsak, utdrag) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
        ON CONFLICT (user_id, kalla, ref) DO UPDATE SET betyg = excluded.betyg, orsak = excluded.orsak,
            utdrag = excluded.utdrag, skapad = CURRENT_TIMESTAMP
    """, (user["user_id"], req.kalla, req.ref, req.betyg, (req.orsak or "").strip() or None, req.utdrag))
    db.commit()
    return {"ok": True}


@router.get("/admin/feedback")
def inkorg(status: Optional[str] = Query(None), db=Depends(get_db), admin=Depends(kräv_admin)):
    c = db.cursor()
    villkor, param = "", ()
    if status:
        if status not in ("ny", "planerad", "klar", "avvisad"):
            raise HTTPException(status_code=422, detail="Okänd status")
        villkor, param = f"WHERE f.status = {ph}", (status,)
    c.execute(f"""SELECT f.id, f.user_id, u.email AS anvandare, f.typ, f.text, f.kontext, f.status, f.svar, f.svar_sett, f.skapad
                  FROM feedback f JOIN users u ON u.id = f.user_id {villkor} ORDER BY f.id DESC LIMIT 200""", param)
    poster = []
    for r in c.fetchall():
        d = dict(r)
        d["kontext"] = json.loads(d["kontext"] or "{}")
        if hasattr(d["skapad"], "isoformat"):
            d["skapad"] = d["skapad"].isoformat()
        poster.append(d)
    c.execute("SELECT kalla, betyg, COUNT(*) AS n FROM coach_betyg GROUP BY kalla, betyg")
    summering = {}
    for r in c.fetchall():
        r = dict(r)
        summering.setdefault(r["kalla"], {"upp": 0, "ner": 0})["upp" if r["betyg"] == 1 else "ner"] = r["n"]
    c.execute("SELECT b.user_id, u.email AS anvandare, b.kalla, b.orsak, b.utdrag, b.skapad FROM coach_betyg b "
              "JOIN users u ON u.id = b.user_id WHERE b.betyg = -1 ORDER BY b.id DESC LIMIT 30")
    tummar_ner = []
    for r in c.fetchall():
        d = dict(r)
        if hasattr(d["skapad"], "isoformat"):
            d["skapad"] = d["skapad"].isoformat()
        tummar_ner.append(d)
    return {"feedback": poster, "betyg": summering, "tummar_ner": tummar_ner}


@router.patch("/admin/feedback/{feedback_id}")
def ändra_feedback(feedback_id: int, req: AdminÄndring, db=Depends(get_db), admin=Depends(kräv_admin)):
    c = db.cursor()
    svar = (req.svar or "").strip() or None
    c.execute(f"UPDATE feedback SET status = {ph}, svar = {ph}, svar_sett = {ph}, uppdaterad = CURRENT_TIMESTAMP WHERE id = {ph}",
              (req.status, svar, False, feedback_id))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Hittades inte")
    db.commit()
    return {"ok": True}
