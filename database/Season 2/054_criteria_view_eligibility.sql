-- database/Season 2/054_criteria_view_eligibility.sql
-- Migration: Add eligible and eligible_multiplier columns to user_distribution_criteria_view.
--            Allows admins to inspect user eligibility directly in Supabase dashboard.

DROP VIEW IF EXISTS public.user_distribution_criteria_view CASCADE;

CREATE OR REPLACE VIEW public.user_distribution_criteria_view AS
WITH stats AS (
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
  ) bt ON u.address = bt.address
)
SELECT
  *,
  (
    checkins >= 10 AND
    boosts >= 10 AND
    social_tasks >= 20 AND
    boxes >= 20 AND
    hh_burn_boxes >= 10 AND
    holding_days >= 10 AND
    raffles >= 10
  ) AS eligible,
  (
    (
      checkins >= 10 AND
      boosts >= 10 AND
      social_tasks >= 20 AND
      boxes >= 20 AND
      hh_burn_boxes >= 10 AND
      holding_days >= 10 AND
      raffles >= 10
    ) AND (
      staked_cumulative >= 40000000 OR
      referrals >= 3
    )
  ) AS eligible_multiplier
FROM stats;

-- Re-create get_user_distribution_criteria function to ensure it doesn't break and is updated
CREATE OR REPLACE FUNCTION public.get_user_distribution_criteria(p_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_checkins INTEGER := 0;
  v_boosts INTEGER := 0;
  v_boxes INTEGER := 0;
  v_holding_days INTEGER := 0;
  v_staked_cumulative NUMERIC := 0;
  v_referrals INTEGER := 0;
  v_social_tasks INTEGER := 0;
  v_hh_burn_boxes INTEGER := 0;
  v_raffles INTEGER := 0;
  v_eligible BOOLEAN := FALSE;
  v_eligible_multiplier BOOLEAN := FALSE;
BEGIN
  IF v_address IS NULL OR v_address = '' THEN
    RETURN jsonb_build_object(
      'checkins', 0,
      'boosts', 0,
      'boxes', 0,
      'holding_days', 0,
      'staked_cumulative', 0,
      'referrals', 0,
      'social_tasks', 0,
      'hh_burn_boxes', 0,
      'raffles', 0,
      'eligible', FALSE,
      'eligible_multiplier', FALSE
    );
  END IF;

  SELECT 
    checkins, boosts, boxes, holding_days, staked_cumulative, referrals, social_tasks, hh_burn_boxes, raffles, eligible, eligible_multiplier
  INTO 
    v_checkins, v_boosts, v_boxes, v_holding_days, v_staked_cumulative, v_referrals, v_social_tasks, v_hh_burn_boxes, v_raffles, v_eligible, v_eligible_multiplier
  FROM public.user_distribution_criteria_view
  WHERE address = v_address;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'checkins', 0,
      'boosts', 0,
      'boxes', 0,
      'holding_days', 0,
      'staked_cumulative', 0,
      'referrals', 0,
      'social_tasks', 0,
      'hh_burn_boxes', 0,
      'raffles', 0,
      'eligible', FALSE,
      'eligible_multiplier', FALSE
    );
  END IF;

  RETURN jsonb_build_object(
    'checkins', v_checkins,
    'boosts', v_boosts,
    'boxes', v_boxes,
    'holding_days', v_holding_days,
    'staked_cumulative', v_staked_cumulative,
    'referrals', v_referrals,
    'social_tasks', v_social_tasks,
    'hh_burn_boxes', v_hh_burn_boxes,
    'raffles', v_raffles,
    'eligible', v_eligible,
    'eligible_multiplier', v_eligible_multiplier
  );
END;
$$;

-- Re-grant permissions
GRANT SELECT ON public.user_distribution_criteria_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_distribution_criteria(TEXT) TO anon, authenticated, service_role;
