-- Applicerad på Supabase (training-agent) 2026-11-05 som "sleep_hrv_readiness"
-- Fält från get_sleep_data / get_hrv_data / get_training_readiness (verifierat mot Cirqa-data)
ALTER TABLE sleep_daily
    ADD COLUMN rem_sov_min REAL,
    ADD COLUMN somnpoang INTEGER,
    ADD COLUMN somn_kvalitet TEXT,
    ADD COLUMN hrv_natt REAL,
    ADD COLUMN hrv_status TEXT,
    ADD COLUMN hrv_7d REAL,
    ADD COLUMN hrv_baslinje_lag REAL,
    ADD COLUMN hrv_baslinje_hog REAL,
    ADD COLUMN vilopuls_natt INTEGER,
    ADD COLUMN andning_snitt REAL,
    ADD COLUMN somnstress REAL,
    ADD COLUMN bb_laddning INTEGER,
    ADD COLUMN hudtemp_avvikelse REAL;

CREATE TABLE readiness_daily (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    datum TEXT NOT NULL,
    poang INTEGER,
    niva TEXT,
    feedback TEXT,
    somn_faktor INTEGER,
    aterhamtning_faktor INTEGER,
    belastning_faktor INTEGER,
    stress_faktor INTEGER,
    hrv_faktor INTEGER,
    somnhistorik_faktor INTEGER,
    akut_belastning INTEGER,
    aterhamtning_min INTEGER,
    uppdaterad TEXT,
    UNIQUE (datum, user_id)
);
ALTER TABLE readiness_daily ENABLE ROW LEVEL SECURITY;
