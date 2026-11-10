"""Träningsplaner (fas 2): spara planer från coachen, veckovy med avstämning mot Garmin, flytta/ta bort pass."""
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, field_validator
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token
from api.routes.dagsform import giltigt_lokalt_datum
from scripts.aktivitetstyp import hämta_regler, KATEGORIER
from scripts.plan import Plan, innehåll_json, läs_innehåll, stäm_av, STEGTYPER

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"
PASS_KOLUMNER = ["id", "plan_id", "datum", "kategori", "typ", "titel", "syfte", "duration_min", "distans_km",
                 "pulszon", "tempo", "innehall", "activity_id"]


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    token = authorization.split(" ")[1]
    return verifiera_token(token)


def _lokalt_idag(idag: str) -> date:
    try:
        return date.fromisoformat(giltigt_lokalt_datum(idag))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


def hämta_pass(c, uid, från: date, till: date):
    c.execute(f"SELECT {', '.join(PASS_KOLUMNER)} FROM planerade_pass "
              f"WHERE user_id = {ph} AND datum >= {ph} AND datum <= {ph} ORDER BY datum, id",
              (uid, från.isoformat(), till.isoformat()))
    return [dict(r) for r in c.fetchall()]


def hämta_aktiviteter(c, uid, från: date, till: date):
    c.execute(f"SELECT activity_id, datum, namn, typ, plats, distans_km, duration_min, snitt_puls, typ_manuell "
              f"FROM activities WHERE user_id = {ph} AND datum >= {ph} AND datum <= {ph}",
              (uid, från.isoformat(), till.isoformat()))
    return [dict(r) for r in c.fetchall()]


def avstämd_period(c, uid, från: date, till: date, idag: date):
    pass_ = hämta_pass(c, uid, från, till)
    return stäm_av(pass_, hämta_aktiviteter(c, uid, från, till), idag, hämta_regler(c, uid, ph))


class SparaPlan(BaseModel):
    plan: Plan
    idag: str
    samtal_id: Optional[int] = None

    @field_validator("idag")
    @classmethod
    def lokalt_datum(cls, v):
        return giltigt_lokalt_datum(v)


class ÄndraPass(BaseModel):
    idag: str
    datum: Optional[str] = None

    @field_validator("idag")
    @classmethod
    def lokalt_datum(cls, v):
        return giltigt_lokalt_datum(v)

    @field_validator("datum")
    @classmethod
    def giltigt_datum(cls, v):
        if v:
            date.fromisoformat(v)
        return v


@router.post("/planer")
def spara_plan(req: SparaPlan, db=Depends(get_db), user=Depends(get_current_user)):
    uid, idag, plan = user["user_id"], date.fromisoformat(req.idag), req.plan
    try:
        plan.kontrollera_mot(idag)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    från, till = plan.intervall(idag)
    c = db.cursor()
    if req.samtal_id is not None:
        c.execute(f"SELECT id FROM samtal WHERE id = {ph} AND user_id = {ph}", (req.samtal_id, uid))
        if not c.fetchone():
            raise HTTPException(status_code=404, detail="Samtalet hittades inte")

    # Ersätt pass som inte är gjorda än i perioden planen gäller; genomförda pass ligger kvar som historik
    befintliga, _ = avstämd_period(c, uid, från, till, idag)
    ersätts = [p["id"] for p in befintliga if p["status"] != "genomford"]
    for pid in ersätts:
        c.execute(f"DELETE FROM planerade_pass WHERE id = {ph} AND user_id = {ph}", (pid, uid))

    datum = sorted(p.datum for p in plan.pass_)
    c.execute(f"INSERT INTO traningsplaner (user_id, titel, sammanfattning, fran_datum, till_datum, samtal_id) "
              f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}) RETURNING id",
              (uid, plan.titel, plan.sammanfattning, datum[0], datum[-1], req.samtal_id))
    r = c.fetchone()
    plan_id = r["id"] if not isinstance(r, tuple) else r[0]
    for p in plan.pass_:
        c.execute(f"""INSERT INTO planerade_pass (user_id, plan_id, datum, kategori, typ, titel, syfte, duration_min,
                      distans_km, pulszon, tempo, innehall)
                      VALUES ({', '.join([ph] * 12)})""",
                  (uid, plan_id, p.datum, p.kategori, KATEGORIER[p.kategori], p.titel, p.syfte, p.duration_min,
                   p.distans_km, p.pulszon, p.tempo, innehåll_json(p)))
    db.commit()
    return {"ok": True, "plan_id": plan_id, "antal": len(plan.pass_), "ersatta": len(ersätts),
            "fran": från.isoformat(), "till": till.isoformat()}


