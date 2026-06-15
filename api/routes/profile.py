from fastapi import APIRouter, Depends
from api.database import get_db
import sqlite3

router = APIRouter()
def classify_activity(typ, plats, distans_km):
    plats = (plats or "").lower()
    if "täby" in plats and typ in ("running", "treadmill_running") and (distans_km or 0) < 10:
        return "football"
    return typ

@router.get("/profile")

def get_profile(db: sqlite3.Connection = Depends(get_db)):
    c = db.cursor()
    
    # Senaste aktiviteter
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

    # Veckobelastning senaste 7 dagar
    c.execute("""
        SELECT datum, typ, distans_km, duration_min, snitt_puls, plats
        FROM activities
        WHERE datum >= date('now', '-7 days')
        ORDER BY datum ASC
    """)
    veckans = c.fetchall()

    # Användarprofil
    c.execute("SELECT langd_cm, vikt_kg, vo2max FROM user_profile LIMIT 1")
    profil = c.fetchone()

    # Personliga rekord
    c.execute("""
        SELECT typ, formaterat, datum FROM personal_records
        WHERE current = 1
        AND typ IN ('Best 1km Run', 'Best Half Marathon', 'Best Full Marathon', 'Farthest Run')
        ORDER BY datum
    """)
    pr = c.fetchall()

    # Senaste hälsodata
    c.execute("""
        SELECT datum, vilpuls, body_battery_hogst, body_battery_lagst, stress_snitt, steg
        FROM health_daily ORDER BY datum DESC LIMIT 7
    """)
    hälsa = c.fetchall()

    # Senaste VO2max
    c.execute("SELECT vo2max, datum FROM vo2max_history ORDER BY datum DESC LIMIT 1")
    vo2 = c.fetchone()
    
    # Sömndata senaste dagen
    c.execute("""
        SELECT datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min
        FROM sleep_daily
        ORDER BY datum DESC
        LIMIT 1
    """)
    sömn = c.fetchone()

    # Veckosammanfattning senaste 8 veckor
    c.execute("""
        SELECT strftime('%Y-W%W', datum) as vecka,
               COUNT(*) as antal_pass,
               ROUND(SUM(distans_km), 1) as total_km
        FROM activities
        WHERE datum >= date('now', '-8 weeks')
        GROUP BY vecka
        ORDER BY vecka DESC
    """)
    veckor = c.fetchall()

    return {
    "profil": dict(profil) if profil else {},
    "vo2max": dict(vo2) if vo2 else {},
    "personliga_rekord": [dict(r) for r in pr],
    "hälsodata": [dict(h) for h in hälsa],
    "veckosammanfattning": [dict(v) for v in veckor],
    "aktiviteter": result,
    "veckans_aktiviteter": [dict(v) for v in veckans],
    "sömn": dict(sömn) if sömn else {}
}