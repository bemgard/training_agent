import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

# ── Sökvägar ───────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "data" / "training.db"
RAW_DIR = BASE_DIR / "data" / "raw"

# Hitta JSON-filerna automatiskt
activities_file = next(RAW_DIR.glob("*summarizedActivities*"))
pr_file = next(RAW_DIR.glob("*personalRecord*"))

# ── Skapa databas ──────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.executescript("""
CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY,
    activity_id INTEGER UNIQUE,
    datum TEXT,
    namn TEXT,
    typ TEXT,
    distans_km REAL,
    duration_min REAL,
    snitt_puls INTEGER,
    max_puls INTEGER,
    kalorier REAL,
    elevation_gain REAL,
    snitt_tempo TEXT,
    plats TEXT
);

CREATE TABLE IF NOT EXISTS personal_records (
    id INTEGER PRIMARY KEY,
    typ TEXT,
    värde_sek REAL,
    formaterat TEXT,
    datum TEXT,
    aktivitet_id INTEGER,
    current INTEGER
);
""")

# ── Parsa aktiviteter ──────────────────────────────────────────
with open(activities_file) as f:
    raw = json.load(f)

activities = raw[0]["summarizedActivitiesExport"]

for a in activities:
    ts = a.get("startTimeLocal") or a.get("startTimeGmt")
    datum = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d") if ts else None

    distans_km = round(a.get("distance", 0) / 100000, 2)
    duration_min = round(a.get("movingDuration", a.get("duration", 0)) / 60000, 1)

    snitt_tempo = None
    if distans_km > 0 and duration_min > 0 and a.get("activityType", "").startswith("run"):
        tempo_sek_per_km = (duration_min * 60) / distans_km
        min_del = int(tempo_sek_per_km // 60)
        sek_del = int(tempo_sek_per_km % 60)
        snitt_tempo = f"{min_del}:{sek_del:02d}/km"

    c.execute("""
        INSERT OR IGNORE INTO activities 
        (activity_id, datum, namn, typ, distans_km, duration_min, snitt_puls, max_puls, kalorier, elevation_gain, snitt_tempo, plats)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        a.get("activityId"), datum, a.get("name", ""), a.get("activityType", ""),
        distans_km, duration_min, a.get("avgHr"), a.get("maxHr"),
        round(a.get("calories", 0), 1), round(a.get("elevationGain", 0), 1),
        snitt_tempo, a.get("locationName", "")
    ))

# ── Parsa personliga rekord ────────────────────────────────────
with open(pr_file) as f:
    pr_raw = json.load(f)

for pr in pr_raw[0]["personalRecords"]:
    typ = pr.get("personalRecordType", "")
    värde = pr.get("value", 0)
    datum = pr.get("prStartTimeGMT", "")[:10] if pr.get("prStartTimeGMT") else None
    current = 1 if pr.get("current") else 0

    if typ in ["Best 1km Run", "Best Half Marathon", "Best Full Marathon"]:
        sek = int(värde)
        h = sek // 3600
        m = (sek % 3600) // 60
        s = sek % 60
        formaterat = f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m}:{s:02d}"
    elif typ == "Farthest Run":
        formaterat = f"{round(värde/1000, 2)} km"
    else:
        formaterat = str(int(värde))

    c.execute("""
        INSERT INTO personal_records (typ, värde_sek, formaterat, datum, aktivitet_id, current)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (typ, värde, formaterat, datum, pr.get("activityId"), current))

conn.commit()
conn.close()
print("✅ Databas byggd!")