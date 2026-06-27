-- database/Season 2/047_fix_criteria_logic.sql
-- Migration: Fix criteria logic for $HH Burn in Boxes and Daily HP Boosts,
--            and make record_passive_rewards_batch compatible with all distributor payloads.

-- ── 1. Rebuild record_passive_rewards_batch function ───────────────────────────
CREATE OR REPLACE FUNCTION public.record_passive_rewards_batch(p_rewards JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reward JSONB;
  v_address TEXT;
  v_hold_balance NUMERIC;
  v_hold_hp NUMERIC;
  v_stake_balance NUMERIC;
  v_stake_hp NUMERIC;
BEGIN
  FOR v_reward IN SELECT * FROM jsonb_array_elements(p_rewards) LOOP
    v_address := lower(trim(v_reward->>'address'));
    
    -- Support both hold_balance and hh_balance keys for maximum compatibility
    v_hold_balance := COALESCE(
      (v_reward->>'hold_balance')::NUMERIC,
      (v_reward->>'hh_balance')::NUMERIC,
      0
    );
    v_hold_hp := COALESCE((v_reward->>'hold_hp')::NUMERIC, 0);
    
    -- Support both stake_balance and hh_staked keys for maximum compatibility
    v_stake_balance := COALESCE(
      (v_reward->>'stake_balance')::NUMERIC,
      (v_reward->>'hh_staked')::NUMERIC,
      0
    );
    v_stake_hp := COALESCE((v_reward->>'stake_hp')::NUMERIC, 0);

    -- Sync user profile if needed
    PERFORM sync_user_profile(v_address, NULL, NULL);

    -- 1. Process Holding Rewards
    IF v_hold_hp > 0.01 THEN
      INSERT INTO public.holding_rewards_history (user_address, balance, hp_rewarded)
      VALUES (v_address, v_hold_balance, v_hold_hp);
      
      PERFORM public.add_points(v_address, v_hold_hp, 'holding_reward');
    END IF;

    -- 2. Process Staking Rewards
    IF v_stake_hp > 0.01 THEN
      INSERT INTO public.staking_rewards_history (user_address, staked_amount, hp_rewarded)
      VALUES (v_address, v_stake_balance, v_stake_hp);
      
      PERFORM public.add_points(v_address, v_stake_hp, 'staking_reward');
    END IF;

    -- 3. Update $HH Distribution Criteria
    INSERT INTO public.hh_distribution_criteria (address, holding_days, staked_cumulative, updated_at)
    VALUES (
      v_address,
      CASE WHEN v_hold_balance >= 17000000 THEN 1 ELSE 0 END,
      v_stake_balance,
      NOW()
    )
    ON CONFLICT (address) DO UPDATE
    SET
      holding_days = hh_distribution_criteria.holding_days + CASE WHEN v_hold_balance >= 17000000 THEN 1 ELSE 0 END,
      staked_cumulative = GREATEST(hh_distribution_criteria.staked_cumulative, v_stake_balance),
      updated_at = NOW();
  END LOOP;
END;
$$;

-- ── 2. Rebuild user_distribution_criteria_view with correct logic ─────────────
DROP VIEW IF EXISTS public.user_distribution_criteria_view CASCADE;

CREATE OR REPLACE VIEW public.user_distribution_criteria_view AS
SELECT
  u.address,
  u.basename,
  (
    COALESCE((SELECT COUNT(*) FROM public.checkins WHERE address = u.address), 0) + 
    COALESCE(dc.adjust_checkins, 0)
  ) AS checkins,
  (
    COALESCE((SELECT COUNT(*) FROM public.hp_boosts WHERE address = u.address), 0) + 
    COALESCE(dc.adjust_boosts, 0)
  ) AS boosts,
  (
    COALESCE((SELECT COUNT(*) FROM public.opened_boxes WHERE address = u.address AND box_type NOT IN ('standard_bundle', 'happy_bundle', 'shield', 'extra_attempt')), 0) + 
    COALESCE(dc.adjust_boxes, 0)
  ) AS boxes,
  (
    COALESCE(dc.holding_days, 0) + 
    COALESCE(dc.adjust_holding_days, 0)
  ) AS holding_days,
  (
    COALESCE(dc.staked_cumulative, 0) + 
    COALESCE(dc.adjust_staked_cumulative, 0)
  ) AS staked_cumulative,
  (
    COALESCE(
      (
        SELECT COUNT(*)
        FROM public.users u2
        WHERE u2.referrer = u.address
          AND (SELECT COALESCE(SUM(ds.tx_count), 0) FROM public.daily_stats ds WHERE ds.address = u2.address) >= 5
      ), 0
    ) + COALESCE(dc.adjust_referrals, 0)
  ) AS referrals,
  (
    COALESCE((SELECT COUNT(*) FROM public.task_completions WHERE address = u.address), 0) + 
    COALESCE(dc.adjust_social_tasks, 0)
  ) AS social_tasks,
  (
    COALESCE((SELECT COUNT(*) FROM public.opened_boxes WHERE address = u.address AND is_hh = true AND box_type NOT IN ('standard_bundle', 'happy_bundle', 'shield', 'extra_attempt')), 0) +
    COALESCE((SELECT COUNT(*) FROM public.hh_burns WHERE user_address = u.address), 0) +
    COALESCE(dc.adjust_hh_burn_boxes, 0)
  ) AS hh_burn_boxes,
  (
    COALESCE(
      (
        SELECT COUNT(*) 
        FROM (
          SELECT address FROM public.bets WHERE address = u.address
          UNION ALL
          SELECT address FROM public.bets_hh WHERE address = u.address
        ) combined_bets
      ), 0
    ) + COALESCE(dc.adjust_raffles, 0)
  ) AS raffles
FROM public.users u
LEFT JOIN public.hh_distribution_criteria dc ON u.address = dc.address;

-- ── 3. Re-grant permissions ────────────────────────────────────────────────────
GRANT SELECT ON public.user_distribution_criteria_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_passive_rewards_batch(JSONB) TO service_role;
