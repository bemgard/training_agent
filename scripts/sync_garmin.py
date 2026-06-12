import sqlite3
import sys
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")
DB_PATH = BASE_DIR / "data" / "training.db"

def sync():
    from garminconnect import Garmin

    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")

    if not email or not password:
        print("❌ GARMIN_EMAIL och GARMIN_PASSWORD saknas i .env")
        return

    print("🔄 Loggar in på Garmin Connect...")
    client = Garmin(email, password)
    client.login()
    print("✅ Inloggad!\n")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    sedan = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    idag = datetime.now().strftime("%Y-%m-%d")

    # ── 1. Aktiviteter ─────────────────────────────────────────
    print("📥 Hämtar aktiviteter...")
    activities = client.get_activities_by_date(sedan, idag)
    nya_aktiviteter = 0

    for a in activities:
        ts = a.get("startTimeLocal") or a.get("startTimeGMT")
        if ts:
            try:
                datum = datetime.strptime(ts[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
            except:
                datum = None
        else:
            datum = None

        distans_km = round((a.get("distance") or 0) / 1000, 2)
        duration_min = round((a.get("movingDuration") or a.get("duration") or 0) / 60, 1)

        snitt_tempo = None
        typ = a.get("activityType", {}).get("typeKey", "") if isinstance(a.get("activityType"), dict) else a.get("activityType", "")
        if distans_km > 0 and duration_min > 0 and "run" in typ:
            tempo_sek = (duration_min * 60) / distans_km
            snitt_tempo = f"{int(tempo_sek // 60)}:{int(tempo_sek % 60):02d}/km"

        result = c.execute("""
            INSERT OR IGNORE INTO activities
            (activity_id, datum, namn, typ, distans_km, duration_min, snitt_puls, max_puls, kalorier, elevation_gain, snitt_tempo, plats)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            a.get("activityId"), datum, a.get("activityName", ""), typ,
            distans_km, duration_min, a.get("averageHR"), a.get("maxHR"),
            round(a.get("calories") or 0, 1), round(a.get("elevationGain") or 0, 1),
            snitt_tempo, a.get("locationName", "")
        ))
        if result.rowcount > 0:
            nya_aktiviteter += 1

    print(f"  ✅ {nya_aktiviteter} nya aktiviteter")

    # ── 2. Daglig hälsodata ────────────────────────────────────
    print("📥 Hämtar hälsodata...")
    nya_hälsa = 0

    for i in range(30):
        dag = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            data = client.get_stats(dag)
            if not data:
                continue

            bb = data.get("bodyBatteryChargedValue")
            bb_lagst = data.get("bodyBatteryDrainedValue")
            stress = data.get("averageStressLevel")
            vilopuls = data.get("restingHeartRate")
            steg = data.get("totalSteps")
            aktiva_sek = data.get("activeSeconds")
            hog_sek = data.get("highlyActiveSeconds")

            result = c.execute("""
                INSERT OR IGNORE INTO health_daily
                (datum, vilpuls, min_puls, max_puls, steg, kalorier, aktiva_sek,
                 hog_intensitet_sek, stress_snitt, body_battery_hogst, body_battery_lagst, andning_snitt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                dag, vilopuls,
                data.get("minHeartRate"), data.get("maxHeartRate"),
                steg, data.get("totalKilocalories"),
                aktiva_sek, hog_sek, stress, bb, bb_lagst, None
            ))
            if result.rowcount > 0:
                nya_hälsa += 1
        except Exception as e:
            continue

    print(f"  ✅ {nya_hälsa} nya hälsodagar")

    # ── 3. Sömn ────────────────────────────────────────────────
    print("📥 Hämtar sömndata...")
    ny_sömn = 0

    for i in range(30):
        dag = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            sömn = client.get_sleep_data(dag)
            if not sömn:
                continue

            daily = sömn.get("dailySleepDTO", {})
            if not daily:
                continue

            start = daily.get("sleepStartTimestampGMT")
            slut = daily.get("sleepEndTimestampGMT")
            sovtid_min = None
            if start and slut:
                sovtid_min = round((slut - start) / 60000, 1)

            djup = round((daily.get("deepSleepSeconds") or 0) / 60, 1)
            latt = round((daily.get("lightSleepSeconds") or 0) / 60, 1)
            vaken = round((daily.get("awakeSleepSeconds") or 0) / 60, 1)

            result = c.execute("""
                INSERT OR IGNORE INTO sleep_daily
                (datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min, bekraftad)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (dag, sovtid_min, djup, latt, vaken, 1))
            if result.rowcount > 0:
                ny_sömn += 1
        except Exception as e:
            continue

    print(f"  ✅ {ny_sömn} nya sömnätter")

    # ── 4. VO2max ──────────────────────────────────────────────
    print("📥 Hämtar VO2max...")
    try:
        vo2_data = client.get_max_metrics(idag)
        if vo2_data:
            for entry in vo2_data:
                vo2 = entry.get("generic", {}).get("vo2MaxPreciseValue")
                datum = entry.get("calendarDate")
                if vo2 and datum:
                    c.execute("""
                        INSERT OR IGNORE INTO vo2max_history (datum, vo2max)
                        VALUES (?, ?)
                    """, (datum, vo2))
        print(f"  ✅ VO2max uppdaterad")
    except Exception as e:
        print(f"  ⚠️  VO2max misslyckades: {e}")

    conn.commit()
    conn.close()
    print("\n✅ Synk klar!")

if __name__ == "__main__":
    sync()