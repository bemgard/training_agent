"""Gemensam klassning av aktiviteter — används av /api/profile och coachens kontext,
så att dashboard och coach alltid är överens om vilken typ ett pass är."""

# Kategorier som appen känner till (användaren kan välja bland dessa)
KATEGORIER = {
    "running": "Löpning",
    "football": "Fotboll",
    "strength_training": "Styrketräning",
    "hiit": "HIIT",
    "cardio": "Cardio",
    "cycling": "Cykling",
    "skiing": "Skidor",
    "walking": "Promenad",
    "hiking": "Vandring",
    "golf": "Golf",
    "padel": "Padel",
    "other": "Övrigt",
}

# Garmins typnycklar → appens kategorier
_GARMIN = {
    "running": "running", "treadmill_running": "running", "trail_running": "running",
    "soccer": "football", "football": "football",
    "strength_training": "strength_training",
    "hiit": "hiit",
    "indoor_cardio": "cardio", "elliptical": "cardio",
    "cycling": "cycling", "indoor_cycling": "cycling", "road_biking": "cycling",
    "cross_country_skiing_ws": "skiing", "resort_skiing_snowboarding_ws": "skiing",
    "walking": "walking", "hiking": "hiking", "golf": "golf", "padel": "padel",
}

OKLASSAD = {"stop_watch", "other", "", None}


def hämta_regler(cursor, user_id, ph):
    """Användarens egna klassningsregler (tabellen aktivitetsregler)."""
    if not user_id:
        return []
    cursor.execute(f"SELECT plats, fran_kategori, max_km, till_kategori FROM aktivitetsregler WHERE user_id = {ph}",
                   (user_id,))
    fält = ("plats", "fran_kategori", "max_km", "till_kategori")
    # Fungerar med tupler (psycopg2/sqlite3 standard), sqlite3.Row och RealDictCursor
    return [{f: (r[f] if isinstance(r, dict) else r[i]) for i, f in enumerate(fält)} for r in cursor.fetchall()]


def _matchar(regel, kategori, plats, distans_km):
    if kategori != regel["fran_kategori"]:
        return False
    if (regel["plats"] or "").strip().lower() not in plats:
        return False
    return regel["max_km"] is None or distans_km < regel["max_km"]


def effektiv_typ(typ, plats=None, distans_km=None, duration_min=None, snitt_puls=None, typ_manuell=None, regler=()):
    """Returnerar (kategori, gissad). kategori är None om passet inte går att klassa.
    Ordning: manuellt vald typ > användarens regler > Garmins typ > gissning."""
    if typ_manuell:
        return typ_manuell, False

    plats = (plats or "").lower()
    distans_km = distans_km or 0

    if typ in _GARMIN:
        kategori = _GARMIN[typ]
        for regel in regler:
            if _matchar(regel, kategori, plats, distans_km):
                return regel["till_kategori"], False
        return kategori, False

    if typ in OKLASSAD:
        # Cirqans "Schemalagd aktivitet": lång tid, nästan ingen distans, låg puls → styrka
        if distans_km < 1 and (duration_min or 0) >= 20 and (snitt_puls or 0) < 115:
            return "strength_training", True
        return None, False

    return "other", False
