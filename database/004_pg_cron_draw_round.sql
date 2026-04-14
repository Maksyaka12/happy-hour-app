-- ══════════════════════════════════════════════════════════
-- 004_pg_cron_draw_round.sql
-- Автоматичний запуск розіграшу через pg_cron + pg_net
--
-- Виконання:
--   Supabase Dashboard → SQL Editor → Run
--
-- Вимоги:
--   - pg_cron: увімкнено за замовчуванням у Supabase
--   - pg_net:  увімкнути в Dashboard → Database → Extensions
-- ══════════════════════════════════════════════════════════

-- Переконатись що pg_net активний
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Видалити старий job якщо існує (idempotent, безпечно запускати повторно)
SELECT cron.unschedule('draw-round-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'draw-round-hourly'
);

-- ── Основний cron: щогодини рівно о :00
-- Викликає Edge Function draw-round через HTTP POST
SELECT cron.schedule(
  'draw-round-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://xiyrzftdeefszsiukkjc.supabase.co/functions/v1/draw-round',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeXJ6ZnRkZWVmc3pzaXVra2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTc3MzgsImV4cCI6MjA5MTEzMzczOH0.uM1JOb9m2V-oq6IDZZGZhD4u9w2WeCRREav-9okOV9g"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ── Перевірка що job успішно створено
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'draw-round-hourly';
