"""Strukturerade träningsplaner: format (validering), avstämning mot Garmin-aktiviteter och text till coachen.
Delas av /api/planer och coachens kontext så att båda ser samma status."""
import json
from datetime import date, timedelta
from typing import Optional, Literal, List
from pydantic import BaseModel, Field, field_validator, model_validator

try:
    from scripts.aktivitetstyp import KATEGORIER, effektiv_typ
except ImportError:
    from aktivitetstyp import KATEGORIER, effektiv_typ

STEGTYPER = {
    "uppvarmning": "Uppvärmning", "lugnt": "Lugnt", "intervall": "Intervaller", "tempo": "Tempo",
    "backe": "Backintervaller", "nedjogg": "Nedvarvning", "vila": "Vila",
}
MAX_DAGAR_FRAMÅT = 28
MAX_PLANLÄNGD = 14


class Steg(BaseModel):
    typ: Literal["uppvarmning", "lugnt", "intervall", "tempo", "backe", "nedjogg", "vila"]
    min: Optional[float] = Field(default=None, gt=0, le=300)
    distans_km: Optional[float] = Field(default=None, gt=0, le=100)
    antal: Optional[int] = Field(default=None, ge=1, le=50)
    zon: Optional[str] = Field(default=None, max_length=30)
    tempo: Optional[str] = Field(default=None, max_length=40)
    vila_min: Optional[float] = Field(default=None, ge=0, le=30)
    beskrivning: Optional[str] = Field(default=None, max_length=200)


class Övning(BaseModel):
    namn: str = Field(min_length=1, max_length=80)
    set: int = Field(ge=1, le=10)
    reps: str = Field(min_length=1, max_length=30)
    belastning: Optional[str] = Field(default=None, max_length=60)
    vila_s: Optional[int] = Field(default=None, ge=0, le=600)
    kommentar: Optional[str] = Field(default=None, max_length=200)


class Pass(BaseModel):
    datum: str
    kategori: str
    titel: str = Field(min_length=1, max_length=80)
    syfte: Optional[str] = Field(default=None, max_length=400)
    duration_min: Optional[int] = Field(default=None, ge=5, le=400)
    distans_km: Optional[float] = Field(default=None, gt=0, le=100)
    pulszon: Optional[str] = Field(default=None, max_length=30)
    tempo: Optional[str] = Field(default=None, max_length=40)
    steg: List[Steg] = Field(default=[], max_length=20)
    ovningar: List[Övning] = Field(default=[], max_length=20)

    @field_validator("datum")
    @classmethod
    def giltigt_datum(cls, v):
        date.fromisoformat(v)
        return v

    @field_validator("kategori")
    @classmethod
    def giltig_kategori(cls, v):
        if v not in KATEGORIER:
            raise ValueError("okänd kategori")
        return v


class Plan(BaseModel):
    titel: str = Field(min_length=1, max_length=100)
    sammanfattning: Optional[str] = Field(default=None, max_length=1000)
    pass_: List[Pass] = Field(alias="pass", min_length=1, max_length=21)

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def rimliga_datum(self):
        datum = sorted(date.fromisoformat(p.datum) for p in self.pass_)
        if (datum[-1] - datum[0]).days >= MAX_PLANLÄNGD:
            raise ValueError(f"en plan får sträcka sig över max {MAX_PLANLÄNGD} dagar")
        return self

    def kontrollera_mot(self, idag: date):
        for p in self.pass_:
            d = date.fromisoformat(p.datum)
            if d < idag - timedelta(days=1) or d > idag + timedelta(days=MAX_DAGAR_FRAMÅT):
                raise ValueError("passen måste ligga mellan igår och fyra veckor framåt")

    def intervall(self, idag: date):
        """Dagar som planen ersätter: ett pass → bara den dagen; flera → hela veckorna (mån–sön) som berörs,
        men aldrig bakåt i tiden."""
        datum = sorted(date.fromisoformat(p.datum) for p in self.pass_)
        if len(datum) == 1:
            return datum[0], datum[0]
        start = datum[0] - timedelta(days=datum[0].weekday())
        slut = datum[-1] + timedelta(days=6 - datum[-1].weekday())
        return max(start, idag), slut


