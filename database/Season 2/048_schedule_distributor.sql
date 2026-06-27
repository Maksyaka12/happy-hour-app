-- database/Season 2/048_schedule_distributor.sql
-- Migration: Schedule daily rewards distributor in pg_cron and run backfill for existing users.

-- ── 1. Schedule daily-rewards-distributor cron job ───────────────────────
SELECT cron.unschedule('daily-rewards-distributor')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-rewards-distributor'
);

SELECT cron.schedule(
  'daily-rewards-distributor',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://xiyrzftdeefszsiukkjc.supabase.co/functions/v1/daily-rewards-distributor',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeXJ6ZnRkZWVmc3pzaXVra2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTc3MzgsImV4cCI6MjA5MTEzMzczOH0.uM1JOb9m2V-oq6IDZZGZhD4u9w2WeCRREav-9okOV9g"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ── 2. Run retrospective backfill for holding days & staked cumulative ──────
WITH hold_counts AS (
  SELECT lower(user_address) AS address, COUNT(*) AS cnt
  FROM public.holding_rewards_history
  WHERE balance >= 17000000
  GROUP BY lower(user_address)
),
stake_max AS (
  SELECT lower(user_address) AS address, MAX(staked_amount) AS max_staked
  FROM public.staking_rewards_history
  GROUP BY lower(user_address)
)
INSERT INTO public.hh_distribution_criteria (address, holding_days, staked_cumulative, updated_at)
SELECT 
  u.address,
  COALESCE(hc.cnt, 0) AS holding_days,
  COALESCE(sm.max_staked, 0) AS staked_cumulative,
  NOW()
FROM public.users u
LEFT JOIN hold_counts hc ON u.address = hc.address
LEFT JOIN stake_max sm ON u.address = sm.address
ON CONFLICT (address) DO UPDATE
SET
  holding_days = EXCLUDED.holding_days,
  staked_cumulative = GREATEST(hh_distribution_criteria.staked_cumulative, EXCLUDED.staked_cumulative),
  updated_at = NOW();
