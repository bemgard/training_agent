-- Applicerad på Supabase (training-agent) 2026-11-11 som "feedback"
-- Feedback från streckgubben + tumme upp/ner på coachen. Adminflagga styr vem som ser inkorgen.
ALTER TABLE users ADD COLUMN admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    typ TEXT NOT NULL CHECK (typ IN ('fel', 'ide', 'gillar', 'annat')),
    text TEXT NOT NULL,
    kontext TEXT,                    -- JSON: flik, enhet, skärmbredd, version
    status TEXT NOT NULL DEFAULT 'ny' CHECK (status IN ('ny', 'planerad', 'klar', 'avvisad')),
    svar TEXT,                       -- Calles meddelande till användaren när något är klart
    svar_sett BOOLEAN NOT NULL DEFAULT FALSE,
    skapad TIMESTAMPTZ DEFAULT now(),
    uppdaterad TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX feedback_status ON feedback (status, skapad);
CREATE INDEX feedback_user ON feedback (user_id);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE TABLE coach_betyg (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kalla TEXT NOT NULL CHECK (kalla IN ('insikt', 'chatt')),
    ref TEXT NOT NULL,               -- insikt: "<datum>:<typ>", chatt: "<samtal_id>:<meddelandeindex>"
    betyg INTEGER NOT NULL CHECK (betyg IN (-1, 1)),
    orsak TEXT,
    utdrag TEXT,                     -- början av det bedömda svaret, så att Calle ser vad det gällde
    skapad TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, kalla, ref)
);
ALTER TABLE coach_betyg ENABLE ROW LEVEL SECURITY;