def innehåll_json(p: Pass) -> Optional[str]:
    if p.steg:
        return json.dumps({"steg": [s.model_dump(exclude_none=True) for s in p.steg]}, ensure_ascii=False)
    if p.ovningar:
        return json.dumps({"ovningar": [o.model_dump(exclude_none=True) for o in p.ovningar]}, ensure_ascii=False)
    return None


def läs_innehåll(text):
    try:
        d = json.loads(text) if text else {}
    except (ValueError, TypeError):
        d = {}
    return d.get("steg", []), d.get("ovningar", [])


def stäm_av(planerade, aktiviteter, idag: date, regler=()):
    """planerade: dicts (id, datum, kategori, activity_id …); aktiviteter: dicts med activity_id, datum, typ, plats,
    distans_km, duration_min, snitt_puls, typ_manuell. Matchar varje pass mot en aktivitet samma dag med samma
    kategori (manuell koppling via activity_id går först). Returnerar (pass med status/utfört, omatchade aktiviteter)."""
    for a in aktiviteter:
        a["kategori"], _ = effektiv_typ(a.get("typ"), a.get("plats"), a.get("distans_km"), a.get("duration_min"),
                                        a.get("snitt_puls"), a.get("typ_manuell"), regler)
    använda = set()
    per_id = {a["activity_id"]: a for a in aktiviteter}
    ut = []
    # Manuellt kopplade först, sedan i datumordning
    for p in sorted(planerade, key=lambda p: (p.get("activity_id") is None, p["datum"])):
        träff = None
        if p.get("activity_id") in per_id and p["activity_id"] not in använda:
            träff = per_id[p["activity_id"]]
        else:
            kandidater = [a for a in aktiviteter if a["datum"] == p["datum"] and a["activity_id"] not in använda
                          and a["kategori"] == p.get("kategori")]
            if kandidater:
                träff = max(kandidater, key=lambda a: a.get("duration_min") or 0)
        d = date.fromisoformat(p["datum"])
        if träff:
            använda.add(träff["activity_id"])
            status = "genomford"
        elif d < idag:
            status = "missad"
        elif d == idag:
            status = "idag"
        else:
            status = "kommande"
        ut.append({**p, "status": status, "utfort": _utfört(träff) if träff else None})
    ut.sort(key=lambda p: (p["datum"], p.get("id") or 0))
    omatchade = [_utfört(a) for a in aktiviteter if a["activity_id"] not in använda]
    return ut, omatchade


def _utfört(a):
    return {k: a.get(k) for k in ("activity_id", "datum", "namn", "kategori", "distans_km", "duration_min", "snitt_puls")}


STATUSTEXT = {"genomford": "GENOMFÖRT", "missad": "MISSAT", "idag": "IDAG", "kommande": "kommande"}


def beskriv(pass_med_status, omatchade, plan_titel, idag: date):
    """Text till coachen: planerade pass senaste 7 dagarna + kommande 7, med avstämning."""
    if not pass_med_status:
        return ["  Ingen sparad plan för perioden — föreslå gärna en veckoplan om atleten ber om ett schema."]
    rader = []
    if plan_titel:
        rader.append(f"  Aktuell plan: {plan_titel}")
    for p in pass_med_status:
        mål = " | ".join(x for x in [
            f"{p['distans_km']:g} km" if p.get("distans_km") else None,
            f"{p['duration_min']} min" if p.get("duration_min") else None,
            p.get("pulszon"), p.get("tempo")] if x)
        rad = f"  {p['datum']} [{STATUSTEXT[p['status']]}] {KATEGORIER.get(p.get('kategori'), p.get('kategori') or '?')}: {p.get('titel') or p.get('typ')}"
        if mål:
            rad += f" ({mål})"
        u = p.get("utfort")
        if u:
            gjort = " | ".join(x for x in [
                f"{u['distans_km']:g} km" if u.get("distans_km") else None,
                f"{round(u['duration_min'])} min" if u.get("duration_min") else None,
                f"puls {u['snitt_puls']}" if u.get("snitt_puls") else None] if x)
            rad += f" → gjort: {gjort}"
        rader.append(rad)
    extra = [a for a in omatchade if a["datum"] <= idag.isoformat()]
    for a in extra:
        rader.append(f"  {a['datum']} [OPLANERAT] {KATEGORIER.get(a['kategori'], 'Oklassat pass') if a['kategori'] else 'Oklassat pass'}"
                     f" {round(a.get('duration_min') or 0)} min")
    return rader
