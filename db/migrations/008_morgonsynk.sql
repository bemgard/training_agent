-- APPLICERAS VID DEPLOY (när /api/sync/alla finns på Render) — inte före.
-- Morgonsynk kl 09:00 svensk tid för alla användare via Supabase pg_cron + pg_net.
-- pg_cron kör i UTC: jobbet körs 07:02 och 08:02 UTC och endpointen kör bara när
-- klockan är 9 i Stockholm (?lokal_timme=9) → alltid 09:02 oavsett sommar-/vintertid.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Hemligheten (samma som CRON_SECRET på Render) läggs i Supabase Vault, inte i klartext i jobbet:
--   SELECT vault.create_secret('<CRON_SECRET>', 'cron_secret');

SELECT cron.schedule(
  'morgonsynk',
  '2 7,8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://training-agent-waly.onrender.com/api/sync/alla?lokal_timme=9',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000   -- Render gratis kan behöva ~1 min för att vakna
  );
  $$
);

-- Kontroll efter körning:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
--   SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
--   SELECT user_id, start, ok, kalla, meddelande FROM sync_log ORDER BY start DESC LIMIT 10;
