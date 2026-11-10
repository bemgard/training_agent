"""Träningsplaner (fas 2): spara planer från coachen, veckovy med avstämning mot Garmin, flytta/ta bort pass."""
import threading
from datetime import date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token
from api.routes.dagsform import giltigt_lokalt_datum
from scripts.aktivitetstyp import hämta_regler, KATEGORIER
from scripts.plan import Plan, innehåll_json, läs_innehåll, stäm_av, STEGTYPER
from scripts.garmin_pass import till_garmin, KAN_SKICKAS
from api import garmin_klient
from api.database import open_conn

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"
PASS_KOLUMNER = ["id", "plan_id", "datum", "kategori", "typ", "titel", "syfte", "duration_min", "distans_km",
                 "pulszon", "tempo", "innehall", "activity_id", "garmin_workout_id", "garmin_schedule_id", "garmin_skickad"]


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    token = authorization.split(" ")[1]
    return verifiera_token(token)


def _städa_garmin(user_id, workout_ids):
    """Tar bort pass i Garmin Connect i bakgrunden (best effort — fel loggas, stoppar aldrig appen)."""
    workout_ids = [w for w in workout_ids if w]
    if not workout_ids:
        return
    def kör():
        try:
            with garmin_klient.inloggad(user_id) as g:
                for wid in workout_ids:
                    try:
                        g.delete_workout(wid)
                    except Exception as e:
                        print(f"GARMIN städning (user {user_id}, workout {wid}): {type(e).__name__}: {e}")
        except Exception as e:
            print(f"GARMIN städning (user {user_id}): {type(e).__name__}: {e}")
    threading.Thread(target=kör, daemon=True).start()


def _schemalägg(g, workout_id, datum):
    svar = g.schedule_workout(workout_id, datum) or {}
    return svar.get("workoutScheduleId") or svar.get("scheduleId") or svar.get("id")


def _flytta_i_garmin(user_id, pass_id, workout_id, schedule_id, nytt_datum):
    def kör():
        try:
            with garmin_klient.inloggad(user_id) as g:
                if schedule_id:
                    try:
                        g.unschedule_workout(schedule_id)
                    except Exception as e:
                        print(f"GARMIN avboka (user {user_id}): {type(e).__name__}: {e}")
                nytt = _schemalägg(g, workout_id, nytt_datum)
            conn = open_conn()
            try:
                conn.cursor().execute(f"UPDATE planerade_pass SET garmin_schedule_id = {ph} WHERE id = {ph} AND user_id = {ph}",
                                      (nytt, pass_id, user_id))
                conn.commit()
            finally:
                conn.close()
        except Exception as e:
            print(f"GARMIN flytt (user {user_id}, pass {pass_id}): {type(e).__name__}: {e}")
    threading.Thread(target=kör, daemon=True).start()


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


class SkickaTillGarmin(BaseModel):
    pass_ids: List[int] = Field(min_length=1, max_length=14)
    idag: str

    @field_validator("idag")
    @classmethod
    def lokalt_datum(cls, v):
        return giltigt_lokalt_datum(v)


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
    garmin_bort = [p.get("garmin_workout_id") for p in befintliga if p["status"] != "genomford"]
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
    _städa_garmin(uid, garmin_bort)
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
        p["kan_skickas"] = (p.get("kategori") in KAN_SKICKAS and p["status"] in ("idag", "kommande")
                            and (p.get("kategori") != "strength_training" or bool(p["ovningar"])))
        p.pop("garmin_schedule_id", None)

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


