import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL")
USE_SQLITE = not DATABASE_URL

if USE_SQLITE:
    import sqlite3
    DB_PATH = BASE_DIR / "data" / "training.db"

ph = "?" if USE_SQLITE else "%s"
insert_ignore = "INSERT OR IGNORE" if USE_SQLITE else "INSERT"
on_conflict = "" if USE_SQLITE else " ON CONFLICT DO NOTHING"

def get_conn():
    if USE_SQLITE:
        return sqlite3.connect(DB_PATH)
    import psycopg2
    return psycopg2.connect(DATABASE_URL)

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

    conn = get_conn()
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

        c.execute(f"""
            {insert_ignore} INTO activities
            (activity_id, datum, namn, typ, distans_km, duration_min, snitt_puls, max_puls, kalorier, elevation_gain, snitt_tempo, plats)
            VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            {on_conflict}
        """, (
            a.get("activityId"), datum, a.get("activityName", ""), typ,
            distans_km, duration_min, a.get("averageHR"), a.get("maxHR"),
            round(a.get("calories") or 0, 1), round(a.get("elevationGain") or 0, 1),
            snitt_tempo, a.get("locationName", "")
        ))
        if c.rowcount > 0:
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

            bb_hogst = data.get("bodyBatteryHighestValue")
            bb_lagst = data.get("bodyBatteryLowestValue")
            stress = data.get("averageStressLevel")
            vilopuls = data.get("restingHeartRate")
            steg = data.get("totalSteps")
            aktiva_sek = data.get("activeSeconds")
            hog_sek = data.get("highlyActiveSeconds")

            c.execute(f"""
                {insert_ignore} INTO health_daily
                (datum, vilpuls, min_puls, max_puls, steg, kalorier, aktiva_sek,
                 hog_intensitet_sek, stress_snitt, body_battery_hogst, body_battery_lagst, andning_snitt)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                {on_conflict}
            """, (
                dag, vilopuls,
                data.get("minHeartRate"), data.get("maxHeartRate"),
                steg, data.get("totalKilocalories"),
                aktiva_sek, hog_sek, stress, bb_hogst, bb_lagst, None
            ))
            if c.rowcount > 0:
                nya_hälsa += 1
        except Exception:
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

            c.execute(f"""
                {insert_ignore} INTO sleep_daily
                (datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min, bekraftad)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                {on_conflict}
            """, (dag, sovtid_min, djup, latt, vaken, 1))
            if c.rowcount > 0:
                ny_sömn += 1
        except Exception:
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
                    c.execute(f"""
                        {insert_ignore} INTO vo2max_history (datum, vo2max)
                        VALUES ({ph}, {ph})
                        {on_conflict}
                    """, (datum, vo2))
        print(f"  ✅ VO2max uppdaterad")
    except Exception as e:
        print(f"  ⚠️  VO2max misslyckades: {e}")

    # ── 5. Användarprofil ──────────────────────────────────────────
    print("📥 Hämtar användarprofil...")
    try:
        profil = client.get_user_profile()
        if profil:
            vikt = profil.get("weight")
            langd = profil.get("height")
            if vikt and langd:
                vikt_kg = round(vikt / 1000, 1)
                c.execute("DELETE FROM user_profile")
                c.execute(f"""
                    INSERT INTO user_profile (langd_cm, vikt_kg, vo2max)
                    SELECT {ph}, {ph}, vo2max FROM user_profile LIMIT 1
                """, (langd, vikt_kg))
                print(f"  ✅ Profil: {langd} cm, {vikt_kg} kg")
    except Exception as e:
        print(f"  ⚠️  Profil misslyckades: {e}")

    conn.commit()
    conn.close()
    print("\n✅ Synk klar!")


if __name__ == "__main__":
    sync()
