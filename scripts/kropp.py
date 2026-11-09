"""Kroppsberäkningar. BMI är exakt; fettprocent uppskattas med Deurenberg et al. (1991):
    fett% = 1.20 × BMI + 0.23 × ålder − 10.8 × kön(man=1) − 5.4
Formeln har ca ±4–5 procentenheters fel och överskattar fett hos muskulösa personer.
Muskelmassa uppskattas inte — fettfri massa (vikt − fett) är inte samma sak."""
from datetime import date


def bmi(vikt_kg, langd_cm):
    if not vikt_kg or not langd_cm:
        return None
    return round(vikt_kg / (langd_cm / 100) ** 2, 1)


def ålder_vid(datum_str, fodelsear):
    if not fodelsear:
        return None
    år = int(datum_str[:4]) if datum_str else date.today().year
    return år - fodelsear


def beräkna(rad, langd_cm, fodelsear, kon):
    """rad: dict med datum, vikt_kg, fett_procent, muskel_kg. Returnerar berikad dict."""
    d = dict(rad)
    d["bmi"] = bmi(d["vikt_kg"], langd_cm)
    if d.get("fett_procent") is not None:
        d["fett_procent_uppskattad"] = False
    else:
        ålder = ålder_vid(d.get("datum"), fodelsear)
        if d["bmi"] and ålder and kon in ("man", "kvinna"):
            d["fett_procent"] = round(1.20 * d["bmi"] + 0.23 * ålder - 10.8 * (kon == "man") - 5.4, 1)
            d["fett_procent_uppskattad"] = True
        else:
            d["fett_procent_uppskattad"] = None  # går inte att räkna ut
    if d.get("fett_procent") is not None:
        d["fett_kg"] = round(d["vikt_kg"] * d["fett_procent"] / 100, 1)
        d["fettfri_kg"] = round(d["vikt_kg"] - d["fett_kg"], 1)
    else:
        d["fett_kg"] = d["fettfri_kg"] = None
    return d
