-- Applicerad på Supabase (training-agent) 2026-11-10 som "dagsform"
-- Självrapporterad dagsform — klockan känner inte feber, halsont eller smärta
CREATE TABLE dagsform (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    datum TEXT NOT NULL,            -- atletens lokala datum (YYYY-MM-DD)
    allmant TEXT CHECK (allmant IN ('pigg', 'okej', 'trott', 'krasslig')),
    symtom TEXT,                    -- kommaseparerat: halsont,snuva,hosta,feber,illamaende,kroppsvark
    temp REAL,                      -- uppmätt kroppstemperatur (valfritt)
    fritext TEXT,
    uppdaterad TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, datum)
);
ALTER TABLE dagsform ENABLE ROW LEVEL SECURITY;

-- Besvär i en kroppsdel som följer med dag till dag tills atleten markerar dem som borta
CREATE TABLE besvar (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kroppsdel TEXT NOT NULL,
    typ TEXT NOT NULL CHECK (typ IN ('traningsvark', 'stelhet', 'skarp', 'loppsteg')),
    niva INTEGER NOT NULL CHECK (niva BETWEEN 1 AND 10),
    niva_start INTEGER NOT NULL,
    start_datum TEXT NOT NULL,
    senast_datum TEXT NOT NULL,     -- senast atleten uppdaterade nivån
    aktiv BOOLEAN NOT NULL DEFAULT TRUE,
    slut_datum TEXT,
    anteckning TEXT,
    skapad TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX besvar_user_aktiv ON besvar (user_id, aktiv);
ALTER TABLE besvar ENABLE ROW LEVEL SECURITY;
