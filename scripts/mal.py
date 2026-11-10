"""Mål — delad beskrivning för API och coachens kontext."""
from datetime import date

TYPER = {"grundtraning": "Grundträning", "lopp": "Lopp", "forsasong": "Försäsong", "halsa": "Hälsa"}
FOKUS = {"kondition": "kondition", "styrka": "styrka", "rorlighet": "rörlighet", "snabbhet": "snabbhet"}
DAGAR = {"man": "mån", "tis": "tis", "ons": "ons", "tor": "tor", "fre": "fre", "lor": "lör", "son": "sön"}


def beskriv(m, idag=None):
    """Mål som textrader för coachens kontext."""
    idag = idag or date.today()
    rader = [f"  {TYPER.get(m['typ'], m['typ'])}: {m['titel']}"]
    if m.get("slutdatum"):
        try:
            kvar = (date.fromisoformat(m["slutdatum"]) - idag).days
            etikett = {"lopp": "Loppdag", "forsasong": "Säsongsstart"}.get(m["typ"], "Fram till")
            rader.append(f"  {etikett}: {m['slutdatum']} ({kvar} dagar kvar, ≈ {round(kvar / 7)} veckor)")
        except ValueError:
            pass
    if m.get("distans_km"):
        rader.append(f"  Distans: {m['distans_km']} km" + (f" | måltid {m['maltid']}" if m.get("maltid") else ""))
    if m.get("sport"):
        rader.append(f"  Sport: {m['sport']}")
    if m.get("fokus"):
        rader.append("  Fokus: " + ", ".join(FOKUS.get(f, f) for f in m["fokus"].split(",") if f))
    fördelning = []
    if m.get("kondition_per_vecka") is not None:
        fördelning.append(f"{m['kondition_per_vecka']} konditionspass")
    if m.get("styrka_per_vecka") is not None:
        fördelning.append(f"{m['styrka_per_vecka']} styrkepass")
    if fördelning:
        rader.append(f"  Önskad fördelning per vecka: {' + '.join(fördelning)}")
    if m.get("traningsdagar"):
        rader.append("  Kan träna: " + ", ".join(DAGAR.get(d, d) for d in m["traningsdagar"].split(",") if d))
    if m.get("anteckning"):
        rader.append(f"  Atletens anteckning: {m['anteckning']}")
    return rader
