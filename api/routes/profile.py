from fastapi import APIRouter, Depends, Header, HTTPException
from datetime import datetime, timedelta
from collections import defaultdict
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"

def classify_activity(typ, plats, distans_km):
    plats = (plats or "").lower()
    if "täby" in plats and typ in ("running", "treadmill_running") and (distans_km or 0) < 10:
        return "football"
    return typ

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    token = authorization.split(" ")[1]
    return verifiera_token(token)

@router.get("/profile")
def get_profile(db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    user_id = user["user_id"]

    c.execute(f"""
        SELECT datum, namn, typ, distans_km, duration_min, snitt_puls, snitt_tempo, plats
        FROM activities
        WHERE typ NOT IN ('golf') AND user_id = {ph}
        ORDER BY datum DESC
        LIMIT 10
    """, (user_id,))
    aktiviteter = c.fetchall()
    result = []
    for a in aktiviteter:
        d = dict(a)
        d["typ"] = classify_activity(d["typ"], d.get("plats"), d.get("distans_km"))
        result.append(d)

    sju_dagar = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    c.execute(f"""
        SELECT datum, typ, distans_km, duration_min, snitt_puls, plats
        FROM activities
        WHERE datum >= {ph} AND user_id = {ph}
        ORDER BY datum ASC
    """, (sju_dagar, user_id))
    veckans = c.fetchall()

    c.execute(f"SELECT langd_cm, vikt_kg, vo2max FROM user_profile WHERE id = {ph} LIMIT 1", (user_id,))
    profil = c.fetchone()
    if not profil:
        c.execute("SELECT langd_cm, vikt_kg, vo2max FROM user_profile LIMIT 1")
        profil = c.fetchone()

    c.execute(f"""
        SELECT typ, formaterat, datum FROM personal_records
        WHERE current = 1 AND user_id = {ph}
        AND typ IN ('Best 1km Run', 'Best Half Marathon', 'Best Full Marathon', 'Farthest Run', 'Estimated 5K', 'Estimated 10K', 'Estimated Half Marathon', 'Estimated Marathon')
        ORDER BY datum
    """, (user_id,))
    pr = c.fetchall()

    c.execute(f"""
        SELECT datum, vilpuls, body_battery_hogst, body_battery_lagst, stress_snitt, steg
        FROM health_daily WHERE user_id = {ph}
        ORDER BY datum DESC LIMIT 7
    """, (user_id,))
    hälsa = c.fetchall()

    c.execute(f"SELECT vo2max, datum FROM vo2max_history WHERE user_id = {ph} ORDER BY datum DESC LIMIT 1", (user_id,))
    vo2 = c.fetchone()

    c.execute(f"""
        SELECT datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min
        FROM sleep_daily WHERE user_id = {ph}
        ORDER BY datum DESC LIMIT 7
    """, (user_id,))
    sömn_dagar = c.fetchall()

    c.execute(f"""
        SELECT time_5k, time_10k, time_half, time_marathon, datum
        FROM race_predictions WHERE user_id = {ph}
        ORDER BY datum DESC LIMIT 1
    """, (user_id,))
    predictions = c.fetchone()

    atta_veckor = (datetime.now() - timedelta(weeks=8)).strftime("%Y-%m-%d")
    c.execute(f"""
        SELECT datum, distans_km FROM activities
        WHERE datum >= {ph} AND user_id = {ph}
    """, (atta_veckor, user_id))
    act_rows = c.fetchall()

    vecka_map = defaultdict(lambda: {"antal_pass": 0, "total_km": 0.0})
    for row in act_rows:
        row_d = dict(row)
        d = datetime.strptime(row_d["datum"], "%Y-%m-%d")
        vecka = d.strftime("%Y-W%W")
        vecka_map[vecka]["antal_pass"] += 1
        vecka_map[vecka]["total_km"] += row_d.get("distans_km") or 0.0

    veckor = [
        {"vecka": k, "antal_pass": v["antal_pass"], "total_km": round(v["total_km"], 1)}
        for k, v in sorted(vecka_map.items(), reverse=True)
    ]

    return {
        "profil": dict(profil) if profil else {},
        "vo2max": dict(vo2) if vo2 else {},
        "personliga_rekord": [dict(r) for r in pr],
        "hälsodata": [dict(h) for h in hälsa],
        "veckosammanfattning": veckor,
        "aktiviteter": result,
        "veckans_aktiviteter": [dict(v) for v in veckans],
        "sömn": dict(sömn_dagar[0]) if sömn_dagar else {},
        "sömn_vecka": [dict(s) for s in sömn_dagar],
        "race_predictions": dict(predictions) if predictions else {}
    }