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

def beräkna_estimat(c, ph, insert_ignore, on_conflict, user_id, idag, distans_km, etikett):
    c.execute(f"""
        SELECT distans_km, duration_min FROM activities
        WHERE user_id = {ph} AND typ = 'running' AND distans_km >= {ph}
        ORDER BY (duration_min / distans_km) ASC LIMIT 1
    """, (user_id, distans_km))
    bäst = c.fetchone()
    if not bäst:
        return
    d, t = bäst[0], bäst[1]
    tempo_min_per_km = t / d
    tid_sek = tempo_min_per_km * distans_km * 60
    h, m, s = int(tid_sek // 3600), int((tid_sek % 3600) // 60), int(tid_sek % 60)
    formaterat = f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m}:{s:02d}"

    c.execute(f"DELETE FROM personal_records WHERE typ = {ph} AND user_id = {ph}", (etikett, user_id))
    c.execute(f"""
        INSERT INTO personal_records (typ, formaterat, datum, user_id, current)
        VALUES ({ph}, {ph}, {ph}, {ph}, 1)
    """, (etikett, formaterat, idag, user_id))
    
def sync(full_sync=False):
    from garminconnect import Garmin

    user_id = os.getenv("SYNC_USER_ID")
    if not user_id:
        print("❌ SYNC_USER_ID saknas")
        return
    user_id = int(user_id)

    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")

    if not email or not password:
        print("❌ GARMIN_EMAIL och GARMIN_PASSWORD saknas")
        return

    print("🔄 Loggar in på Garmin Connect...")
    client = Garmin(email, password)
    client.login()
    print("✅ Inloggad!\n")

    conn = get_conn()
    c = conn.cursor()

    # Fullsynk hämtar flera år tillbaka (för ny användare eller manuell backfill)
    # Normal synk hämtar bara senaste månaden (daglig drift)
    dagar_aktivitet = 1825 if full_sync else 30   # ~5 år vid fullsynk
    dagar_dagsdata = 365 if full_sync else 30      # 1 år vid fullsynk för hälsa/sömn
    dagar_vo2max = 730 if full_sync else 60        # 2 år vid fullsynk

    
    sedan = (datetime.now() - timedelta(days=dagar_aktivitet)).strftime("%Y-%m-%d")
    idag = datetime.now().strftime("%Y-%m-%d")

    print(f"🔧 Läge: {'FULLSYNK' if full_sync else 'Daglig synk'}\n")

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

        snitt_kadens = a.get("averageRunningCadenceInStepsPerMinute")

        zon_sek = [None, None, None, None, None]
        activity_id = a.get("activityId")
        if activity_id:
            try:
                zoner = client.get_activity_hr_in_timezones(activity_id)
                for z in zoner:
                    idx = z.get("zoneNumber")
                    sek = z.get("secsInZone")
                    if idx and 1 <= idx <= 5:
                        zon_sek[idx - 1] = round(sek) if sek else 0
            except Exception:
                pass

        c.execute(f"""
            {insert_ignore} INTO activities
            (activity_id, datum, namn, typ, distans_km, duration_min, snitt_puls, max_puls,
             kalorier, elevation_gain, snitt_tempo, plats, user_id, snitt_kadens,
             zon1_sek, zon2_sek, zon3_sek, zon4_sek, zon5_sek)
            VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            {on_conflict}
        """, (
            activity_id, datum, a.get("activityName", ""), typ,
            distans_km, duration_min, a.get("averageHR"), a.get("maxHR"),
            round(a.get("calories") or 0, 1), round(a.get("elevationGain") or 0, 1),
            snitt_tempo, a.get("locationName", ""), user_id, snitt_kadens,
            zon_sek[0], zon_sek[1], zon_sek[2], zon_sek[3], zon_sek[4]
        ))
        if c.rowcount > 0:
            nya_aktiviteter += 1

    print(f"  ✅ {nya_aktiviteter} nya aktiviteter")

    # ── 2. Daglig hälsodata ────────────────────────────────────
    print("📥 Hämtar hälsodata...")
    nya_hälsa = 0

    for i in range(dagar_dagsdata):
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
                 hog_intensitet_sek, stress_snitt, body_battery_hogst, body_battery_lagst,
                 andning_snitt, user_id)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                {on_conflict}
            """, (
                dag, vilopuls,
                data.get("minHeartRate"), data.get("maxHeartRate"),
                steg, data.get("totalKilocalories"),
                aktiva_sek, hog_sek, stress, bb_hogst, bb_lagst, None, user_id
            ))
            if c.rowcount > 0:
                nya_hälsa += 1
        except Exception:
            continue

    print(f"  ✅ {nya_hälsa} nya hälsodagar")

    # ── 3. Sömn ────────────────────────────────────────────────
    print("📥 Hämtar sömndata...")
    ny_sömn = 0

    for i in range(dagar_dagsdata):
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
                (datum, sovtid_min, djup_sov_min, latt_sov_min, vaken_min, bekraftad, user_id)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                {on_conflict}
            """, (dag, sovtid_min, djup, latt, vaken, 1, user_id))
            if c.rowcount > 0:
                ny_sömn += 1
        except Exception:
            continue

    print(f"  ✅ {ny_sömn} nya sömnätter")

    # ── 4. VO2max ──────────────────────────────────────────────
    print("📥 Hämtar VO2max...")
    try:
        hittade_vo2 = 0
        max_dagar_att_söka = 1095  # 3 år som absolut yttre gräns
        for i in range(max_dagar_att_söka):
            dag = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            vo2_data = client.get_max_metrics(dag)

            if vo2_data:
                for entry in vo2_data:
                    vo2 = entry.get("generic", {}).get("vo2MaxPreciseValue")
                    datum = entry.get("generic", {}).get("calendarDate")
                    if vo2 and datum:
                        c.execute(f"""
                            {insert_ignore} INTO vo2max_history (datum, vo2max, user_id)
                            VALUES ({ph}, {ph}, {ph})
                            {on_conflict}
                        """, (datum, vo2, user_id))
                        hittade_vo2 += 1
                if hittade_vo2 > 0:
                    break  # sluta vid första träffen, oavsett hur långt bak
        print(f"  ✅ {hittade_vo2} VO2max-värden sparade" if hittade_vo2 else "  ⚠️ Inget VO2max hittat")
    except Exception as e:
        print(f"  ⚠️  VO2max misslyckades: {e}")

    # ── 5. Användarprofil ──────────────────────────────────────
    print("📥 Hämtar användarprofil...")
    try:
        profil = client.get_user_profile()
        if profil:
            vikt = profil.get("weight")
            langd = profil.get("height")
            if vikt and langd:
                vikt_kg = round(vikt / 1000, 1)
                c.execute(f"DELETE FROM user_profile WHERE id = {ph}", (user_id,))
                c.execute(f"""
                    INSERT INTO user_profile (id, langd_cm, vikt_kg, vo2max)
                    VALUES ({ph}, {ph}, {ph}, NULL)
                """, (user_id, langd, vikt_kg))
                print(f"  ✅ Profil: {langd} cm, {vikt_kg} kg")
    except Exception as e:
        print(f"  ⚠️  Profil misslyckades: {e}")

    # ── 6. Race predictions ─────────────────────────────────────
    print("📥 Hämtar race predictions...")
    try:
        pred = client.get_race_predictions()
        if pred:
            c.execute(f"""
                {insert_ignore} INTO race_predictions
                (user_id, datum, time_5k, time_10k, time_half, time_marathon)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                {on_conflict}
            """, (
                user_id, idag,
                pred.get("time5K"), pred.get("time10K"),
                pred.get("timeHalfMarathon"), pred.get("timeMarathon")
            ))
        print("  ✅ Race predictions sparade")
    except Exception as e:
        print(f"  ⚠️  Race predictions misslyckades: {e}")

    # ── 7. Estimerade PR för alla standarddistanser ──────────────
    print("📥 Beräknar estimerade PR (5K, 10K, halvmaraton, maraton)...")
    try:
        beräkna_estimat(c, ph, insert_ignore, on_conflict, user_id, idag, 5, "Estimated 5K")
        beräkna_estimat(c, ph, insert_ignore, on_conflict, user_id, idag, 10, "Estimated 10K")
        beräkna_estimat(c, ph, insert_ignore, on_conflict, user_id, idag, 21.1, "Estimated Half Marathon")
        beräkna_estimat(c, ph, insert_ignore, on_conflict, user_id, idag, 42.2, "Estimated Marathon")
        print("  ✅ Estimerade PR uppdaterade")
    except Exception as e:
        print(f"  ⚠️  Estimat misslyckades: {e}")

    conn.commit()
    conn.close()
    print("\n✅ Synk klar!")


if __name__ == "__main__":
    full = os.getenv("FULL_SYNC", "false").lower() == "true"
    sync(full_sync=full)