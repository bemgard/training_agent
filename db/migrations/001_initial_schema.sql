-- Applicerad på Supabase (training-agent) 2026-11-05 som "initial_schema"
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    lösenord_hash TEXT NOT NULL,
    garmin_email TEXT,
    garmin_password TEXT,
    skapad TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_profile (
    id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    langd_cm REAL,
    vikt_kg REAL,
    vo2max REAL
);

CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id BIGINT,
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
    plats TEXT,
    snitt_kadens REAL,
    zon1_sek INTEGER, zon2_sek INTEGER, zon3_sek INTEGER, zon4_sek INTEGER, zon5_sek INTEGER,
    UNIQUE (user_id, activity_id)
);
CREATE INDEX activities_user_datum ON activities (user_id, datum);

CREATE TABLE health_daily (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    datum TEXT NOT NULL,
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
    andning_snitt REAL,
    UNIQUE (datum, user_id)
);

CREATE TABLE sleep_daily (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    datum TEXT NOT NULL,
    sovtid_min REAL,
    djup_sov_min REAL,
    latt_sov_min REAL,
    vaken_min REAL,
    bekraftad INTEGER,
    UNIQUE (datum, user_id)
);

CREATE TABLE vo2max_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    datum TEXT NOT NULL,
    vo2max REAL,
    UNIQUE (datum, user_id)
);

CREATE TABLE personal_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    typ TEXT,
    värde_sek REAL,
    formaterat TEXT,
    datum TEXT,
    aktivitet_id BIGINT,
    current INTEGER DEFAULT 1
);
CREATE INDEX personal_records_user ON personal_records (user_id, typ);

CREATE TABLE race_predictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    datum TEXT NOT NULL,
    time_5k INTEGER,
    time_10k INTEGER,
    time_half INTEGER,
    time_marathon INTEGER,
    UNIQUE (user_id, datum)
);

CREATE TABLE planerade_pass (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    datum TEXT,
    typ TEXT,
    distans_km REAL,
    tempo TEXT,
    pulszon TEXT,
    syfte TEXT
);

-- Blockera Supabase publika REST-API; backend ansluter som ägare och berörs inte
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE vo2max_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE planerade_pass ENABLE ROW LEVEL SECURITY;
