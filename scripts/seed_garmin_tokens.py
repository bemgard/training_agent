"""Engång: flyttar Garmin-tokens från ~/.garminconnect (skapade av probe_garmin.py)
till users.garmin_tokens, krypterat. Loggar INTE in mot Garmin.
Kör:  .venv/bin/python scripts/seed_garmin_tokens.py din@email.se"""
import os, sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")
sys.path.insert(0, str(BASE_DIR))

from garminconnect import Garmin
from api.auth import kryptera
import psycopg2

if len(sys.argv) != 2:
    sys.exit("Användning: seed_garmin_tokens.py <app-email>")
email = sys.argv[1]

TOKENS = Path.home() / ".garminconnect"
if not TOKENS.exists() or not any(TOKENS.glob("*.json")):
    sys.exit(f"❌ Hittar inga tokens i {TOKENS}")

g = Garmin()
g.client.load(str(TOKENS))
data = g.client.dumps()

conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()
c.execute("UPDATE users SET garmin_tokens = %s WHERE email = %s", (kryptera(data), email))
if c.rowcount != 1:
    sys.exit(f"❌ Hittade ingen användare med email {email}")
conn.commit()
print(f"✅ Tokens sparade för {email} ({len(data)} tecken, krypterade)")
