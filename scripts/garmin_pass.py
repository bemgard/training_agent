"""Fas 3: konverterar ett planerat pass (format från scripts/plan.py) till ett Garmin Connect-workout.

ID:n följer Garmins workout-service (inte konstanterna i garminconnect/workout.py, som delvis är fel —
biblioteket noterar själv att simning måste vara sporttyp 4). Verifiera mot ett riktigt konto med
scripts/probe_garmin_pass.py innan ändringar här skickas till användare."""
import re

SPORT = {
    "running": {"sportTypeId": 1, "sportTypeKey": "running", "displayOrder": 1},
    "cycling": {"sportTypeId": 2, "sportTypeKey": "cycling", "displayOrder": 2},
    "strength_training": {"sportTypeId": 5, "sportTypeKey": "strength_training", "displayOrder": 5},
}
KAN_SKICKAS = set(SPORT)

STEG = {
    "warmup": {"stepTypeId": 1, "stepTypeKey": "warmup", "displayOrder": 1},
    "cooldown": {"stepTypeId": 2, "stepTypeKey": "cooldown", "displayOrder": 2},
    "interval": {"stepTypeId": 3, "stepTypeKey": "interval", "displayOrder": 3},
    "recovery": {"stepTypeId": 4, "stepTypeKey": "recovery", "displayOrder": 4},
    "rest": {"stepTypeId": 5, "stepTypeKey": "rest", "displayOrder": 5},
    "repeat": {"stepTypeId": 6, "stepTypeKey": "repeat", "displayOrder": 6},
}
SLUT = {
    "lap.button": {"conditionTypeId": 1, "conditionTypeKey": "lap.button", "displayOrder": 1, "displayable": True},
    "time": {"conditionTypeId": 2, "conditionTypeKey": "time", "displayOrder": 2, "displayable": True},
    "distance": {"conditionTypeId": 3, "conditionTypeKey": "distance", "displayOrder": 3, "displayable": True},
    "iterations": {"conditionTypeId": 7, "conditionTypeKey": "iterations", "displayOrder": 7, "displayable": False},
    "reps": {"conditionTypeId": 10, "conditionTypeKey": "reps", "displayOrder": 10, "displayable": True},
}
MÅL = {
    "no.target": {"workoutTargetTypeId": 1, "workoutTargetTypeKey": "no.target", "displayOrder": 1},
    "heart.rate.zone": {"workoutTargetTypeId": 4, "workoutTargetTypeKey": "heart.rate.zone", "displayOrder": 4},
    "pace.zone": {"workoutTargetTypeId": 6, "workoutTargetTypeKey": "pace.zone", "displayOrder": 6},
}
PLANSTEG_TILL_GARMIN = {"uppvarmning": "warmup", "nedjogg": "cooldown", "vila": "rest",
                        "lugnt": "interval", "tempo": "interval", "backe": "interval", "intervall": "interval"}


def zonnummer(text):
    """'zon 4' → 4, 'zon 1–2' → 2 (övre gränsen), annars None."""
    tal = [int(t) for t in re.findall(r"\b([1-5])\b", text or "")]
    return max(tal) if tal else None


def tempo_till_ms(text):
    """'4:45/km' → m/s, annars None."""
    m = re.search(r"(\d{1,2}):(\d{2})", text or "")
    if not m:
        return None
    sek = int(m.group(1)) * 60 + int(m.group(2))
    return 1000 / sek if 120 <= sek <= 900 else None


def _mål(zon, tempo, föredra_tempo):
    """Pulszon (atletens egna zoner på klockan) eller tempointervall ±5 s/km."""
    ms = tempo_till_ms(tempo)
    z = zonnummer(zon)
    if ms and (föredra_tempo or not z):
        sek = 1000 / ms
        return {"targetType": MÅL["pace.zone"], "targetValueOne": round(1000 / (sek + 5), 4),
                "targetValueTwo": round(1000 / (sek - 5), 4)}
    if z:
        return {"targetType": MÅL["heart.rate.zone"], "zoneNumber": z}
    return {"targetType": MÅL["no.target"]}


def _slut(distans_km=None, minuter=None, sekunder=None, reps=None):
    if distans_km:
        return {"endCondition": SLUT["distance"], "endConditionValue": round(distans_km * 1000, 1)}
    if minuter or sekunder:
        return {"endCondition": SLUT["time"], "endConditionValue": float(round((minuter or 0) * 60 + (sekunder or 0)))}
    if reps:
        return {"endCondition": SLUT["reps"], "endConditionValue": float(reps)}
    return {"endCondition": SLUT["lap.button"]}


