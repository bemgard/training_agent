-- Applicerad på Supabase (training-agent) 2026-11-10 som "garmin_pass"
-- Fas 3: koppling mellan planerat pass och passet i Garmin Connect (för att kunna ta bort/flytta det där)
ALTER TABLE planerade_pass
    ADD COLUMN garmin_workout_id BIGINT,
    ADD COLUMN garmin_schedule_id BIGINT,
    ADD COLUMN garmin_skickad TIMESTAMPTZ;