@router.delete("/planer/{plan_id}")
def ta_bort_plan(plan_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    """Tar bort planen och alla dess pass (även i Garmin). Genomförda Garmin-aktiviteter påverkas inte —
    de visas som oplanerade pass i veckovyn efteråt."""
    uid = user["user_id"]
    c = db.cursor()
    c.execute(f"SELECT id FROM traningsplaner WHERE id = {ph} AND user_id = {ph}", (plan_id, uid))
    if not c.fetchone():
        raise HTTPException(status_code=404, detail="Planen hittades inte")
    c.execute(f"SELECT garmin_workout_id FROM planerade_pass WHERE plan_id = {ph} AND user_id = {ph}", (plan_id, uid))
    garmin = [dict(r)["garmin_workout_id"] for r in c.fetchall()]
    c.execute(f"DELETE FROM planerade_pass WHERE plan_id = {ph} AND user_id = {ph}", (plan_id, uid))
    antal = c.rowcount
    c.execute(f"DELETE FROM traningsplaner WHERE id = {ph} AND user_id = {ph}", (plan_id, uid))
    db.commit()
    _städa_garmin(uid, garmin)
    return {"ok": True, "borttagna_pass": antal}


@router.patch("/passes/{pass_id}")
def ändra_pass(pass_id: int, req: ÄndraPass, db=Depends(get_db), user=Depends(get_current_user)):
    """Flytta ett pass till en annan dag (inom samma gränser som när planen sparas)."""
    if not req.datum:
        raise HTTPException(status_code=422, detail="Ange nytt datum")
    idag, ny = date.fromisoformat(req.idag), date.fromisoformat(req.datum)
    if ny < idag - timedelta(days=1) or ny > idag + timedelta(days=28):
        raise HTTPException(status_code=422, detail="Datumet måste vara mellan igår och fyra veckor framåt")
    c = db.cursor()
    c.execute(f"SELECT garmin_workout_id, garmin_schedule_id FROM planerade_pass WHERE id = {ph} AND user_id = {ph}",
              (pass_id, user["user_id"]))
    rad = c.fetchone()
    if not rad:
        raise HTTPException(status_code=404, detail="Passet hittades inte")
    rad = dict(rad)
    c.execute(f"UPDATE planerade_pass SET datum = {ph}, activity_id = NULL WHERE id = {ph} AND user_id = {ph}",
              (req.datum, pass_id, user["user_id"]))
    db.commit()
    if rad["garmin_workout_id"]:
        _flytta_i_garmin(user["user_id"], pass_id, rad["garmin_workout_id"], rad["garmin_schedule_id"], req.datum)
    return {"ok": True}


@router.delete("/passes/{pass_id}")
def delete_pass(pass_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"SELECT garmin_workout_id FROM planerade_pass WHERE id = {ph} AND user_id = {ph}", (pass_id, user["user_id"]))
    rad = c.fetchone()
    if not rad:
        raise HTTPException(status_code=404, detail="Passet hittades inte")
    c.execute(f"DELETE FROM planerade_pass WHERE id = {ph} AND user_id = {ph}", (pass_id, user["user_id"]))
    db.commit()
    _städa_garmin(user["user_id"], [dict(rad)["garmin_workout_id"]])
    return {"ok": True}


@router.post("/planer/garmin")
def skicka_till_garmin(req: SkickaTillGarmin, db=Depends(get_db), user=Depends(get_current_user)):
    """Laddar upp passen till Garmin Connect och lägger dem i kalendern. Redan skickade pass ersätts
    (gamla versionen tas bort) så att en ändrad plan aldrig ger dubbletter på klockan."""
    uid, idag = user["user_id"], date.fromisoformat(req.idag)
    c = db.cursor()
    ids = list(dict.fromkeys(req.pass_ids))
    c.execute(f"SELECT {', '.join(PASS_KOLUMNER)} FROM planerade_pass WHERE user_id = {ph} AND id IN ({', '.join([ph] * len(ids))})",
              (uid, *ids))
    pass_ = {r["id"]: dict(r) for r in c.fetchall()}
    if len(pass_) != len(ids):
        raise HTTPException(status_code=404, detail="Passet hittades inte")

    resultat, att_skicka = [], []
    for pid in ids:
        p = pass_[pid]
        if date.fromisoformat(p["datum"]) < idag:
            resultat.append({"id": pid, "ok": False, "fel": "Passet har redan varit"})
            continue
        steg, övningar = läs_innehåll(p["innehall"])
        try:
            att_skicka.append((p, till_garmin(p, steg, övningar)))
        except ValueError as e:
            resultat.append({"id": pid, "ok": False, "fel": str(e)})
    if not att_skicka:
        return {"resultat": resultat}

    try:
        with garmin_klient.inloggad(uid) as g:
            for p, workout in att_skicka:
                try:
                    if p.get("garmin_workout_id"):
                        try:
                            g.delete_workout(p["garmin_workout_id"])
                        except Exception:
                            pass  # redan borttaget i Garmin Connect
                    wid = (g.upload_workout(workout) or {}).get("workoutId")
                    if not wid:
                        raise RuntimeError("Garmin returnerade inget pass-id")
                    sid = _schemalägg(g, wid, p["datum"])
                    c.execute(f"UPDATE planerade_pass SET garmin_workout_id = {ph}, garmin_schedule_id = {ph}, "
                              f"garmin_skickad = CURRENT_TIMESTAMP WHERE id = {ph} AND user_id = {ph}", (wid, sid, p["id"], uid))
                    db.commit()
                    resultat.append({"id": p["id"], "ok": True})
                except Exception as e:
                    print(f"GARMIN skicka (user {uid}, pass {p['id']}): {type(e).__name__}: {e}")
                    resultat.append({"id": p["id"], "ok": False, "fel": "Garmin tog inte emot passet"})
    except Exception as e:
        print(f"GARMIN inloggning (user {uid}): {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail="Kunde inte logga in på Garmin just nu — försök igen om en stund")
    return {"resultat": resultat}


@router.delete("/passes/{pass_id}/garmin")
def ta_bort_från_garmin(pass_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    c.execute(f"SELECT garmin_workout_id FROM planerade_pass WHERE id = {ph} AND user_id = {ph}", (pass_id, user["user_id"]))
    rad = c.fetchone()
    if not rad:
        raise HTTPException(status_code=404, detail="Passet hittades inte")
    c.execute(f"UPDATE planerade_pass SET garmin_workout_id = NULL, garmin_schedule_id = NULL, garmin_skickad = NULL "
              f"WHERE id = {ph} AND user_id = {ph}", (pass_id, user["user_id"]))
    db.commit()
    _städa_garmin(user["user_id"], [dict(rad)["garmin_workout_id"]])
    return {"ok": True}