class _Räknare:
    def __init__(self):
        self.n = 0
        self.grupper = 0
        self.grupp = None   # childStepId för steg inuti aktuell upprepning

    def nästa(self):
        self.n += 1
        return self.n


def _steg(räknare, typ, slut, mål=None, beskrivning=None):
    s = {"type": "ExecutableStepDTO", "stepOrder": räknare.nästa(), "stepType": STEG[typ], **slut,
         **(mål or {"targetType": MÅL["no.target"]})}
    if beskrivning:
        s["description"] = beskrivning[:250]
    if räknare.grupp:
        s["childStepId"] = räknare.grupp
    return s


def _upprepa(räknare, antal, bygg_steg):
    grupp = {"type": "RepeatGroupDTO", "stepOrder": räknare.nästa(), "stepType": STEG["repeat"],
             "numberOfIterations": antal, "smartRepeat": False, "endCondition": SLUT["iterations"],
             "endConditionValue": float(antal)}
    räknare.grupper += 1
    grupp["childStepId"] = räknare.grupper
    räknare.grupp = räknare.grupper
    grupp["workoutSteps"] = bygg_steg()
    räknare.grupp = None
    return grupp


def _konditionssteg(r, plansteg):
    ut = []
    for s in plansteg:
        typ = PLANSTEG_TILL_GARMIN.get(s.get("typ"), "interval")
        kvalitet = s.get("typ") in ("intervall", "tempo", "backe")
        mål = _mål(s.get("zon"), s.get("tempo"), föredra_tempo=kvalitet)
        text = s.get("beskrivning")
        if s.get("typ") == "intervall" and (s.get("antal") or 1) > 1:
            def bygg(s=s, mål=mål, text=text):
                inre = [_steg(r, "interval", _slut(s.get("distans_km"), s.get("min")), mål, text)]
                if s.get("vila_min"):
                    inre.append(_steg(r, "recovery", _slut(minuter=s["vila_min"]), None, "Lugn jogg eller gång"))
                return inre
            ut.append(_upprepa(r, s["antal"], bygg))
        else:
            ut.append(_steg(r, typ, _slut(s.get("distans_km"), s.get("min")), None if typ == "rest" else mål, text))
    return ut


def _styrkesteg(r, övningar):
    ut = []
    for o in övningar:
        reps = o.get("reps") or ""
        sek = re.fullmatch(r"\s*(\d+)\s*s(ek)?\s*", reps)
        antal_reps = re.match(r"\s*(\d+)", reps)
        text = " · ".join(x for x in [o.get("namn"), f"{o.get('set')} × {reps}", o.get("belastning"), o.get("kommentar")] if x)
        def bygg(o=o, sek=sek, antal_reps=antal_reps, text=text):
            if sek:
                slut = _slut(sekunder=int(sek.group(1)))
            elif antal_reps and "/" not in reps:   # "10/arm" eller "8/ben" → lap-knapp, siffran stämmer inte per sida
                slut = _slut(reps=int(antal_reps.group(1)))
            else:
                slut = _slut()
            inre = [_steg(r, "interval", slut, None, text)]
            if o.get("vila_s"):
                inre.append(_steg(r, "rest", _slut(sekunder=o["vila_s"]), None, "Vila"))
            return inre
        ut.append(_upprepa(r, o.get("set") or 1, bygg))
    return ut


def till_garmin(p, steg=None, övningar=None):
    """p: pass-dict (kategori, titel, syfte, duration_min, distans_km, pulszon, tempo). steg/övningar som i plan.py.
    Returnerar workout-JSON för garminconnect.upload_workout. Kastar ValueError om passet inte kan skickas."""
    kategori = p.get("kategori")
    if kategori not in KAN_SKICKAS:
        raise ValueError("Bara löpning, cykling och styrka kan skickas till Garmin")
    r = _Räknare()
    if kategori == "strength_training":
        if not övningar:
            raise ValueError("Styrkepasset saknar övningar")
        workoutsteg = _styrkesteg(r, övningar)
    elif steg:
        workoutsteg = _konditionssteg(r, steg)
    else:
        # Pass utan steg: ett steg med passets distans eller tid och mål
        workoutsteg = [_steg(r, "interval", _slut(p.get("distans_km"), p.get("duration_min")),
                             _mål(p.get("pulszon"), p.get("tempo"), föredra_tempo=False))]
    sport = SPORT[kategori]
    return {
        "workoutName": (p.get("titel") or "Pass")[:60],
        "description": ((p.get("syfte") or "") + " (från AI-coachen)").strip()[:500],
        "sportType": sport,
        "estimatedDurationInSecs": int((p.get("duration_min") or 0) * 60),
        "workoutSegments": [{"segmentOrder": 1, "sportType": sport, "workoutSteps": workoutsteg}],
    }
