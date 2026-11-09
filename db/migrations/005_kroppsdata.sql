-- Applicerad på Supabase (training-agent) 2026-11-09 som "kroppsdata"
ALTER TABLE users
    ADD COLUMN langd_cm REAL,
    ADD COLUMN fodelsear INTEGER,
    ADD COLUMN kon TEXT CHECK (kon IN ('man', 'kvinna'));

CREATE TABLE weight_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    datum TEXT NOT NULL,
    vikt_kg REAL NOT NULL,
    fett_procent REAL,   -- uppmätt (smartvåg); NULL = appen uppskattar
    muskel_kg REAL,      -- uppmätt (smartvåg); uppskattas aldrig
    kalla TEXT DEFAULT 'manuell',
    UNIQUE (datum, user_id)
);
ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;