@router.get("/planer/vecka")
def vecka(start: str = Query(...), idag: str = Query(...), db=Depends(get_db), user=Depends(get_current_user)):
    uid, idag_d = user["user_id"], _lokalt_idag(idag)
    try:
        s = date.fromisoformat(start)
    except ValueError:
        raise HTTPException(status_code=422, detail="ogiltigt datum")
    s -= timedelta(days=s.weekday())  # alltid måndag
    slut = s + timedelta(days=6)
    c = db.cursor()
    pass_, omatchade = avstämd_period(c, uid, s, slut, idag_d)
    for p in pass_:
        p["steg"], p["ovningar"] = läs_innehåll(p.pop("innehall"))

    c.execute(f"SELECT id, titel, sammanfattning, fran_datum, till_datum FROM traningsplaner "
              f"WHERE user_id = {ph} AND fran_datum <= {ph} AND till_datum >= {ph} ORDER BY id DESC LIMIT 1",
              (uid, slut.isoformat(), s.isoformat()))
    r = c.fetchone()
    plan = dict(r) if r else None

    dagar = []
    for i in range(7):
        d = (s + timedelta(days=i)).isoformat()
        dagar.append({"datum": d, "pass": [p for p in pass_ if p["datum"] == d],
                      "ovriga": [a for a in omatchade if a["datum"] == d]})
    räkna = lambda st: sum(1 for p in pass_ if p["status"] == st)
    return {
        "vecka_start": s.isoformat(), "plan": plan, "dagar": dagar,
        "summering": {
            "planerade": len(pass_), "genomforda": räkna("genomford"), "missade": räkna("missad"),
            "planerad_min": sum(p.get("duration_min") or 0 for p in pass_),
            "utford_min": round(sum((p["utfort"] or {}).get("duration_min") or 0 for p in pass_)
                                + sum(a.get("duration_min") or 0 for a in omatchade)),
        },
        "stegtyper": STEGTYPER, "kategorier": KATEGORIER,
    }


@router.patch("/passes/{pass_id}")
def ändra_pass(pass_id: int, req: ÄndraPass, db=Depends(get_db), user=Depends(get_current_user)):
    """Flytta ett pass till en annan dag (inom samma gränser som när planen sparas)."""
    if not req.datum:
        raise HTTPException(status_code=422, detail="Ange nytt datum")
    idag, ny = date.fromisoformat(req.idag), date.fromisoformat(req.datum)
    if ny < idag - timedelta(days=1) or ny > idag + timedelta(days=28):
        raise HTTPException(status_code=422, detail="Datumet måste vara mellan igår och fyra veckor framåt")
    c = db.cursor()
    c.execute(f"UPDATE planerade_pass SET datum = {ph}, activity_id = NULL WHERE id = {ph} AND user_id = {ph}",
              (req.datum, pass_id, user["user_id"]))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Passet hittades inte")
    db.commit()
    return {"ok": True}


@router.delete("/passes/{pass_id}")
def delete_pass(pass_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"DELETE FROM planerade_pass WHERE id = {ph} AND user_id = {ph}", (pass_id, user["user_id"]))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Passet hittades inte")
    db.commit()
    return {"ok": True}
