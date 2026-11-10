"""Dagsform (allmänt + symtom per dag) och pågående besvär i kroppsdelar."""
from datetime import date, datetime, timezone
from typing import Optional, Literal, List
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token
from scripts.dagsform import ALLMANT, SYMTOM, KROPPSDELAR, BESVARSTYP, sjukvarning, dag_nummer

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    return verifiera_token(authorization.split(" ")[1])


def giltigt_lokalt_datum(v: str) -> str:
    """Klientens lokala datum — måste ligga inom en dag från serverns UTC-datum (tidszoner)."""
    d = date.fromisoformat(v)
    if abs((d - datetime.now(timezone.utc).date()).days) > 1:
        raise ValueError("datumet måste vara idag")
    return v


def _rad(r):
    return dict(r) if r is not None else None


class Dagsform(BaseModel):
    datum: str
    allmant: Optional[Literal["pigg", "okej", "trott", "krasslig"]] = None
    symtom: List[str] = []
    temp: Optional[float] = Field(default=None, ge=34, le=43)
    fritext: Optional[str] = Field(default=None, max_length=500)

    @field_validator("datum")
    @classmethod
    def lokalt_datum(cls, v):
        return giltigt_lokalt_datum(v)

    @field_validator("symtom")
    @classmethod
    def giltiga_symtom(cls, v):
        if any(s not in SYMTOM for s in v):
            raise ValueError("okänt symtom")
        return list(dict.fromkeys(v))

    @field_validator("fritext")
    @classmethod
    def trimma(cls, v):
        return (v or "").strip() or None


class NyttBesvär(BaseModel):
    datum: str
    kroppsdel: str
    typ: Literal["traningsvark", "stelhet", "skarp", "loppsteg"]
    niva: int = Field(ge=1, le=10)
    anteckning: Optional[str] = Field(default=None, max_length=300)

    @field_validator("datum")
    @classmethod
    def lokalt_datum(cls, v):
        return giltigt_lokalt_datum(v)

    @field_validator("kroppsdel")
    @classmethod
    def giltig_kroppsdel(cls, v):
        if v not in KROPPSDELAR:
            raise ValueError("okänd kroppsdel")
        return v


class BesvärUppdatering(BaseModel):
    datum: str
    niva: Optional[int] = Field(default=None, ge=1, le=10)
    borta: bool = False

    @field_validator("datum")
    @classmethod
    def lokalt_datum(cls, v):
        return giltigt_lokalt_datum(v)


@router.get("/dagsform")
def hämta(datum: str = Query(...), db=Depends(get_db), user=Depends(get_current_user)):
    try:
        giltigt_lokalt_datum(datum)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    uid, idag = user["user_id"], date.fromisoformat(datum)
    c = db.cursor()
    c.execute(f"SELECT datum, allmant, symtom, temp, fritext FROM dagsform WHERE user_id = {ph} AND datum = {ph}", (uid, datum))
    rapport = _rad(c.fetchone())
    if rapport:
        rapport["symtom"] = [s for s in (rapport["symtom"] or "").split(",") if s]
    c.execute(f"SELECT id, kroppsdel, typ, niva, niva_start, start_datum, senast_datum, anteckning FROM besvar "
              f"WHERE user_id = {ph} AND aktiv = {ph} ORDER BY start_datum", (uid, True))
    besvär = [dict(r) for r in c.fetchall()]
    for b in besvär:
        b["dag"] = dag_nummer(b["start_datum"], idag)
    c.execute(f"SELECT datum, hudtemp_avvikelse, hrv_natt, vilopuls_natt FROM sleep_daily "
              f"WHERE user_id = {ph} ORDER BY datum DESC LIMIT 15", (uid,))
    nätter = [dict(r) for r in c.fetchall()]
    varning = sjukvarning(nätter)
    if varning and (idag - date.fromisoformat(varning["datum"])).days > 1:
        varning = None  # gammal natt — inte relevant längre
    return {"idag": rapport, "besvar": besvär, "varning": varning,
            "val": {"allmant": ALLMANT, "symtom": {k: v[0] for k, v in SYMTOM.items()},
                    "kroppsdelar": KROPPSDELAR, "besvarstyp": BESVARSTYP}}


@router.put("/dagsform")
def spara(req: Dagsform, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"""
        INSERT INTO dagsform (user_id, datum, allmant, symtom, temp, fritext) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
        ON CONFLICT (user_id, datum) DO UPDATE SET allmant = excluded.allmant, symtom = excluded.symtom,
            temp = excluded.temp, fritext = excluded.fritext, uppdaterad = CURRENT_TIMESTAMP
    """, (user["user_id"], req.datum, req.allmant, ",".join(req.symtom) or None, req.temp, req.fritext))
    db.commit()
    return {"ok": True}


@router.post("/besvar")
def nytt_besvär(req: NyttBesvär, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"SELECT COUNT(*) AS n FROM besvar WHERE user_id = {ph} AND aktiv = {ph}", (user["user_id"], True))
    r = c.fetchone()
    if (r["n"] if not isinstance(r, tuple) else r[0]) >= 10:
        raise HTTPException(status_code=422, detail="Max 10 pågående besvär")
    c.execute(f"INSERT INTO besvar (user_id, kroppsdel, typ, niva, niva_start, start_datum, senast_datum, anteckning) "
              f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})",
              (user["user_id"], req.kroppsdel, req.typ, req.niva, req.niva, req.datum, req.datum,
               (req.anteckning or "").strip() or None))
    db.commit()
    return {"ok": True}


@router.patch("/besvar/{besvar_id}")
def uppdatera_besvär(besvar_id: int, req: BesvärUppdatering, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    if req.borta:
        c.execute(f"UPDATE besvar SET aktiv = {ph}, slut_datum = {ph} WHERE id = {ph} AND user_id = {ph} AND aktiv = {ph}",
                  (False, req.datum, besvar_id, user["user_id"], True))
    elif req.niva is not None:
        c.execute(f"UPDATE besvar SET niva = {ph}, senast_datum = {ph} WHERE id = {ph} AND user_id = {ph} AND aktiv = {ph}",
                  (req.niva, req.datum, besvar_id, user["user_id"], True))
    else:
        raise HTTPException(status_code=422, detail="Ange ny nivå eller borta")
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Besväret hittades inte")
    db.commit()
    return {"ok": True}
