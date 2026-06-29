-- database/Season 2/053_stagger_raffle_swap.sql
-- Migration: Swap Raffle cron jobs stagger timing to make USDC run immediately at :00 (like Season 1)
--            and $HH run with a 30-second delay.

-- 1. Unschedule the old HH and USDC cron jobs if they exist
SELECT cron.unschedule('draw-round-hh-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'draw-round-hh-hourly'
);

SELECT cron.unschedule('draw-round-usdc-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'draw-round-usdc-hourly'
);

-- 2. Schedule USDC Raffle to run immediately at minute 0 of every hour (no delay)
SELECT cron.schedule(
  'draw-round-usdc-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://xiyrzftdeefszsiukkjc.supabase.co/functions/v1/draw-round-usdc',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeXJ6ZnRkZWVmc3pzaXVra2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTc3MzgsImV4cCI6MjA5MTEzMzczOH0.uM1JOb9m2V-oq6IDZZGZhD4u9w2WeCRREav-9okOV9g"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- 3. Schedule $HH Raffle to run at minute 0 of every hour, but with a 30-second CTE delay
SELECT cron.schedule(
  'draw-round-hh-hourly',
  '0 * * * *',
  $$
  WITH delay AS (
    SELECT pg_sleep(30)
  )
  SELECT net.http_post(
    url     := 'https://xiyrzftdeefszsiukkjc.supabase.co/functions/v1/draw-round-hh',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeXJ6ZnRkZWVmc3pzaXVra2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTc3MzgsImV4cCI6MjA5MTEzMzczOH0.uM1JOb9m2V-oq6IDZZGZhD4u9w2WeCRREav-9okOV9g"}'::jsonb,
    body    := '{}'::jsonb
  ) FROM delay;
  $$
);
