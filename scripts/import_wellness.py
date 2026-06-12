import json
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")
DB_PATH = BASE_DIR / "data" / "training.db"

WELLNESS_DIR = Path.home() / "Downloads" / "da122418-4c02-4a26-b89b-f2df8f7ef08f_1" / "DI_CONNECT" / "DI-Connect-Wellness"
METRICS_DIR = Path.home() / "Downloads" / "da122418-4c02-4a26-b89b-f2df8f7ef08f_1" / "DI_CONNECT" / "DI-Connect-Metrics"

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.executescript("""
CREATE TABLE IF NOT EXISTS sleep_daily (
    id INTEGER PRIMARY KEY,
    datum TEXT UNIQUE,
    sovtid_min REAL,
    djup_sov_min REAL,
    latt_sov_min REAL,
    vaken_min REAL,
    bekraftad INTEGER
);

CREATE TABLE IF NOT EXISTS vo2max_history (
    id INTEGER PRIMARY KEY,
    datum TEXT UNIQUE,
    vo2max REAL
);

CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY,
    langd_cm REAL,
    vikt_kg REAL,
    vo2max REAL
);
""")

# ── Sömndata ───────────────────────────────────────────────────
sleep_filer = list(WELLNESS_DIR.glob("*sleepData*.json"))
print(f"Hittade {len(sleep_filer)} sömnfiler")

sovnatt = 0
for fil in sleep_filer:
    with open(fil) as f:
        data = json.load(f)
    for d in data:
        datum = d.get("calendarDate")
        if not datum:
            continue
        bekraftad = 1 if "AUTO_CONFIRMED" in d.get("sleepWindowConfirmationType", "") else 0
        if not bekraftad:
            continue  # skippa obekräftade

        start = d.get("sleepStartTimestampGMT", "")
        slut = d.get("sleepEndTimestampGMT", "")
        sovtid_min = None
        if start and slut:
            from datetime import datetime
            try:
                s = datetime.fromisoformat(start.replace(".0", ""))
                e = datetime.fromisoformat(slut.replace(".0", ""))
                sovtid_min = round((e - s).total_seconds() / 60, 1)
            except:
                pass

        djup = round(d.get("deepSleepSeconds", 0) / 60, 1)
        latt = round(d.get("lightSleepSeconds", 0) / 60, 1)
        vaken = round(d.get("awakeSleepSeconds", 0) / 60, 1)

        result = c.execute("""
            INSERT OR IGNORE INTO sleep_daily
            (datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min, bekraftad)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (datum, sovtid_min, djup, latt, vaken, bekraftad))
        if result.rowcount > 0:
            sovnatt += 1

print(f"✅ {sovnatt} bekräftade sömnätter importerade")

# ── VO2max historik ────────────────────────────────────────────
metrics_filer = list(METRICS_DIR.glob("MetricsMaxMetData*.json"))
print(f"\nHittade {len(metrics_filer)} VO2max-filer")

vo2_nya = 0
for fil in metrics_filer:
    with open(fil) as f:
        data = json.load(f)
    for d in data:
        datum = d.get("calendarDate")
        vo2 = d.get("vo2MaxValue")
        if not datum or not vo2:
            continue
        result = c.execute("""
            INSERT OR IGNORE INTO vo2max_history (datum, vo2max)
            VALUES (?, ?)
        """, (datum, vo2))
        if result.rowcount > 0:
            vo2_nya += 1

print(f"✅ {vo2_nya} VO2max-mätningar importerade")

# ── Användarprofil ─────────────────────────────────────────────
profil_fil = WELLNESS_DIR / "96397825_userBioMetricProfileData.json"
if profil_fil.exists():
    with open(profil_fil) as f:
        profil = json.load(f)
    if profil:
        p = profil[0]
        c.execute("DELETE FROM user_profile")
        c.execute("""
            INSERT INTO user_profile (langd_cm, vikt_kg, vo2max)
            VALUES (?, ?, ?)
        """, (p.get("height"), round(p.get("weight", 0) / 1000, 1), p.get("vo2Max")))
        print(f"\n✅ Profil: {p.get('height')} cm, {round(p.get('weight',0)/1000,1)} kg, VO2max: {p.get('vo2Max')}")

conn.commit()
conn.close()
print("\n✅ Allt klart!")