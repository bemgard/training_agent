"""Engångstest för fas 3: laddar upp två testpass (löpning med intervaller + styrka) till ditt Garmin-konto,
läser tillbaka hur Garmin tolkade dem, jämför och TAR BORT dem igen. Inget schemaläggs i kalendern.

Kör lokalt (Garmin och Supabase nås inte från molnet):
    .venv/bin/python scripts/probe_garmin_pass.py            (användare 1)
    .venv/bin/python scripts/probe_garmin_pass.py 3          (annan användare)
    .venv/bin/python scripts/probe_garmin_pass.py 1 --behall (låt passen ligga kvar så du kan titta i Garmin Connect)"""
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE = Path(__file__).parent.parent
load_dotenv(BASE / ".env")
sys.path.insert(0, str(BASE))
from api.garmin_klient import inloggad
from scripts.garmin_pass import till_garmin

LÖP = till_garmin({"kategori": "running", "titel": "TEST AI-coach intervaller", "syfte": "Testpass — tas bort automatiskt",
                   "duration_min": 45},
                  steg=[{"typ": "uppvarmning", "min": 10, "zon": "zon 1–2"},
                        {"typ": "intervall", "antal": 3, "min": 4, "zon": "zon 4", "tempo": "4:45/km", "vila_min": 2},
                        {"typ": "lugnt", "distans_km": 1.5, "zon": "zon 2"},
                        {"typ": "nedjogg", "min": 5, "zon": "zon 1"}])
STYRKA = till_garmin({"kategori": "strength_training", "titel": "TEST AI-coach styrka", "syfte": "Testpass", "duration_min": 30},
                     övningar=[{"namn": "Knäböj", "set": 3, "reps": "8", "belastning": "RPE 7", "vila_s": 90},
                               {"namn": "Planka", "set": 2, "reps": "30 s"}])


def platta(steg):
    for s in steg:
        yield s
        yield from platta(s.get("workoutSteps") or [])


def sammanfatta(w):
    ut = [f"sport={w['sportType'].get('sportTypeKey')}({w['sportType'].get('sportTypeId')})"]
    for s in platta(w["workoutSegments"][0]["workoutSteps"]):
        ut.append(" | ".join(str(x) for x in [
            s.get("stepOrder"), s.get("type"), (s.get("stepType") or {}).get("stepTypeKey"),
            (s.get("endCondition") or {}).get("conditionTypeKey"), s.get("endConditionValue"),
            (s.get("targetType") or {}).get("workoutTargetTypeKey"), s.get("zoneNumber"),
            s.get("targetValueOne"), s.get("targetValueTwo"), s.get("numberOfIterations"), s.get("description")]))
    return ut


def main():
    user_id = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 1
    behåll = "--behall" in sys.argv
    with inloggad(user_id) as g:
        print("✅ Inloggad på Garmin\n")
        alla_ok = True
        for namn, w in [("LÖPNING", LÖP), ("STYRKA", STYRKA)]:
            print(f"=== {namn} ===")
            try:
                svar = g.upload_workout(w)
            except Exception as e:
                alla_ok = False
                print(f"❌ Uppladdning nekades: {type(e).__name__}: {e}\n")
                continue
            wid = svar.get("workoutId")
            tillbaka = g.get_workout_by_id(wid)
            skickat, fått = sammanfatta(w), sammanfatta(tillbaka)
            for a, b in zip(skickat, fått):
                if a != b:
                    alla_ok = False
                print(("   " if a == b else "≠  ") + b + ("" if a == b else f"\n     skickat: {a}"))
            if len(skickat) != len(fått):
                alla_ok = False
                print(f"≠  antal steg: skickat {len(skickat)}, fått {len(fått)}")
            if behåll:
                print(f"   (ligger kvar i Garmin Connect → Träning → Pass, id {wid})\n")
            else:
                g.delete_workout(wid)
                print(f"   🗑  borttaget (id {wid})\n")
            (BASE / "logs").mkdir(exist_ok=True)
            (BASE / "logs" / f"garmin_probe_{namn.lower()}.json").write_text(json.dumps(tillbaka, indent=2, ensure_ascii=False))
        print("✅ Allt tolkades som skickat" if alla_ok else "⚠️  Avvikelser ovan (≠) — skicka utskriften till Claude")
        print("Fullständiga svar: logs/garmin_probe_*.json")


if __name__ == "__main__":
    main()
