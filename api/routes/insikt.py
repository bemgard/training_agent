"""Morgoninsikt och veckosammanfattning (fas 4)."""
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, field_validator
from api.database import get_db
from api.routes.auth import verifiera_token
from api.routes.dagsform import giltigt_lokalt_datum
from api import insikt

router = APIRouter()


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    return verifiera_token(authorization.split(" ")[1])


class Uppdatera(BaseModel):
    datum: str

    @field_validator("datum")
    @classmethod
    def lokalt_datum(cls, v):
        return giltigt_lokalt_datum(v)


@router.get("/insikt")
def hämta_insikter(datum: str = Query(...), db=Depends(get_db), user=Depends(get_current_user)):
    try:
        idag = date.fromisoformat(giltigt_lokalt_datum(datum))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    c = db.cursor()
    morgon = insikt.hämta(c, user["user_id"], idag.isoformat(), "morgon")
    vecka = None
    for d in range(2):  # söndagens sammanfattning visas söndag och måndag
        vecka = vecka or insikt.hämta(c, user["user_id"], (idag - timedelta(days=d)).isoformat(), "vecka")
    return {"morgon": morgon, "vecka": vecka, "max_per_dag": insikt.MAX_PER_DAG}


@router.post("/insikt/morgon")
def uppdatera_morgon(req: Uppdatera, user=Depends(get_current_user)):
    """Skapar dagens insikt om den saknas, annars genereras den om (max MAX_PER_DAG gånger per dag)."""
    try:
        ny = insikt.skapa(user["user_id"], "morgon", date.fromisoformat(req.datum), "uppdatera", tvinga=True)
    except Exception as e:
        print(f"INSIKT FEL (user {user['user_id']}): {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail="Coachen kunde inte skapa insikten just nu")
    if ny is None:
        raise HTTPException(status_code=429, detail=f"Insikten kan uppdateras max {insikt.MAX_PER_DAG} gånger per dag")
    return ny
