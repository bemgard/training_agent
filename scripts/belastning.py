"""Träningsbelastning med Edwards TRIMP (1993).

TRIMP per pass = Σ minuter i pulszon i × i   (zon 1–5, Garmins zoner)
Saknas zondata uppskattas zonen från snittpuls / maxpuls (50/60/70/80/90 %) × passtid.

Akut belastning   = summa TRIMP senaste 7 dagarna
Kronisk belastning = summa TRIMP senaste 28 dagarna / 4  (snitt per vecka)
ACWR              = akut / kronisk
  < 0.8   lägre än vanligt (formen kan sjunka över tid)
  0.8–1.3 optimal
  1.3–1.5 förhöjd skaderisk
  > 1.5   hög skaderisk (Gabbett 2016)"""
from datetime import datetime, timedelta


def trimp(pass_, hrmax=None):
    zoner = [pass_.get(f"zon{i}_sek") or 0 for i in range(1, 6)]
    if sum(zoner) > 0:
        return round(sum(sek / 60 * (i + 1) for i, sek in enumerate(zoner)), 1)
    puls, minuter = pass_.get("snitt_puls"), pass_.get("duration_min")
    if puls and minuter and hrmax:
        andel = puls / hrmax
        zon = 0 if andel < 0.5 else min(5, int((andel - 0.5) / 0.1) + 1)
        return round(minuter * zon, 1)
    return None


def acwr_zon(acwr):
    if acwr is None:
        return None
    if acwr < 0.8:
        return "låg"
    if acwr <= 1.3:
        return "optimal"
    if acwr <= 1.5:
        return "förhöjd"
    return "hög"


def daglig_serie(pass_lista, hrmax, till=None):
    """pass_lista: dicts med datum + zon/puls-fält. Returnerar en rad per dag från första passet till `till`."""
    per_dag = {}
    for p in pass_lista:
        t = trimp(p, hrmax)
        if t:
            per_dag[p["datum"]] = per_dag.get(p["datum"], 0) + t
    if not per_dag:
        return []
    start = datetime.strptime(min(per_dag), "%Y-%m-%d")
    slut = datetime.strptime(till or datetime.now().strftime("%Y-%m-%d"), "%Y-%m-%d")
    dagar = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range((slut - start).days + 1)]
    laster = [per_dag.get(d, 0) for d in dagar]
    serie = []
    for i, d in enumerate(dagar):
        akut = sum(laster[max(0, i - 6): i + 1])
        kronisk = sum(laster[max(0, i - 27): i + 1]) / 4
        fullt = i >= 27  # kronisk är först meningsfull efter 4 veckors historik
        acwr = round(akut / kronisk, 2) if fullt and kronisk > 0 else None
        serie.append({"datum": d, "trimp": round(laster[i], 1), "akut": round(akut), "kronisk": round(kronisk) if fullt else None,
                      "acwr": acwr, "zon": acwr_zon(acwr)})
    return serie


def maxpuls(pass_lista):
    """98:e percentilen av maxpuls i pass med hög intensitet (löpning, fotboll, HIIT m.fl.)."""
    v = sorted(p["max_puls"] for p in pass_lista if p.get("max_puls"))
    if len(v) < 5:
        return None
    return v[min(len(v) - 1, int(len(v) * 0.98))]
