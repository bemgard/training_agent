"""'Om mig' (atletprofil) och egna klassningsregler (aktivitetsregler)."""
from typing import Optional, Literal, List
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token
from scripts.aktivitetstyp import KATEGORIER
from scripts.atletprofil import UTRUSTNING

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"
FÄLT = ["erfarenhet", "sporter", "utrustning", "skador", "preferenser", "fritext"]
MAX_REGLER = 20


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    return verifiera_token(authorization.split(" ")[1])


def _tom_till_none(v):
    v = (v or "").strip()
    return v or None


class Atletprofil(BaseModel):
    erfarenhet: Optional[Literal["nyborjare", "motionar", "van", "elit"]] = None
    sporter: Optional[str] = Field(default=None, max_length=300)
    utrustning: List[str] = []
    skador: Optional[str] = Field(default=None, max_length=1000)
    preferenser: Optional[str] = Field(default=None, max_length=1000)
    fritext: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("utrustning")
    @classmethod
    def giltig_utrustning(cls, v):
        if any(u not in UTRUSTNING for u in v):
            raise ValueError("okänd utrustning")
        return list(dict.fromkeys(v))

    @field_validator("sporter", "skador", "preferenser", "fritext")
    @classmethod
    def trimma(cls, v):
        return _tom_till_none(v)


class Regel(BaseModel):
    plats: str = Field(min_length=1, max_length=80)
    fran_kategori: str
    max_km: Optional[float] = Field(default=None, gt=0, lt=500)
    till_kategori: str

    @field_validator("plats")
    @classmethod
    def trimma_plats(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("plats saknas")
        return v

    @field_validator("fran_kategori", "till_kategori")
    @classmethod
    def giltig_kategori(cls, v):
        if v not in KATEGORIER:
            raise ValueError("okänd kategori")
        return v


def _profil(c, uid):
    c.execute(f"SELECT {', '.join(FÄLT)} FROM atletprofil WHERE user_id = {ph}", (uid,))
    r = c.fetchone()
    if not r:
        return {f: ([] if f == "utrustning" else None) for f in FÄLT}
    d = {f: (r[f] if not isinstance(r, tuple) else r[i]) for i, f in enumerate(FÄLT)}
    d["utrustning"] = [u for u in (d["utrustning"] or "").split(",") if u]
    return d


def _regler(c, uid):
    c.execute(f"SELECT id, plats, fran_kategori, max_km, till_kategori FROM aktivitetsregler "
              f"WHERE user_id = {ph} ORDER BY id", (uid,))
    return [dict(r) for r in c.fetchall()]


@router.get("/om-mig")
def hämta(db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    return {"profil": _profil(c, user["user_id"]), "regler": _regler(c, user["user_id"]),
            "utrustning_val": UTRUSTNING, "kategorier": KATEGORIER}


@router.put("/om-mig")
def spara(req: Atletprofil, db=Depends(get_db), user=Depends(get_current_user)):
    d = req.model_dump()
    d["utrustning"] = ",".join(req.utrustning) or None
    c = db.cursor()
    c.execute(f"""
        INSERT INTO atletprofil (user_id, {', '.join(FÄLT)}) VALUES ({ph}, {', '.join([ph] * len(FÄLT))})
        ON CONFLICT (user_id) DO UPDATE SET {', '.join(f'{f} = excluded.{f}' for f in FÄLT)},
            uppdaterad = CURRENT_TIMESTAMP
    """, (user["user_id"], *[d[f] for f in FÄLT]))
    db.commit()
    return {"ok": True}


@router.post("/aktivitetsregler")
def ny_regel(req: Regel, db=Depends(get_db), user=Depends(get_current_user)):
    if req.fran_kategori == req.till_kategori:
        raise HTTPException(status_code=422, detail="Regeln måste byta till en annan typ")
    c = db.cursor()
    c.execute(f"SELECT COUNT(*) AS n FROM aktivitetsregler WHERE user_id = {ph}", (user["user_id"],))
    r = c.fetchone()
    if (r["n"] if not isinstance(r, tuple) else r[0]) >= MAX_REGLER:
        raise HTTPException(status_code=422, detail=f"Max {MAX_REGLER} regler")
    c.execute(f"INSERT INTO aktivitetsregler (user_id, plats, fran_kategori, max_km, till_kategori) "
              f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph})",
              (user["user_id"], req.plats, req.fran_kategori, req.max_km, req.till_kategori))
    db.commit()
    return {"ok": True}


@router.delete("/aktivitetsregler/{regel_id}")
def ta_bort_regel(regel_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"DELETE FROM aktivitetsregler WHERE id = {ph} AND user_id = {ph}", (regel_id, user["user_id"]))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Regeln hittades inte")
    db.commit()
    return {"ok": True}
