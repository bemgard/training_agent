"""Read-only probe: dumpar rå Garmin-JSON för sömn/HRV/readiness till logs/probe/.
Rör inte databasen. Kör:  .venv/bin/python scripts/probe_garmin.py [YYYY-MM-DD]"""
import json, sys, getpass
from datetime import date, timedelta
from pathlib import Path
from garminconnect import Garmin

OUT = Path(__file__).parent.parent / "logs" / "probe"
OUT.mkdir(parents=True, exist_ok=True)

dag = sys.argv[1] if len(sys.argv) > 1 else (date.today() - timedelta(days=1)).isoformat()
TOKENS = Path.home() / ".garminconnect"  # garth-tokens sparas här efter första lyckade inloggning
if TOKENS.exists() and any(TOKENS.glob("*.json")):
    client = Garmin()
    client.login(str(TOKENS))          # återanvänder tokens, ingen ny inloggning
    print("🔑 Använde sparade tokens")
else:
    TOKENS.mkdir(exist_ok=True)
    client = Garmin(input("Garmin e-post: ").strip(), getpass.getpass("Garmin lösenord: "))
    mfa, _ = client.login(str(TOKENS))  # loggar in och sparar tokens till TOKENS
    if mfa:
        sys.exit("MFA krävs — säg till så lägger jag till stöd för det")

anrop = {
    "sleep": lambda: client.get_sleep_data(dag),
    "hrv": lambda: client.get_hrv_data(dag),
    "training_readiness": lambda: client.get_training_readiness(dag),
    "body_battery": lambda: client.get_body_battery(dag),
    "stats": lambda: client.get_stats(dag),
    "devices": lambda: client.get_devices(),
}
for namn, f in anrop.items():
    try:
        data = f()
        (OUT / f"{dag}_{namn}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str))
        print(f"✅ {namn}: {'tomt' if not data else 'ok'}")
    except Exception as e:
        print(f"⚠️  {namn}: {e}")
print(f"\nSparat i {OUT}")
