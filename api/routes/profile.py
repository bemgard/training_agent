from fastapi import APIRouter, Depends, Header, HTTPException
from datetime import datetime, timedelta
from collections import defaultdict
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token
from pydantic import BaseModel
from typing import Optional
from scripts.aktivitetstyp import effektiv_typ, KATEGORIER
from scripts.belastning import daglig_serie, maxpuls

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"

def med_kategori(rad):
    """Lägger till kategori/gissad (gemensam logik med coachen, se scripts/aktivitetstyp.py)."""
    d = dict(rad)
    d["kategori"], d["gissad"] = effektiv_typ(
        d.get("typ"), d.get("plats"), d.get("distans_km"),
        d.get("duration_min"), d.get("snitt_puls"), d.get("typ_manuell"))
    return d

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
        SELECT activity_id, datum, namn, typ, typ_manuell, distans_km, duration_min,
               snitt_puls, snitt_tempo, plats
        FROM activities
        WHERE typ NOT IN ('golf') AND user_id = {ph}
        ORDER BY datum DESC, activity_id DESC
        LIMIT 10
    """, (user_id,))
    result = [med_kategori(a) for a in c.fetchall()]

    måndag = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime("%Y-%m-%d")
    c.execute(f"""
        SELECT activity_id, datum, namn, typ, typ_manuell, distans_km, duration_min, snitt_puls, plats
        FROM activities
        WHERE datum >= {ph} AND user_id = {ph}
        ORDER BY datum ASC
    """, (måndag, user_id))
    veckans = [med_kategori(a) for a in c.fetchall()]

    c.execute(f"SELECT langd_cm, vikt_kg, vo2max FROM user_profile WHERE id = {ph} LIMIT 1", (user_id,))
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
        SELECT datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min,
               rem_sov_min, somnpoang, somn_kvalitet
        FROM sleep_daily WHERE user_id = {ph}
        ORDER BY datum DESC LIMIT 7
    """, (user_id,))
    sömn_dagar = c.fetchall()

    c.execute(f"""
        SELECT datum, poang, niva, feedback, somn_faktor, somnhistorik_faktor,
               aterhamtning_faktor, aterhamtning_min, belastning_faktor, akut_belastning,
               stress_faktor, hrv_faktor, uppdaterad
        FROM readiness_daily WHERE user_id = {ph}
        ORDER BY datum DESC LIMIT 7
    """, (user_id,))
    readiness = c.fetchall()

    c.execute(f"""
        SELECT datum, snitt_puls, max_puls, duration_min, zon1_sek, zon2_sek, zon3_sek, zon4_sek, zon5_sek
        FROM activities WHERE user_id = {ph} ORDER BY datum
    """, (user_id,))
    alla_pass = [dict(r) for r in c.fetchall()]
    belastning_serie = daglig_serie(alla_pass, maxpuls(alla_pass))[-28:]

    c.execute(f"""SELECT start, slut, ok, kalla FROM sync_log
                  WHERE user_id = {ph} AND slut IS NOT NULL ORDER BY start DESC LIMIT 1""", (user_id,))
    senaste_synk = c.fetchone()

    c.execute(f"""
        SELECT datum, hrv_natt, hrv_7d, hrv_baslinje_lag, hrv_baslinje_hog, hrv_status
        FROM sleep_daily WHERE user_id = {ph} AND hrv_natt IS NOT NULL
        ORDER BY datum DESC LIMIT 14
    """, (user_id,))
    hrv = c.fetchall()

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
        "veckans_aktiviteter": veckans,
        "veckans_start": måndag,
        "sömn": dict(sömn_dagar[0]) if sömn_dagar else {},
        "sömn_vecka": [dict(s) for s in sömn_dagar],
        "race_predictions": dict(predictions) if predictions else {},
        "readiness": [dict(r) for r in readiness],
        "hrv": [dict(h) for h in hrv],
        "belastning": belastning_serie,
        "senaste_synk": {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in dict(senaste_synk).items()} if senaste_synk else None,
    }

class TypRequest(BaseModel):
    typ: Optional[str] = None  # None = återställ till Garmins/automatisk typ


@router.get("/aktivitetstyper")
def get_aktivitetstyper():
    return KATEGORIER


@router.patch("/activities/{activity_id}/typ")
def set_aktivitetstyp(activity_id: int, req: TypRequest, db=Depends(get_db), user=Depends(get_current_user)):
    if req.typ is not None and req.typ not in KATEGORIER:
        raise HTTPException(status_code=400, detail="Okänd aktivitetstyp")
    c = db.cursor()
    c.execute(
        f"UPDATE activities SET typ_manuell = {ph} WHERE activity_id = {ph} AND user_id = {ph}",
        (req.typ, activity_id, user["user_id"]))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="Aktiviteten hittades inte")
    db.commit()
    return {"ok": True, "typ": req.typ}
