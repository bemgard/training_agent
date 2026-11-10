-- Applicerad på Supabase (training-agent) 2026-11-10 som "insikter"
-- Fas 4: coachens egna insikter — morgoninsikt efter morgonsynken och veckosammanfattning på söndagar
CREATE TABLE insikter (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    datum TEXT NOT NULL,                -- atletens lokala datum
    typ TEXT NOT NULL CHECK (typ IN ('morgon', 'vecka')),
    innehall TEXT NOT NULL,             -- JSON: rubrik, text, rekommendation, ev. plan / fokus
    antal INTEGER NOT NULL DEFAULT 1,   -- antal genereringar idag (tak mot kostnad)
    kalla TEXT,                         -- schema | manuell | uppdatera
    skapad TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, datum, typ)
);
ALTER TABLE insikter ENABLE ROW LEVEL SECURITY;
