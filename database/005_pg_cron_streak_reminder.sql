-- ══════════════════════════════════════════════════════════
-- 005_pg_cron_streak_reminder.sql
-- Щоденний нагадувач про стрік о 20:00 UTC через pg_cron
--
-- Виконання:
--   Supabase Dashboard → SQL Editor → Run
--
-- Вимоги:
--   - pg_cron: увімкнено за замовчуванням у Supabase
--   - pg_net:  увімкнути в Dashboard → Database → Extensions
--   - Edge Function streak-reminder задеплоєна в Supabase
--   - BASE_NOTIFICATIONS_API_KEY додано в Supabase Secrets
-- ══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Видалити старий job якщо існує (idempotent)
SELECT cron.unschedule('streak-reminder-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'streak-reminder-daily'
);

-- ── Cron: щодня о 20:00 UTC
-- Відправляє нотіфікейшн усім хто ще не зробив чекін сьогодні
SELECT cron.schedule(
  'streak-reminder-daily',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://xiyrzftdeefszsiukkjc.supabase.co/functions/v1/streak-reminder',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeXJ6ZnRkZWVmc3pzaXVra2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTc3MzgsImV4cCI6MjA5MTEzMzczOH0.uM1JOb9m2V-oq6IDZZGZhD4u9w2WeCRREav-9okOV9g"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ── Перевірка що job успішно створено
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'streak-reminder-daily';
