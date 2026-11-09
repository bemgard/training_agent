-- Applicerad på Supabase (training-agent) 2026-11-05 som "garmin_tokens"
-- Sparar Garmin-tokens så synken inte behöver logga in med lösenord varje gång (undviker 429/Cloudflare)
ALTER TABLE users ADD COLUMN garmin_tokens TEXT;  -- Fernet-krypterade Garmin OAuth-tokens
