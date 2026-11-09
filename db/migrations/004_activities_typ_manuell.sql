-- Applicerad på Supabase (training-agent) 2026-11-09 som "activities_typ_manuell"
ALTER TABLE activities ADD COLUMN typ_manuell TEXT;  -- användarens egen klassning, skrivs aldrig över av synken
