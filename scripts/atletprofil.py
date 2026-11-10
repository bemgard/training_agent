"""'Om mig' — atletens egna bakgrundsuppgifter och klassningsregler, som text till coachen."""

ERFARENHET = {
    "nyborjare": "Nybörjare (tränat regelbundet mindre än ett år)",
    "motionar": "Motionär (tränar regelbundet sedan några år)",
    "van": "Van (strukturerad träning i många år)",
    "elit": "Elit/tävlingsnivå",
}

UTRUSTNING = {
    "gym": "Gym med fria vikter och maskiner",
    "hemmagym": "Hemmagym/enklare vikter",
    "kettlebell": "Kettlebell",
    "gummiband": "Gummiband",
    "lopband": "Löpband",
    "cykel": "Cykel/cykeltrainer",
    "pool": "Simhall",
}


def beskriv(atlet, regler=(), kategorier=None):
    kategorier = kategorier or {}
    rader = []
    a = atlet or {}
    if a.get("erfarenhet"):
        rader.append(f"  Erfarenhet: {ERFARENHET.get(a['erfarenhet'], a['erfarenhet'])}")
    if a.get("sporter"):
        rader.append(f"  Sporter/bakgrund: {a['sporter']}")
    utr = [u for u in (a.get("utrustning") or "").split(",") if u]
    if utr:
        rader.append("  Tillgänglig utrustning: " + ", ".join(UTRUSTNING.get(u, u) for u in utr)
                     + " — föreslå bara övningar som går att göra med detta")
    if a.get("skador"):
        rader.append(f"  Skador/historik: {a['skador']} — anpassa övningsval och belastning efter detta")
    if a.get("preferenser"):
        rader.append(f"  Preferenser: {a['preferenser']}")
    if a.get("fritext"):
        rader.append(f"  Övrigt från atleten: {a['fritext']}")
    for r in regler:
        gräns = f" och kortare än {r['max_km']:g} km" if r.get("max_km") is not None else ""
        rader.append(f"  Klassningsregel: pass i {r['plats']} som Garmin loggar som "
                     f"{kategorier.get(r['fran_kategori'], r['fran_kategori'])}{gräns} är egentligen "
                     f"{kategorier.get(r['till_kategori'], r['till_kategori'])} (redan omklassat i datan nedan)")
    if not rader:
        rader.append("  Inga uppgifter ifyllda — anta inget om skador eller utrustning; fråga hellre om det behövs för ett styrkepass.")
    return rader
