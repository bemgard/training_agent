"""Dagsform/kroppskänsla: självrapporterade symtom och besvär + tidig sjukdomsvarning från klockans data.
Används av /api/dagsform och coachens kontext så att båda tolkar likadant."""
from datetime import date
from statistics import median

ALLMANT = {"pigg": "Pigg", "okej": "Okej", "trott": "Trött", "krasslig": "Krasslig"}

# Symtom ovanför halsen vs systemiska/under halsen — styr coachens regler
SYMTOM = {
    "snuva": ("Snuva", "ovan"),
    "halsont": ("Ont i halsen", "ovan"),
    "hosta": ("Hosta", "under"),
    "feber": ("Feber", "systemisk"),
    "kroppsvark": ("Värk i kroppen", "systemisk"),
    "illamaende": ("Illamående/magont", "systemisk"),
}

KROPPSDELAR = {
    "vad": "Vad", "halsena": "Hälsena", "fot_hal": "Fot/häl", "knä": "Knä",
    "baksida_lar": "Baksida lår", "framsida_lar": "Framsida lår", "ljumske": "Ljumske", "hoft": "Höft",
    "landrygg": "Ländrygg", "ovre_rygg": "Övre rygg/nacke", "axel": "Axel", "arm": "Armbåge/handled", "annat": "Annat",
}

BESVARSTYP = {
    "traningsvark": "Träningsvärk",
    "stelhet": "Stelhet",
    "skarp": "Skarp smärta",
    "loppsteg": "Påverkar löpsteget",
}


def dag_nummer(start_datum, idag):
    return (idag - date.fromisoformat(start_datum)).days + 1


def sjukvarning(nätter):
    """nätter: lista med dicts (datum, hudtemp_avvikelse, hrv_natt, vilopuls_natt), nyast först.
    Jämför senaste natten mot de 14 nätterna innan. Returnerar None eller en dict med signalerna.
    Varning kräver minst 2 av 3: hudtemp ≥ +0,5 °C, HRV < 75 % av normalt, vilopuls ≥ normalt + 4."""
    if len(nätter) < 8:
        return None
    senast, före = nätter[0], nätter[1:15]

    def normal(fält):
        v = [n[fält] for n in före if n.get(fält) is not None]
        return median(v) if len(v) >= 7 else None

    signaler = []
    temp = senast.get("hudtemp_avvikelse")
    if temp is not None and temp >= 0.5:
        signaler.append(f"hudtemperatur {temp:+.1f} °C mot normalt")
    hrv, hrv_norm = senast.get("hrv_natt"), normal("hrv_natt")
    if hrv is not None and hrv_norm and hrv < 0.75 * hrv_norm:
        signaler.append(f"HRV {round(hrv)} ms mot normalt {round(hrv_norm)} ms")
    vp, vp_norm = senast.get("vilopuls_natt"), normal("vilopuls_natt")
    if vp is not None and vp_norm and vp >= vp_norm + 4:
        signaler.append(f"vilopuls {round(vp)} mot normalt {round(vp_norm)}")
    if len(signaler) < 2:
        return None
    return {"datum": senast["datum"], "signaler": signaler, "stark": len(signaler) == 3}


def _symtomtext(nyckel):
    namn, var = SYMTOM.get(nyckel, (nyckel, "systemisk"))
    return f"{namn} ({'ovanför halsen' if var == 'ovan' else 'under halsen' if var == 'under' else 'systemiskt'})"


def beskriv(rapporter, besvär, varning, idag):
    """rapporter: dagsform-rader senaste dagarna (nyast först); besvär: aktiva besvär."""
    rader = []
    if not rapporter or rapporter[0]["datum"] != idag.isoformat():
        rader.append("  Ingen dagsform rapporterad idag.")
    for r in rapporter:
        dagar = (idag - date.fromisoformat(r["datum"])).days
        när = "IDAG" if dagar == 0 else ("igår" if dagar == 1 else f"för {dagar} dagar sedan")
        delar = []
        if r.get("allmant"):
            delar.append(f"känner sig {ALLMANT.get(r['allmant'], r['allmant']).lower()}")
        symtom = [s for s in (r.get("symtom") or "").split(",") if s]
        if symtom:
            delar.append("symtom: " + ", ".join(_symtomtext(x) for x in symtom))
        elif r.get("allmant"):
            delar.append("inga sjukdomssymtom")
        if r.get("temp"):
            delar.append(f"uppmätt temp {r['temp']:.1f} °C")
        if r.get("fritext"):
            delar.append(f'"{r["fritext"]}"')
        rader.append(f"  {när} ({r['datum']}): " + " | ".join(delar))
    for b in besvär:
        dag = dag_nummer(b["start_datum"], idag)
        trend = "" if b["niva"] == b["niva_start"] else f" (började {b['niva_start']}/10)"
        senast = "" if b["senast_datum"] == idag.isoformat() else f", senast uppdaterad {b['senast_datum']}"
        txt = f"  Pågående besvär: {KROPPSDELAR.get(b['kroppsdel'], b['kroppsdel'])} · {BESVARSTYP.get(b['typ'], b['typ'])} · dag {dag} · {b['niva']}/10{trend}{senast}"
        if b.get("anteckning"):
            txt += f' — "{b["anteckning"]}"'
        rader.append(txt)
    if varning:
        rader.append(f"  ⚠️ Tidig sjukdomssignal natten mot {varning['datum']}: " + ", ".join(varning["signaler"])
                     + (" — alla tre signalerna" if varning["stark"] else ""))
    return rader
