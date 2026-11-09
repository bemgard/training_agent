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


def effektiv_typ(typ, plats=None, distans_km=None, duration_min=None, snitt_puls=None, typ_manuell=None):
    """Returnerar (kategori, gissad). kategori är None om passet inte går att klassa."""
    if typ_manuell:
        return typ_manuell, False

    plats = (plats or "").lower()
    distans_km = distans_km or 0
    if "täby" in plats and typ in ("running", "treadmill_running") and distans_km < 10:
        return "football", False  # fotbollsplanen i Täby loggas som löpning

    if typ in _GARMIN:
        return _GARMIN[typ], False

    if typ in OKLASSAD:
        # Cirqans "Schemalagd aktivitet": lång tid, nästan ingen distans, låg puls → styrka
        if distans_km < 1 and (duration_min or 0) >= 20 and (snitt_puls or 0) < 115:
            return "strength_training", True
        return None, False

    return "other", False
