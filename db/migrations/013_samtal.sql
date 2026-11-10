-- Applicerad på Supabase (training-agent) 2026-11-10 som "samtal"
-- Sparade konversationer med coachen. Historiken byggs på servern — klienten skickar bara nya meddelandet.
CREATE TABLE samtal (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titel TEXT NOT NULL,
    skapad TIMESTAMPTZ DEFAULT now(),
    uppdaterad TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX samtal_user ON samtal (user_id, uppdaterad);
ALTER TABLE samtal ENABLE ROW LEVEL SECURITY;

CREATE TABLE meddelanden (
    id SERIAL PRIMARY KEY,
    samtal_id INTEGER NOT NULL REFERENCES samtal(id) ON DELETE CASCADE,
    roll TEXT NOT NULL CHECK (roll IN ('user', 'assistant')),
    innehall TEXT NOT NULL,
    skapad TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX meddelanden_samtal ON meddelanden (samtal_id, id);
ALTER TABLE meddelanden ENABLE ROW LEVEL SECURITY;
