import json
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")
DB_PATH = BASE_DIR / "data" / "training.db"

GARMIN_EXPORT = Path.home() / "Downloads" / "da122418-4c02-4a26-b89b-f2df8f7ef08f_1" / "DI_CONNECT"
UDS_DIR = GARMIN_EXPORT / "DI-Connect-Aggregator"

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.executescript("""
CREATE TABLE IF NOT EXISTS health_daily (
    id INTEGER PRIMARY KEY,
    datum TEXT UNIQUE,
    vilpuls INTEGER,
    min_puls INTEGER,
    max_puls INTEGER,
    steg INTEGER,
    kalorier REAL,
    aktiva_sek INTEGER,
    hog_intensitet_sek INTEGER,
    stress_snitt INTEGER,
    body_battery_hogst INTEGER,
    body_battery_lagst INTEGER,
    andning_snitt REAL
);
""")

uds_filer = list(UDS_DIR.glob("UDSFile_*.json"))
print(f"Hittade {len(uds_filer)} UDS-filer")

totalt = 0
nya = 0

for fil in uds_filer:
    with open(fil) as f:
        data = json.load(f)

    for d in data:
        totalt += 1
        datum = d.get("calendarDate")
        if not datum:
            continue

        # Body Battery
        bb = d.get("bodyBattery", {})
        bb_hogst = None
        bb_lagst = None
        if bb and "bodyBatteryStatList" in bb:
            for stat in bb["bodyBatteryStatList"]:
                if stat.get("bodyBatteryStatType") == "HIGHEST":
                    bb_hogst = stat.get("statsValue")
                elif stat.get("bodyBatteryStatType") == "LOWEST":
                    bb_lagst = stat.get("statsValue")

        # Stress
        stress = d.get("allDayStress", {})
        stress_snitt = None
        if stress and "aggregatorList" in stress:
            for agg in stress["aggregatorList"]:
                if agg.get("type") == "TOTAL":
                    stress_snitt = agg.get("averageStressLevel")

        # Andning
        resp = d.get("respiration", {})
        andning = resp.get("avgWakingRespirationValue") if resp else None

        result = c.execute("""
            INSERT OR IGNORE INTO health_daily
            (datum, vilpuls, min_puls, max_puls, steg, kalorier, aktiva_sek, 
             hog_intensitet_sek, stress_snitt, body_battery_hogst, body_battery_lagst, andning_snitt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datum,
            d.get("restingHeartRate"),
            d.get("minHeartRate"),
            d.get("maxHeartRate"),
            d.get("totalSteps"),
            d.get("totalKilocalories"),
            d.get("activeSeconds"),
            d.get("highlyActiveSeconds"),
            stress_snitt,
            bb_hogst,
            bb_lagst,
            andning
        ))

        if result.rowcount > 0:
            nya += 1

conn.commit()
conn.close()
print(f"✅ {nya} nya dagar importerade av totalt {totalt} poster!")