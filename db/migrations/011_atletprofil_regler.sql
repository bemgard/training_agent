-- Applicerad på Supabase (training-agent) 2026-11-10 som "atletprofil_regler"
-- "Om mig": stabil bakgrund om atleten som coachen ska ta hänsyn till
CREATE TABLE atletprofil (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    erfarenhet TEXT CHECK (erfarenhet IN ('nyborjare', 'motionar', 'van', 'elit')),
    sporter TEXT,          -- fritext: "fotboll (division 4), löpning"
    utrustning TEXT,       -- kommaseparerat: gym,hemmagym,lopband,cykel,pool,kettlebell
    skador TEXT,           -- skador/historik, fritext
    preferenser TEXT,      -- t.ex. "tränar helst morgon, ogillar intervaller på bana"
    fritext TEXT,
    uppdaterad TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE atletprofil ENABLE ROW LEVEL SECURITY;

-- Egna klassningsregler: "Pass i <plats> som Garmin kallar <fran> och är kortare än <max_km> km räknas som <till>"
CREATE TABLE aktivitetsregler (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plats TEXT NOT NULL,
    fran_kategori TEXT NOT NULL,
    max_km REAL,
    till_kategori TEXT NOT NULL,
    skapad TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX aktivitetsregler_user ON aktivitetsregler (user_id);
ALTER TABLE aktivitetsregler ENABLE ROW LEVEL SECURITY;
