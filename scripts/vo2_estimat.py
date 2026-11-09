"""Egen VO2max-uppskattning från löppass (puls + tempo).

Metod:
  1. Syrebehov vid passets tempo enligt ACSM:s löpformel: VO2 = 0.2 × v + 3.5  (v i m/min, plan mark)
  2. Ansträngning som andel av pulsreserven: %HRR = (snittpuls − vilopuls) / (maxpuls − vilopuls)
     %HRR ≈ %VO2-reserv (Swain & Leutholtz 1997)
  3. VO2max = (VO2 − 3.5) / %HRR + 3.5

Enskilda pass har ±3–5 ml/kg/min fel (backar, värme, pulsdrift, fel maxpuls) → använd rullande median.
Bara lugna–medelhårda, någorlunda platta pass på ≥ 20 min och ≥ 3 km tas med."""
from datetime import datetime, timedelta
from statistics import median


def maxpuls(löppass):
    """98:e percentilen av maxpuls i löppass — robust mot enstaka felmätningar."""
    värden = sorted(p["max_puls"] for p in löppass if p.get("max_puls"))
    if len(värden) < 5:
        return None
    return värden[min(len(värden) - 1, int(len(värden) * 0.98))]


def vilopuls_runt(vilopuls_per_dag, datum, fönster=15):
    d = datetime.strptime(datum, "%Y-%m-%d")
    värden = [v for k, v in vilopuls_per_dag.items()
              if v and abs((datetime.strptime(k, "%Y-%m-%d") - d).days) <= fönster]
    return median(värden) if värden else None


def uppskatta(löppass, vilopuls_per_dag, fönster_median=5):
    """löppass: dicts med datum, distans_km, duration_min, snitt_puls, max_puls, elevation_gain.
    Returnerar [{datum, uppskattning, trend}] sorterat på datum."""
    hrmax = maxpuls(löppass)
    if not hrmax:
        return []
    ut = []
    for p in sorted(löppass, key=lambda x: x["datum"]):
        km, minuter, puls = p.get("distans_km") or 0, p.get("duration_min") or 0, p.get("snitt_puls")
        if km < 3 or minuter < 20 or not puls:
            continue
        if (p.get("elevation_gain") or 0) / km >= 15:
            continue  # för kuperat — formeln antar plan mark
        vila = vilopuls_runt(vilopuls_per_dag, p["datum"])
        if not vila or hrmax - vila < 40:
            continue
        hrr = (puls - vila) / (hrmax - vila)
        if not 0.5 <= hrr <= 0.92:
            continue  # för lugnt (osäkert) eller nära max (anaerobt)
        v = km * 1000 / minuter
        vo2max = (0.2 * v) / hrr + 3.5
        if 25 <= vo2max <= 90:
            ut.append({"datum": p["datum"], "uppskattning": round(vo2max, 1)})
    for i, r in enumerate(ut):
        fönster = [x["uppskattning"] for x in ut[max(0, i - fönster_median + 1): i + 1]]
        r["trend"] = round(median(fönster), 1)
    return ut
