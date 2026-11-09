from datetime import date
from typing import Optional, Literal
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token
from scripts.kropp import beräkna

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    return verifiera_token(authorization.split(" ")[1])


def _kroppsprofil(c, user_id):
    c.execute(f"SELECT langd_cm, fodelsear, kon FROM users WHERE id = {ph}", (user_id,))
    return dict(c.fetchone() or {})


@router.get("/kropp")
def get_kropp(db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    profil = _kroppsprofil(c, user["user_id"])
    c.execute(f"""
        SELECT id, datum, vikt_kg, fett_procent, muskel_kg, kalla
        FROM weight_log WHERE user_id = {ph} ORDER BY datum ASC
    """, (user["user_id"],))
    mätningar = [beräkna(dict(r), profil.get("langd_cm"), profil.get("fodelsear"), profil.get("kon"))
                 for r in c.fetchall()]
    return {"profil": profil, "matningar": mätningar}


class Kroppsprofil(BaseModel):
    langd_cm: float = Field(gt=100, lt=250)
    fodelsear: int = Field(gt=1920, lt=2020)
    kon: Literal["man", "kvinna"]


@router.put("/kroppsprofil")
def put_kroppsprofil(req: Kroppsprofil, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"UPDATE users SET langd_cm = {ph}, fodelsear = {ph}, kon = {ph} WHERE id = {ph}",
              (req.langd_cm, req.fodelsear, req.kon, user["user_id"]))
    db.commit()
    return {"ok": True}


class Invägning(BaseModel):
    datum: Optional[str] = None  # YYYY-MM-DD, default idag
    vikt_kg: float = Field(gt=20, lt=300)
    fett_procent: Optional[float] = Field(default=None, gt=2, lt=70)
    muskel_kg: Optional[float] = Field(default=None, gt=5, lt=150)


@router.post("/vikt")
def post_vikt(req: Invägning, db=Depends(get_db), user=Depends(get_current_user)):
    datum = req.datum or date.today().isoformat()
    try:
        date.fromisoformat(datum)
    except ValueError:
        raise HTTPException(status_code=400, detail="Ogiltigt datum")
    c = db.cursor()
    # En invägning per dag — ny invägning samma dag ersätter den gamla
    c.execute(f"""
        INSERT INTO weight_log (user_id, datum, vikt_kg, fett_procent, muskel_kg, kalla)
        VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, 'manuell')
        ON CONFLICT (datum, user_id) DO UPDATE SET
            vikt_kg = excluded.vikt_kg, fett_procent = excluded.fett_procent,
            muskel_kg = excluded.muskel_kg, kalla = excluded.kalla
    """, (user["user_id"], datum, req.vikt_kg, req.fett_procent, req.muskel_kg))
    db.commit()
    return {"ok": True}


@router.delete("/vikt/{matning_id}")
def delete_vikt(matning_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"DELETE FROM weight_log WHERE id = {ph} AND user_id = {ph}", (matning_id, user["user_id"]))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Mätningen hittades inte")
    db.commit()
    return {"ok": True}
