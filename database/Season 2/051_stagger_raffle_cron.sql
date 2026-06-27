-- database/Season 2/051_stagger_raffle_cron.sql
-- Migration: Stagger $HH Raffle cron job to run at minute :02 instead of :00.
--            This prevents EOA nonce collisions with the USDC Raffle cron job (which runs at :00)
--            and guarantees both transactions are processed successfully on-chain.

-- 1. Unschedule the old HH cron job
SELECT cron.unschedule('draw-round-hh-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'draw-round-hh-hourly'
);

-- 2. Reschedule at minute 2 of every hour
SELECT cron.schedule(
  'draw-round-hh-hourly',
  '2 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://xiyrzftdeefszsiukkjc.supabase.co/functions/v1/draw-round-hh',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeXJ6ZnRkZWVmc3pzaXVra2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTc3MzgsImV4cCI6MjA5MTEzMzczOH0.uM1JOb9m2V-oq6IDZZGZhD4u9w2WeCRREav-9okOV9g"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
