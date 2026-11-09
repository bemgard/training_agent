import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")
sys.path.insert(0, str(BASE_DIR))

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
    

LÖPTYPER = ("running", "treadmill_running", "trail_running")


def passtid_min(a, typ):
    """Löpning: rörelsetid (ger rätt tempo). Övrigt: total tid — styrka/fotboll har mycket stillastående."""
    if typ in LÖPTYPER:
        sek = a.get("movingDuration") or a.get("duration") or a.get("elapsedDuration")
    else:
        sek = a.get("duration") or a.get("elapsedDuration") or a.get("movingDuration")
    return round((sek or 0) / 60, 1)


def läs_tokens(c, user_id):
    """Dekrypterade Garmin-tokens för användaren, eller None."""
    from api.auth import dekryptera
    try:
        c.execute(f"SELECT garmin_tokens FROM users WHERE id = {ph}", (user_id,))
        rad = c.fetchone()
        return dekryptera(rad[0]) if rad and rad[0] else None
    except Exception as e:
        print(f"  ⚠️  Kunde inte läsa sparade tokens: {e}")
        return None


def spara_tokens(c, conn, user_id, client):
    """Krypterar och sparar aktuella tokens efter lyckad inloggning."""
    from api.auth import kryptera
    try:
        c.execute(f"UPDATE users SET garmin_tokens = {ph} WHERE id = {ph}",
                  (kryptera(client.client.dumps()), user_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"  ⚠️  Kunde inte spara tokens: {e}")


def upsert(c, tabell, rad, nycklar=("datum", "user_id")):
    """INSERT ... ON CONFLICT DO UPDATE — samma syntax i SQLite (>=3.24) och Postgres.
    Uppdaterar bara kolumnerna i `rad`, så andra kolumner på samma rad lämnas orörda."""
    kolumner = list(rad.keys())
    uppdatera = [k for k in kolumner if k not in nycklar]
    c.execute(f"""
        INSERT INTO {tabell} ({", ".join(kolumner)})
        VALUES ({", ".join([ph] * len(kolumner))})
        ON CONFLICT ({", ".join(nycklar)}) DO UPDATE SET
        {", ".join(f"{k} = excluded.{k}" for k in uppdatera)}
    """, tuple(rad.values()))


def hämta_bakåt(hämta, dagar, max_tomma_i_rad=14):
    """Går bakåt dag för dag och yieldar (dag, data). Slutar efter `max_tomma_i_rad`
    tomma dagar i rad — enheter utan HRV/readiness kostar då bara ~14 anrop, inte 365."""
    tomma = 0
    for i in range(dagar):
        dag = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            data = hämta(dag)
        except Exception:
            data = None
        if not data:
            tomma += 1
            if tomma >= max_tomma_i_rad:
                return
            continue
        tomma = 0
        yield dag, data

def sync(full_sync=False):
    from garminconnect import Garmin

    user_id = os.getenv("SYNC_USER_ID")
    if not user_id:
        print("❌ SYNC_USER_ID saknas")
        sys.exit(1)
    user_id = int(user_id)

    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")

    if not email or not password:
        print("❌ GARMIN_EMAIL och GARMIN_PASSWORD saknas")
        sys.exit(1)

    conn = get_conn()
    c = conn.cursor()

    print("🔄 Loggar in på Garmin Connect...")
    client = Garmin(email, password)
    tokens = läs_tokens(c, user_id)
    # Med sparade tokens loggar biblioteket inte in med lösenord (undviker 429/Cloudflare);
    # är de ogiltiga faller det självt tillbaka på lösenordet.
    # Tokens skickas via en temporär katalog: login() tolkar strängar < 512 tecken som sökväg.
    import tempfile
    with tempfile.TemporaryDirectory() as tokendir:
        if tokens:
            (Path(tokendir) / "garmin_tokens.json").write_text(tokens)
        client.login(tokendir)
    spara_tokens(c, conn, user_id, client)
    print(f"✅ Inloggad{' (sparade tokens)' if tokens else ''}!\n")

    # Fullsynk hämtar flera år tillbaka (för ny användare eller manuell backfill)
    # Normal synk hämtar bara senaste månaden (daglig drift)
    dagar_aktivitet = 1825 if full_sync else 30   # ~5 år vid fullsynk
    dagar_dagsdata = 365 if full_sync else 30      # 1 år vid fullsynk för hälsa/sömn
    dagar_vo2max = 730 if full_sync else 60        # 2 år vid fullsynk

    
    c.execute(f"SELECT activity_id FROM activities WHERE user_id = {ph}", (user_id,))
    befintliga = {r[0] for r in c.fetchall()}
    c.execute(f"SELECT COUNT(*) FROM vo2max_history WHERE user_id = {ph}", (user_id,))
    för_lite_vo2 = c.fetchone()[0] < 3
    c.execute(f"""SELECT COUNT(*) FROM activities WHERE user_id = {ph} AND duration_min < 10
                  AND typ NOT IN ('running', 'treadmill_running', 'trail_running')""", (user_id,))
    misstänkt_tid = c.fetchone()[0] > 0
    if (för_lite_vo2 or misstänkt_tid) and befintliga:
        dagar_aktivitet = 1825  # engångs-backfill av VO2max-historik (aktivitetslistan är ett enda anrop)
        print("🔧 Backfill (VO2max-historik/passtider) — hämtar hela aktivitetslistan")
    sedan = (datetime.now() - timedelta(days=dagar_aktivitet)).strftime("%Y-%m-%d")
    idag = datetime.now().strftime("%Y-%m-%d")

    print(f"🔧 Läge: {'FULLSYNK' if full_sync else 'Daglig synk'}\n")

    # ── 1. Aktiviteter (+ VO2max per pass) ─────────────────────
    print("📥 Hämtar aktiviteter...")
    activities = client.get_activities_by_date(sedan, idag)
    nya_aktiviteter = 0
    vo2_per_dag = {}

    for a in activities:
        ts = a.get("startTimeLocal") or a.get("startTimeGMT")
        try:
            datum = datetime.strptime(ts[:10], "%Y-%m-%d").strftime("%Y-%m-%d") if ts else None
        except Exception:
            datum = None

        activity_id = a.get("activityId")
        vo2 = a.get("vO2MaxValue") or a.get("vo2MaxValue")
        if vo2 and datum:
            vo2_per_dag[datum] = max(vo2, vo2_per_dag.get(datum, 0))

        typ = a.get("activityType", {}).get("typeKey", "") if isinstance(a.get("activityType"), dict) else a.get("activityType", "")
        duration_min = passtid_min(a, typ)

        if activity_id in befintliga:
            # Redan sparad: hoppa över dyra zonanrop; fyll i VO2max och rätta passtiden
            c.execute(f"""UPDATE activities SET vo2max = COALESCE(vo2max, {ph}), duration_min = {ph}
                          WHERE user_id = {ph} AND activity_id = {ph}""",
                      (vo2, duration_min, user_id, activity_id))
            continue

        distans_km = round((a.get("distance") or 0) / 1000, 2)

        snitt_tempo = None
        if distans_km > 0 and duration_min > 0 and "run" in typ:
            tempo_sek = (duration_min * 60) / distans_km
            snitt_tempo = f"{int(tempo_sek // 60)}:{int(tempo_sek % 60):02d}/km"

        zon_sek = [None, None, None, None, None]
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
             zon1_sek, zon2_sek, zon3_sek, zon4_sek, zon5_sek, vo2max)
            VALUES ({", ".join([ph] * 20)})
            {on_conflict}
        """, (
            activity_id, datum, a.get("activityName", ""), typ,
            distans_km, duration_min, a.get("averageHR"), a.get("maxHR"),
            round(a.get("calories") or 0, 1), round(a.get("elevationGain") or 0, 1),
            snitt_tempo, a.get("locationName", ""), user_id, a.get("averageRunningCadenceInStepsPerMinute"),
            zon_sek[0], zon_sek[1], zon_sek[2], zon_sek[3], zon_sek[4], vo2
        ))
        if c.rowcount > 0:
            nya_aktiviteter += 1

    for dag, vo2 in vo2_per_dag.items():
        upsert(c, "vo2max_history", {"datum": dag, "user_id": user_id, "vo2max": vo2})
    conn.commit()
    print(f"  ✅ {nya_aktiviteter} nya aktiviteter | VO2max från {len(vo2_per_dag)} pass")

    # ── 2. Daglig hälsodata ────────────────────────────────────
    print("📥 Hämtar hälsodata...")
    nya_hälsa = 0

    for i in range(dagar_dagsdata):
        dag = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            data = client.get_stats(dag)
        except Exception:
            continue
        if not data or data.get("totalSteps") is None:
            continue

        # Upsert: dagens värden (steg, Body Battery) fortsätter ändras efter första synken
        upsert(c, "health_daily", {
            "datum": dag,
            "user_id": user_id,
            "vilpuls": data.get("restingHeartRate"),
            "min_puls": data.get("minHeartRate"),
            "max_puls": data.get("maxHeartRate"),
            "steg": data.get("totalSteps"),
            "kalorier": data.get("totalKilocalories"),
            "aktiva_sek": data.get("activeSeconds"),
            "hog_intensitet_sek": data.get("highlyActiveSeconds"),
            "stress_snitt": data.get("averageStressLevel"),
            "body_battery_hogst": data.get("bodyBatteryHighestValue"),
            "body_battery_lagst": data.get("bodyBatteryLowestValue"),
        })
        nya_hälsa += 1

    conn.commit()
    print(f"  ✅ {nya_hälsa} hälsodagar sparade/uppdaterade")

    # ── 3. Sömn (+ HRV per natt, sömnpoäng m.m. från samma anrop) ──
    print("📥 Hämtar sömndata...")
    ny_sömn = 0

    for i in range(dagar_dagsdata):
        dag = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            sömn = client.get_sleep_data(dag) or {}
        except Exception:
            continue
        daily = sömn.get("dailySleepDTO") or {}
        if not daily.get("sleepTimeSeconds"):
            continue  # ingen uppmätt sömn den natten

        overall = (daily.get("sleepScores") or {}).get("overall") or {}
        def minuter(nyckel):
            v = daily.get(nyckel)
            return round(v / 60, 1) if v is not None else None

        upsert(c, "sleep_daily", {
            "datum": dag,
            "user_id": user_id,
            "sovtid_min": minuter("sleepTimeSeconds"),  # faktisk sömn, som Garmin visar
            "djup_sov_min": minuter("deepSleepSeconds"),
            "latt_sov_min": minuter("lightSleepSeconds"),
            "rem_sov_min": minuter("remSleepSeconds"),
            "vaken_min": minuter("awakeSleepSeconds"),
            "bekraftad": 1 if daily.get("sleepWindowConfirmed") else 0,
            "somnpoang": overall.get("value"),
            "somn_kvalitet": overall.get("qualifierKey"),
            "hrv_natt": sömn.get("avgOvernightHrv"),
            "hrv_status": sömn.get("hrvStatus"),
            "vilopuls_natt": sömn.get("restingHeartRate"),
            "andning_snitt": daily.get("averageRespirationValue"),
            "somnstress": daily.get("avgSleepStress"),
            "bb_laddning": sömn.get("bodyBatteryChange"),
            "hudtemp_avvikelse": sömn.get("avgSkinTempDeviationC") if sömn.get("skinTempDataExists") else None,
        })
        ny_sömn += 1

    conn.commit()
    print(f"  ✅ {ny_sömn} sömnnätter sparade/uppdaterade")

    # ── 3b. HRV-baslinje och 7-dagarssnitt ──────────────────────
    print("📥 Hämtar HRV-baslinje...")
    dagar_hrv = dagar_dagsdata if full_sync else 14
    antal_hrv = 0
    for dag, hrv in hämta_bakåt(client.get_hrv_data, dagar_hrv):
        summering = hrv.get("hrvSummary") or {}
        baslinje = summering.get("baseline") or {}
        upsert(c, "sleep_daily", {
            "datum": dag,
            "user_id": user_id,
            "hrv_7d": summering.get("weeklyAvg"),
            "hrv_baslinje_lag": baslinje.get("balancedLow"),
            "hrv_baslinje_hog": baslinje.get("balancedUpper"),
        })
        antal_hrv += 1
    conn.commit()
    print(f"  ✅ {antal_hrv} dagar med HRV-baslinje" if antal_hrv else "  ⚠️ Ingen HRV-data (enheten stödjer inte HRV-status?)")

    # ── 3c. Training Readiness ──────────────────────────────────
    print("📥 Hämtar training readiness...")
    antal_tr = 0
    for dag, tr in hämta_bakåt(client.get_training_readiness, dagar_hrv):
        poster = tr if isinstance(tr, list) else [tr]
        poster = [p for p in poster if p and p.get("score") is not None]
        if not poster:
            continue
        senaste = max(poster, key=lambda p: p.get("timestampLocal") or "")  # uppdateras under dagen
        upsert(c, "readiness_daily", {
            "datum": dag,
            "user_id": user_id,
            "poang": senaste.get("score"),
            "niva": senaste.get("level"),
            "feedback": senaste.get("feedbackShort"),
            "somn_faktor": senaste.get("sleepScoreFactorPercent"),
            "aterhamtning_faktor": senaste.get("recoveryTimeFactorPercent"),
            "belastning_faktor": senaste.get("acwrFactorPercent"),
            "stress_faktor": senaste.get("stressHistoryFactorPercent"),
            "hrv_faktor": senaste.get("hrvFactorPercent"),
            "somnhistorik_faktor": senaste.get("sleepHistoryFactorPercent"),
            "akut_belastning": senaste.get("acuteLoad"),
            "aterhamtning_min": senaste.get("recoveryTime"),
            "uppdaterad": senaste.get("timestampLocal"),
        })
        antal_tr += 1
    conn.commit()
    print(f"  ✅ {antal_tr} dagar med readiness" if antal_tr else "  ⚠️ Ingen readiness-data")

    # ── 4. VO2max (senaste dagsvärdet; historiken kommer från aktiviteterna ovan) ──
    print("📥 Hämtar senaste VO2max...")
    hittade_vo2 = 0
    for dag, vo2_data in hämta_bakåt(client.get_max_metrics, 30, max_tomma_i_rad=30):
        for entry in vo2_data if isinstance(vo2_data, list) else [vo2_data]:
            generic = (entry or {}).get("generic") or {}
            if generic.get("vo2MaxPreciseValue") and generic.get("calendarDate"):
                upsert(c, "vo2max_history", {"datum": generic["calendarDate"], "user_id": user_id,
                                             "vo2max": generic["vo2MaxPreciseValue"]})
                hittade_vo2 += 1
        if hittade_vo2:
            break
    conn.commit()
    print(f"  ✅ Senaste VO2max sparad" if hittade_vo2 else "  ⚠️ Inget VO2max senaste 30 dagarna")

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