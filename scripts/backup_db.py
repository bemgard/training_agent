"""Lokal backup: exporterar alla tabeller i public-schemat till JSON i backups/<datum>/.
Kräver ingen pg_dump. Kör:  .venv/bin/python scripts/backup_db.py
(backups/ är gitignorerad — innehåller krypterade Garmin-uppgifter och hälsodata)"""
import json, os
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from dotenv import load_dotenv
import psycopg2, psycopg2.extras

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")
ut = BASE_DIR / "backups" / date.today().isoformat()
ut.mkdir(parents=True, exist_ok=True)

conn = psycopg2.connect(os.environ["DATABASE_URL"], cursor_factory=psycopg2.extras.RealDictCursor)
c = conn.cursor()
c.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
tabeller = [r["tablename"] for r in c.fetchall()]

def konv(v):
    if isinstance(v, (datetime, date)): return v.isoformat()
    if isinstance(v, Decimal): return float(v)
    return v

totalt = 0
for t in tabeller:
    c.execute(f'SELECT * FROM "{t}"')
    rader = [{k: konv(v) for k, v in r.items()} for r in c.fetchall()]
    (ut / f"{t}.json").write_text(json.dumps(rader, ensure_ascii=False, indent=1))
    totalt += len(rader)
    print(f"  {t}: {len(rader)} rader")
conn.close()
print(f"✅ {totalt} rader från {len(tabeller)} tabeller sparade i {ut}")
