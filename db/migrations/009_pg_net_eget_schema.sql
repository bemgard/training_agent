-- Applicerad på Supabase (training-agent) 2026-11-09 som "pg_net_eget_schema"
-- Supabase säkerhetsråd: tillägg ska inte ligga i public-schemat
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
