from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from collections import defaultdict
from api.database import get_db, USE_SQLITE

router = APIRouter()

ph = "?" if USE_SQLITE else "%s"

def classify_activity(typ, plats, distans_km):
    plats = (plats or "").lower()
    if "täby" in plats and typ in ("running", "treadmill_running") and (distans_km or 0) < 10:
        return "football"
    return typ

@router.get("/profile")
def get_profile(db=Depends(get_db)):
    c = db.cursor()

    c.execute("""
        SELECT datum, namn, typ, distans_km, duration_min, snitt_puls, snitt_tempo, plats
        FROM activities
        WHERE typ NOT IN ('golf')
        ORDER BY datum DESC
        LIMIT 10
    """)
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
        WHERE datum >= {ph}
        ORDER BY datum ASC
    """, (sju_dagar,))
    veckans = c.fetchall()

    c.execute("SELECT langd_cm, vikt_kg, vo2max FROM user_profile LIMIT 1")
    profil = c.fetchone()

    c.execute("""
        SELECT typ, formaterat, datum FROM personal_records
        WHERE current = 1
        AND typ IN ('Best 1km Run', 'Best Half Marathon', 'Best Full Marathon', 'Farthest Run')
        ORDER BY datum
    """)
    pr = c.fetchall()

    c.execute("""
        SELECT datum, vilpuls, body_battery_hogst, body_battery_lagst, stress_snitt, steg
        FROM health_daily ORDER BY datum DESC LIMIT 7
    """)
    hälsa = c.fetchall()

    c.execute("SELECT vo2max, datum FROM vo2max_history ORDER BY datum DESC LIMIT 1")
    vo2 = c.fetchone()

    c.execute("""
        SELECT datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min
        FROM sleep_daily
        ORDER BY datum DESC
        LIMIT 1
    """)
    sömn = c.fetchone()

    atta_veckor = (datetime.now() - timedelta(weeks=8)).strftime("%Y-%m-%d")
    c.execute(f"""
        SELECT datum, distans_km
        FROM activities
        WHERE datum >= {ph}
    """, (atta_veckor,))
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
        "sömn": dict(sömn) if sömn else {}
    }
