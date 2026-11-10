from datetime import date
from typing import Optional, Literal, List
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token
from scripts.mal import FOKUS, DAGAR

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"
FÄLT = ["typ", "titel", "slutdatum", "distans_km", "maltid", "sport", "fokus",
        "kondition_per_vecka", "styrka_per_vecka", "traningsdagar", "anteckning"]


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    return verifiera_token(authorization.split(" ")[1])


class Mål(BaseModel):
    typ: Literal["grundtraning", "lopp", "forsasong", "halsa"]
    titel: str = Field(min_length=1, max_length=120)
    slutdatum: Optional[str] = None
    distans_km: Optional[float] = Field(default=None, gt=0, lt=500)
    maltid: Optional[str] = Field(default=None, max_length=20)
    sport: Optional[str] = Field(default=None, max_length=60)
    fokus: List[str] = []
    kondition_per_vecka: Optional[int] = Field(default=None, ge=0, le=14)
    styrka_per_vecka: Optional[int] = Field(default=None, ge=0, le=14)
    traningsdagar: List[str] = []
    anteckning: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("slutdatum")
    @classmethod
    def giltigt_datum(cls, v):
        if v:
            date.fromisoformat(v)
        return v or None

    @field_validator("fokus")
    @classmethod
    def giltigt_fokus(cls, v):
        if any(f not in FOKUS for f in v):
            raise ValueError("okänt fokus")
        return v

    @field_validator("traningsdagar")
    @classmethod
    def giltiga_dagar(cls, v):
        if any(d not in DAGAR for d in v):
            raise ValueError("okänd dag")
        return v

    def till_rad(self):
        d = self.model_dump()
        d["fokus"] = ",".join(self.fokus) or None
        d["traningsdagar"] = ",".join(self.traningsdagar) or None
        return d


def _som_dict(rad):
    d = dict(rad)
    d["fokus"] = [f for f in (d.get("fokus") or "").split(",") if f]
    d["traningsdagar"] = [x for x in (d.get("traningsdagar") or "").split(",") if x]
    if d.get("skapad") is not None and hasattr(d["skapad"], "isoformat"):
        d["skapad"] = d["skapad"].isoformat()
    d["aktiv"] = bool(d.get("aktiv"))
    return d


@router.get("/mal")
def hämta_mål(db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"SELECT * FROM mal WHERE user_id = {ph} ORDER BY aktiv DESC, skapad DESC LIMIT 20", (user["user_id"],))
    rader = [_som_dict(r) for r in c.fetchall()]
    aktivt = next((r for r in rader if r["aktiv"]), None)
    return {"aktivt": aktivt, "tidigare": [r for r in rader if not r["aktiv"]]}


@router.post("/mal")
def skapa_mål(req: Mål, db=Depends(get_db), user=Depends(get_current_user)):
    """Nytt mål blir det aktiva; tidigare aktivt mål arkiveras (finns kvar som historik)."""
    c = db.cursor()
    c.execute(f"UPDATE mal SET aktiv = {ph} WHERE user_id = {ph} AND aktiv = {ph}", (False, user["user_id"], True))
    rad = req.till_rad()
    c.execute(f"INSERT INTO mal (user_id, {', '.join(FÄLT)}) VALUES ({ph}, {', '.join([ph] * len(FÄLT))})",
              (user["user_id"], *[rad[f] for f in FÄLT]))
    db.commit()
    return {"ok": True}


@router.put("/mal/{mal_id}")
def uppdatera_mål(mal_id: int, req: Mål, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    rad = req.till_rad()
    c.execute(f"UPDATE mal SET {', '.join(f'{f} = {ph}' for f in FÄLT)} WHERE id = {ph} AND user_id = {ph}",
              (*[rad[f] for f in FÄLT], mal_id, user["user_id"]))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Målet hittades inte")
    db.commit()
    return {"ok": True}


@router.delete("/mal/{mal_id}")
def avsluta_mål(mal_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    """Avslutar (arkiverar) målet — raderar inte, så historiken finns kvar."""
    c = db.cursor()
    c.execute(f"UPDATE mal SET aktiv = {ph} WHERE id = {ph} AND user_id = {ph}", (False, mal_id, user["user_id"]))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Målet hittades inte")
    db.commit()
    return {"ok": True}
