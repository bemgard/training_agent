-- Applicerad på Supabase (training-agent) 2026-11-10 som "mal"
CREATE TABLE mal (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    typ TEXT NOT NULL CHECK (typ IN ('grundtraning', 'lopp', 'forsasong', 'halsa')),
    titel TEXT NOT NULL,
    slutdatum TEXT,                 -- loppdatum / säsongsstart / "fram till" (valfritt)
    distans_km REAL,                -- lopp
    maltid TEXT,                    -- lopp, t.ex. "1:45:00"
    sport TEXT,                     -- försäsong
    fokus TEXT,                     -- kommaseparerat: kondition,styrka,rorlighet,snabbhet
    kondition_per_vecka INTEGER,
    styrka_per_vecka INTEGER,
    traningsdagar TEXT,             -- kommaseparerat: man,tis,ons,tor,fre,lor,son
    anteckning TEXT,
    aktiv BOOLEAN NOT NULL DEFAULT TRUE,
    skapad TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX mal_user_aktiv ON mal (user_id, aktiv);
ALTER TABLE mal ENABLE ROW LEVEL SECURITY;
