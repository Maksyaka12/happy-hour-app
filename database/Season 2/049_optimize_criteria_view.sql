-- database/Season 2/049_optimize_criteria_view.sql
-- Migration: Optimize user_distribution_criteria_view using pre-grouped LEFT JOINs
--            to reduce PostgreSQL query planner cost estimation and prevent Supabase timeout warnings.

DROP VIEW IF EXISTS public.user_distribution_criteria_view CASCADE;

CREATE OR REPLACE VIEW public.user_distribution_criteria_view AS
SELECT
  u.address,
  u.basename,
  (COALESCE(c.cnt, 0) + COALESCE(dc.adjust_checkins, 0)) AS checkins,
  (COALESCE(b.cnt, 0) + COALESCE(dc.adjust_boosts, 0)) AS boosts,
  (COALESCE(bx.cnt, 0) + COALESCE(dc.adjust_boxes, 0)) AS boxes,
  (COALESCE(dc.holding_days, 0) + COALESCE(dc.adjust_holding_days, 0)) AS holding_days,
  (COALESCE(dc.staked_cumulative, 0) + COALESCE(dc.adjust_staked_cumulative, 0)) AS staked_cumulative,
  (COALESCE(r.cnt, 0) + COALESCE(dc.adjust_referrals, 0)) AS referrals,
  (COALESCE(t.cnt, 0) + COALESCE(dc.adjust_social_tasks, 0)) AS social_tasks,
  (COALESCE(hbx.cnt, 0) + COALESCE(hb.cnt, 0) + COALESCE(dc.adjust_hh_burn_boxes, 0)) AS hh_burn_boxes,
  (COALESCE(bt.cnt, 0) + COALESCE(dc.adjust_raffles, 0)) AS raffles
FROM public.users u
LEFT JOIN public.hh_distribution_criteria dc ON u.address = dc.address
LEFT JOIN (
  SELECT address, COUNT(*) AS cnt
  FROM public.checkins
  GROUP BY address
) c ON u.address = c.address
LEFT JOIN (
  SELECT address, COUNT(*) AS cnt
  FROM public.hp_boosts
  GROUP BY address
) b ON u.address = b.address
LEFT JOIN (
  SELECT address, COUNT(*) AS cnt
  FROM public.opened_boxes
  WHERE box_type NOT IN ('standard_bundle', 'happy_bundle', 'shield', 'extra_attempt')
  GROUP BY address
) bx ON u.address = bx.address
LEFT JOIN (
  SELECT address, COUNT(*) AS cnt
  FROM public.opened_boxes
  WHERE is_hh = true AND box_type NOT IN ('standard_bundle', 'happy_bundle', 'shield', 'extra_attempt')
  GROUP BY address
) hbx ON u.address = hbx.address
LEFT JOIN (
  SELECT user_address AS address, COUNT(*) AS cnt
  FROM public.hh_burns
  GROUP BY user_address
) hb ON u.address = hb.address
LEFT JOIN (
  SELECT u2.referrer AS address, COUNT(*) AS cnt
  FROM public.users u2
  WHERE (
    SELECT COALESCE(SUM(ds.tx_count), 0)
    FROM public.daily_stats ds
    WHERE ds.address = u2.address
  ) >= 5
  GROUP BY u2.referrer
) r ON u.address = r.address
LEFT JOIN (
  SELECT address, COUNT(*) AS cnt
  FROM public.task_completions
  GROUP BY address
) t ON u.address = t.address
LEFT JOIN (
  SELECT address, COUNT(*) AS cnt
  FROM (
    SELECT address FROM public.bets
    UNION ALL
    SELECT address FROM public.bets_hh
  ) combined_bets
  GROUP BY address
) bt ON u.address = bt.address;

-- Re-grant permissions
GRANT SELECT ON public.user_distribution_criteria_view TO anon, authenticated;
