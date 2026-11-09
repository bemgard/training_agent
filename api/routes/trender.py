from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from api.database import get_db, USE_SQLITE
from api.routes.auth import verifiera_token
from scripts.aktivitetstyp import effektiv_typ
from scripts.vo2_estimat import uppskatta

router = APIRouter()
ph = "?" if USE_SQLITE else "%s"


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inte inloggad")
    return verifiera_token(authorization.split(" ")[1])


def rullande(rader, fält, dagar=7):
    """Lägger till '<fält>_snitt' = medel av värden inom senaste `dagar` kalenderdagar."""
    datum = [datetime.strptime(r["datum"], "%Y-%m-%d") for r in rader]
    for i, r in enumerate(rader):
        fönster = [rader[j][fält] for j in range(i + 1)
                   if rader[j][fält] is not None and (datum[i] - datum[j]).days < dagar]
        r[f"{fält}_snitt"] = round(sum(fönster) / len(fönster), 1) if fönster else None
    return rader


@router.get("/trender")
def get_trender(dagar: Optional[int] = 365, db=Depends(get_db), user=Depends(get_current_user)):
    c = db.cursor()
    uid = user["user_id"]
    från = (datetime.now() - timedelta(days=dagar)).strftime("%Y-%m-%d") if dagar else "0000-00-00"
    # Hämta lite extra bakåt så att rullande snitt är fullt redan i periodens början
    från_buffer = (datetime.strptime(från, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d") if dagar else från

    def hämta(sql, params):
        c.execute(sql, params)
        return [dict(r) for r in c.fetchall()]

    def i_period(rader):
        return [r for r in rader if r["datum"] >= från]

    # Vilopuls (hela historiken behövs för VO2max-uppskattningen)
    hälsa = hämta(f"SELECT datum, vilpuls FROM health_daily WHERE user_id = {ph} ORDER BY datum", (uid,))
    vilopuls_per_dag = {r["datum"]: r["vilpuls"] for r in hälsa}
    vilopuls = i_period(rullande([r for r in hälsa if r["datum"] >= från_buffer and r["vilpuls"]], "vilpuls"))

    sömn = hämta(f"""
        SELECT datum, sovtid_min, somnpoang, hrv_natt, hrv_7d, hrv_baslinje_lag, hrv_baslinje_hog, hrv_status
        FROM sleep_daily WHERE user_id = {ph} AND datum >= {ph} ORDER BY datum
    """, (uid, från_buffer))
    sömn_serie = i_period(rullande([{"datum": r["datum"], "sovtid_min": r["sovtid_min"], "somnpoang": r["somnpoang"]}
                                    for r in sömn], "sovtid_min"))
    hrv = i_period([{k: r[k] for k in ("datum", "hrv_natt", "hrv_7d", "hrv_baslinje_lag", "hrv_baslinje_hog", "hrv_status")}
                    for r in sömn if r["hrv_natt"] is not None])

    readiness = i_period(rullande(hämta(
        f"SELECT datum, poang FROM readiness_daily WHERE user_id = {ph} AND datum >= {ph} ORDER BY datum",
        (uid, från_buffer)), "poang"))

    vo2_garmin = hämta(f"SELECT datum, vo2max FROM vo2max_history WHERE user_id = {ph} AND datum >= {ph} ORDER BY datum",
                       (uid, från))

    aktiviteter = hämta(f"""
        SELECT datum, typ, typ_manuell, plats, distans_km, duration_min, snitt_puls, max_puls, elevation_gain
        FROM activities WHERE user_id = {ph} ORDER BY datum
    """, (uid,))
    for a in aktiviteter:
        a["kategori"], _ = effektiv_typ(a["typ"], a["plats"], a["distans_km"], a["duration_min"], a["snitt_puls"], a["typ_manuell"])
    löppass = [a for a in aktiviteter if a["kategori"] == "running"]
    vo2_egen = i_period(uppskatta(löppass, vilopuls_per_dag))

    # Träningsvolym per vecka (måndag) och kategori
    veckor = {}
    for a in aktiviteter:
        if a["datum"] < från:
            continue
        d = datetime.strptime(a["datum"], "%Y-%m-%d")
        vecka = (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")
        k = a["kategori"] or "oklassad"
        veckor.setdefault(vecka, {}).setdefault(k, 0)
        veckor[vecka][k] += a["duration_min"] or 0
    volym = [{"vecka": v, "per_kategori": {k: round(m) for k, m in kat.items()}, "totalt": round(sum(kat.values()))}
             for v, kat in sorted(veckor.items())]

    return {
        "från": från if dagar else (min([r["datum"] for r in vilopuls] or [None]) if vilopuls else None),
        "vilopuls": vilopuls,
        "hrv": hrv,
        "vo2max": {"garmin": vo2_garmin, "egen": vo2_egen},
        "somn": sömn_serie,
        "readiness": readiness,
        "volym": volym,
    }


@router.get("/somn")
def get_somn(dagar: Optional[int] = 30, db=Depends(get_db), user=Depends(get_current_user)):
    från = (datetime.now() - timedelta(days=dagar)).strftime("%Y-%m-%d") if dagar else "0000-00-00"
    c = db.cursor()
    c.execute(f"""
        SELECT datum, sovtid_min, djup_sov_min, latt_sov_min, rem_sov_min, vaken_min,
               somnpoang, somn_kvalitet, hrv_natt, vilopuls_natt, andning_snitt, somnstress,
               bb_laddning, hudtemp_avvikelse
        FROM sleep_daily WHERE user_id = {ph} AND datum >= {ph} AND sovtid_min IS NOT NULL
        ORDER BY datum
    """, (user["user_id"], från))
    return [dict(r) for r in c.fetchall()]
