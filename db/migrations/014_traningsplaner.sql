-- Applicerad på Supabase (training-agent) 2026-11-10 som "traningsplaner"
-- Fas 2: strukturerade planer. En plan grupperar pass (en dag eller upp till två veckor) med titel och sammanfattning.
CREATE TABLE traningsplaner (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titel TEXT NOT NULL,
    sammanfattning TEXT,
    fran_datum TEXT NOT NULL,
    till_datum TEXT NOT NULL,
    samtal_id INTEGER,
    skapad TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX traningsplaner_user ON traningsplaner (user_id, fran_datum);
ALTER TABLE traningsplaner ENABLE ROW LEVEL SECURITY;

-- Pass blir strukturerade: kategori (samma nycklar som aktivitetstyp.KATEGORIER), steg för kondition,
-- övningar för styrka (JSON i innehall), förklaring och koppling till genomförd Garmin-aktivitet
ALTER TABLE planerade_pass
    ADD COLUMN plan_id INTEGER REFERENCES traningsplaner(id) ON DELETE SET NULL,
    ADD COLUMN kategori TEXT,
    ADD COLUMN titel TEXT,
    ADD COLUMN duration_min INTEGER,
    ADD COLUMN innehall TEXT,
    ADD COLUMN activity_id BIGINT,
    ADD COLUMN skapad TIMESTAMPTZ DEFAULT now();
CREATE INDEX planerade_pass_user_datum ON planerade_pass (user_id, datum);
