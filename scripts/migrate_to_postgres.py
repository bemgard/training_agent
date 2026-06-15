import os
import sqlite3
import psycopg2
import psycopg2.extras
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
SQLITE_PATH = BASE_DIR / "data" / "training.db"
DATABASE_URL = os.environ.get("DATABASE_URL")

def migrate():
    print("Ansluter till PostgreSQL...")
    pg = psycopg2.connect(DATABASE_URL)
    pg.autocommit = False
    pgc = pg.cursor()

    sqlite = sqlite3.connect(SQLITE_PATH)
    sqlite.row_factory = sqlite3.Row
    sc = sqlite.cursor()

    print("Skapar tabeller...")
    pgc.execute("""
        CREATE TABLE IF NOT EXISTS user_profile (
            id SERIAL PRIMARY KEY,
            langd_cm REAL,
            vikt_kg REAL,
            vo2max REAL,
            max_puls INTEGER
        )
    """)

    pgc.execute("""
        CREATE TABLE IF NOT EXISTS activities (
            id SERIAL PRIMARY KEY,
            activity_id BIGINT UNIQUE,
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
        )
    """)

    pgc.execute("""
        CREATE TABLE IF NOT EXISTS health_daily (
            id SERIAL PRIMARY KEY,
            datum TEXT UNIQUE,
            vilpuls INTEGER,
            body_battery_hogst INTEGER,
            body_battery_lagst INTEGER,
            stress_snitt INTEGER,
            steg INTEGER,
            aktiva_sek INTEGER
        )
    """)

    pgc.execute("""
        CREATE TABLE IF NOT EXISTS sleep_daily (
            id SERIAL PRIMARY KEY,
            datum TEXT UNIQUE,
            sovtid_min REAL,
            djup_sov_min REAL,
            latt_sov_min REAL,
            vaken_min REAL,
            bekraftad INTEGER
        )
    """)

    pgc.execute("""
        CREATE TABLE IF NOT EXISTS vo2max_history (
            id SERIAL PRIMARY KEY,
            datum TEXT UNIQUE,
            vo2max REAL
        )
    """)

    pgc.execute("""
        CREATE TABLE IF NOT EXISTS personal_records (
            id SERIAL PRIMARY KEY,
            typ TEXT,
            värde REAL,
            formaterat TEXT,
            datum TEXT,
            activity_id BIGINT,
            current INTEGER
        )
    """)

    print("Importerar data...")

    tables = [
        "user_profile",
        "activities",
        "health_daily",
        "sleep_daily",
        "vo2max_history",
        "personal_records",
    ]

    for table in tables:
        sc.execute(f"SELECT * FROM {table}")
        rows = sc.fetchall()
        if not rows:
            print(f"  {table}: tom, hoppar över")
            continue
        cols = rows[0].keys()
        col_names = [c for c in cols if c != "id"]
        placeholders = ", ".join(["%s"] * len(col_names))
        col_str = ", ".join(col_names)
        for row in rows:
            values = tuple(row[c] for c in col_names)
            try:
                pgc.execute(
                    f"INSERT INTO {table} ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING",
                    values
                )
            except Exception as e:
                print(f"  Fel på rad i {table}: {e}")
                pg.rollback()
                continue
        pg.commit()
        print(f"  {table}: {len(rows)} rader importerade")

    sqlite.close()
    pg.close()
    print("Migration klar!")

if __name__ == "__main__":
    migrate()