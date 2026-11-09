-- Applicerad på Supabase (training-agent) 2026-11-09 som "sync_log"
CREATE TABLE sync_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start TIMESTAMPTZ NOT NULL DEFAULT now(),
    slut TIMESTAMPTZ,
    ok BOOLEAN,
    kalla TEXT NOT NULL,          -- 'manuell' | 'schema'
    meddelande TEXT               -- sista raderna av output/fel
);
CREATE INDEX sync_log_user_start ON sync_log (user_id, start DESC);
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
