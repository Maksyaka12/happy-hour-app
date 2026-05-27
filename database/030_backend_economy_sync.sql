-- database/030_backend_economy_sync.sql
-- Unified Database Migration to perfectly align with V2/V3 economy

-- 1. Drop old/obsolete economy functions
DROP FUNCTION IF EXISTS open_happy_box(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS buy_multiplier(TEXT, TEXT, NUMERIC);


-- 2. Update open_standard_chest (Happy Box, cost: 0.30 USDC) to drop between 2.0 and 15.0 HP
CREATE OR REPLACE FUNCTION open_standard_chest(
  p_address TEXT,
  p_tx_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_hp_won NUMERIC;
  v_applied_mult NUMERIC;
  v_price NUMERIC := 0.30;
BEGIN
  -- Input validation
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
  END IF;

  -- Sync user profile if needed
  PERFORM sync_user_profile(v_address, NULL, NULL);

  -- Check if tx_hash already used
  IF EXISTS (SELECT 1 FROM opened_boxes WHERE tx_hash = v_tx_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transaction already processed');
  END IF;

  -- Generate random reward between 2.0 and 15.0, rounded to 1 decimal place
  v_hp_won := ROUND((random() * (15.0 - 2.0) + 2.0)::numeric, 1);

  -- Add points using the user's permanent HP Boost (multiplier)
  v_applied_mult := add_points(v_address, v_hp_won, 'box_open');

  -- Record box open entry with multiplier_won = 1.0 (no temp multipliers)
  INSERT INTO opened_boxes (
    address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash
  ) VALUES (
    v_address, 'happy', v_hp_won, v_applied_mult, 1.0, v_price, v_tx_hash
  );

  -- Increment user's total spent
  UPDATE users SET total_spent = total_spent + v_price WHERE address = v_address;

  -- Increment daily stats
  INSERT INTO daily_stats (address, day, tx_count) 
  VALUES (v_address, CURRENT_DATE, 1) 
  ON CONFLICT (address, day) 
  DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object(
    'ok', true,
    'hp_won', ROUND(v_hp_won * v_applied_mult, 1),
    'base_hp', v_hp_won,
    'applied_multiplier', v_applied_mult
  );
END;
$$;


-- 3. Update open_all_chests (Happy Boxes 6-pack, cost: 1.50 USDC) to drop between 2.0 and 15.0 HP per chest
CREATE OR REPLACE FUNCTION open_all_chests(
  p_address TEXT,
  p_tx_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_price NUMERIC := 1.50;
  v_rewards JSONB := jsonb_build_array();
  v_hp_won NUMERIC;
  v_applied_mult NUMERIC;
  v_total_hp_won NUMERIC := 0.0;
  v_sum_base_hp NUMERIC := 0.0;
  v_idx INTEGER;
BEGIN
  -- Input validation
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
  END IF;

  -- Sync user profile if needed
  PERFORM sync_user_profile(v_address, NULL, NULL);

  -- Check if base tx_hash already used
  IF EXISTS (SELECT 1 FROM opened_boxes WHERE tx_hash = v_tx_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transaction already processed');
  END IF;

  -- Open 6 chests
  FOR v_idx IN 1..6 LOOP
    -- Generate random reward between 2.0 and 15.0, rounded to 1 decimal place
    v_hp_won := ROUND((random() * (15.0 - 2.0) + 2.0)::numeric, 1);
    
    -- Add points
    v_applied_mult := add_points(v_address, v_hp_won, 'box_open');
    v_total_hp_won := v_total_hp_won + (v_hp_won * v_applied_mult);
    v_sum_base_hp := v_sum_base_hp + v_hp_won;

    -- Record each box open with a unique transaction hash suffix
    INSERT INTO opened_boxes (
      address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash
    ) VALUES (
      v_address, 'happy_all', v_hp_won, v_applied_mult, 1.0, 0.25, v_tx_hash || '_' || v_idx
    );

    -- Append to rewards array
    v_rewards := v_rewards || jsonb_build_object(
      'index', v_idx,
      'hp_won', ROUND(v_hp_won * v_applied_mult, 1),
      'base_hp', v_hp_won,
      'applied_multiplier', v_applied_mult
    );
  END LOOP;

  -- Insert a master tracking entry for the transaction hash so it cannot be double spent
  INSERT INTO opened_boxes (
    address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash
  ) VALUES (
    v_address, 'happy_bundle', v_sum_base_hp, v_applied_mult, 1.0, v_price, v_tx_hash
  );

  -- Increment user's total spent
  UPDATE users SET total_spent = total_spent + v_price WHERE address = v_address;

  -- Increment daily stats
  INSERT INTO daily_stats (address, day, tx_count) 
  VALUES (v_address, CURRENT_DATE, 1) 
  ON CONFLICT (address, day) 
  DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object(
    'ok', true,
    'total_hp_won', ROUND(v_total_hp_won, 1),
    'rewards', v_rewards
  );
END;
$$;


-- 4. Update record_deposit to award exactly 0 HP for bets
CREATE OR REPLACE FUNCTION record_deposit(
  p_round_id BIGINT,
  p_address TEXT,
  p_amount NUMERIC,
  p_tickets INTEGER,
  p_tx_hash TEXT,
  p_block_number BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_inserted BIGINT;
BEGIN
  IF p_round_id IS NULL OR v_address IS NULL OR v_address = '' OR p_amount IS NULL OR p_amount <= 0 OR p_tickets IS NULL OR p_tickets <= 0 OR p_tx_hash IS NULL OR trim(p_tx_hash) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid deposit payload');
  END IF;
  PERFORM sync_user_profile(v_address, NULL, NULL);

  INSERT INTO bets (round_id, address, amount, tickets, tx_hash, block_number)
  VALUES (p_round_id, v_address, p_amount, p_tickets, lower(trim(p_tx_hash)), p_block_number)
  ON CONFLICT (tx_hash) DO NOTHING RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN jsonb_build_object('ok', false, 'duplicate', true); END IF;

  UPDATE rounds SET total_pot = total_pot + p_amount WHERE id = p_round_id;
  -- HP removed completely for raffle deposits/bets! Only activity points are granted.
  PERFORM increment_entries(v_address);

  -- ACTIVITY TRACKING
  INSERT INTO daily_stats (address, day, tx_count)
  VALUES (v_address, CURRENT_DATE, 1)
  ON CONFLICT (address, day) DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'roundId', p_round_id, 'tickets', p_tickets);
END;
$$;


-- 5. Update claim_task_completion to award exactly 0 HP for quests
CREATE OR REPLACE FUNCTION claim_task_completion(
  p_task_id TEXT,
  p_address TEXT,
  p_tx_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_task tasks;
  v_inserted BIGINT;
BEGIN
  IF v_address IS NULL OR v_address = '' OR p_task_id IS NULL OR trim(p_task_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing task or address');
  END IF;
  PERFORM sync_user_profile(v_address, NULL, NULL);
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id AND expires_at > NOW();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Task not found or expired'); END IF;

  INSERT INTO task_completions (task_id, address, tx_hash) VALUES (p_task_id, v_address, lower(trim(p_tx_hash)))
  ON CONFLICT (task_id, address) DO NOTHING RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Task already claimed'); END IF;

  -- HP removed completely for quests/tasks! Only activity points are granted.

  -- ACTIVITY TRACKING
  INSERT INTO daily_stats (address, day, tasks_done, tx_count)
  VALUES (v_address, CURRENT_DATE, 1, 1)
  ON CONFLICT (address, day) DO UPDATE
  SET tasks_done = daily_stats.tasks_done + 1, tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'pointsAwarded', 0.00, 'txHash', p_tx_hash);
END;
$$;


-- 6. Update update_daily_score to the correct V3 activity formula weights
-- Weights: Checkin = 30 AP, Streak = daily_stats.streak, Tasks = 10 AP, Tx = 10 AP, Posts = 30 AP
CREATE OR REPLACE FUNCTION update_daily_score(p_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO daily_stats (address, day)
  VALUES (lower(p_address), CURRENT_DATE)
  ON CONFLICT (address, day) DO UPDATE
  SET 
    score = (daily_stats.checkin_done::int * 30) + 
            daily_stats.streak + 
            (daily_stats.tasks_done * 10) + 
            (daily_stats.tx_count * 10) + 
            (daily_stats.posts_approved * 30),
    updated_at = NOW();
END;
$$;


-- 7. Update distribute_daily_rewards to award correct Top-30 payouts
CREATE OR REPLACE FUNCTION distribute_daily_rewards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_rank INTEGER := 0;
  v_reward NUMERIC;
  v_day DATE := (CURRENT_DATE - INTERVAL '1 day')::DATE;
BEGIN
  FOR r IN (
    SELECT address, score 
    FROM daily_stats 
    WHERE day = v_day 
    ORDER BY score DESC, updated_at ASC 
    LIMIT 30
  ) LOOP
    v_rank := v_rank + 1;
    
    CASE 
      WHEN v_rank = 1 THEN v_reward := 20.00;
      WHEN v_rank <= 5 THEN v_reward := 15.00;
      WHEN v_rank <= 10 THEN v_reward := 10.00;
      WHEN v_rank <= 20 THEN v_reward := 5.00;
      WHEN v_rank <= 30 THEN v_reward := 3.00;
      ELSE v_reward := 0.00;
    END CASE;

    IF v_reward > 0.00 THEN
      UPDATE users SET points = points + v_reward WHERE address = r.address;
      INSERT INTO activity_rewards (address, day, rank, points)
      VALUES (r.address, v_day, v_rank, v_reward);
    END IF;
  END LOOP;
END;
$$;


-- 8. Re-create user_activity view for accurate history logging
DROP VIEW IF EXISTS user_activity;
CREATE OR REPLACE VIEW user_activity AS

-- 1. Daily Check-ins (Streak)
SELECT
  'checkin-' || id AS id,
  lower(address) AS address,
  'Daily Claim' AS action,
  'Streak' AS badge,
  '+' || CASE WHEN created_at < '2026-05-07 12:00:00+00' THEN ROUND(points * multiplier * 100, 2) ELSE ROUND(points * multiplier, 2) END || ' HP' AS value,
  'checkin' AS type,
  multiplier AS boost_mult,
  created_at
FROM checkins

UNION ALL

-- 2. Raffle Winner Reward
SELECT
  'win-' || id AS id,
  lower(winner) AS address,
  'Reward' AS action,
  'Win Round ' || id AS badge,
  '+' || CASE WHEN ends_at < '2026-05-07 12:00:00+00' THEN ROUND(5.0 * COALESCE(winner_multiplier, 1.0) * 100, 2) ELSE ROUND(1.00 * COALESCE(winner_multiplier, 1.0), 2) END || ' HP' AS value,
  'win' AS type,
  COALESCE(winner_multiplier, 1.0) AS boost_mult,
  ends_at AS created_at
FROM rounds
WHERE winner IS NOT NULL AND status = 'done'

UNION ALL

-- 3. Completed Quests / Tasks (Historical claims before migration date 2026-05-27)
SELECT
  'tc-' || tc.id AS id,
  lower(tc.address) AS address,
  'Quest' AS action,
  t.type AS badge,
  '+' || CASE WHEN tc.completed_at < '2026-05-07 12:00:00+00' THEN ROUND(t.points * COALESCE(tc.multiplier, 1.0) * 100, 2) ELSE ROUND(t.points * COALESCE(tc.multiplier, 1.0), 2) END || ' HP' AS value,
  'quest' AS type,
  COALESCE(tc.multiplier, 1.0) AS boost_mult,
  tc.completed_at AS created_at
FROM task_completions tc
JOIN tasks t ON tc.task_id = t.id
WHERE tc.completed_at < '2026-05-27 12:00:00+00'

UNION ALL

-- 4. HP Boosts
SELECT
  'boost-' || id AS id,
  lower(address) AS address,
  'Daily' AS action,
  'Boost' AS badge,
  '+' || CASE WHEN created_at < '2026-05-07 12:00:00+00' THEN ROUND(points * multiplier * 100, 2) ELSE ROUND(points * multiplier, 2) END || ' HP' AS value,
  'boost' AS type,
  multiplier AS boost_mult,
  created_at
FROM hp_boosts

UNION ALL

-- 5. Happy Box Openings (Standard, Happy, Bundles, and historical boxes)
SELECT
  'box-' || id AS id,
  lower(address) AS address,
  'Reward' AS action,
  CASE 
    WHEN box_type IN ('standard_bundle', 'happy_bundle') THEN 'Happy Boxes (6)'
    WHEN box_type IN ('standard', 'happy', 'standard_all', 'happy_all') THEN 'Happy Box'
    ELSE initcap(box_type) || ' Box'
  END AS badge,
  '+' || CASE WHEN created_at < '2026-05-07 12:00:00+00' THEN ROUND(hp_won * applied_multiplier * 100, 2) ELSE ROUND(hp_won * applied_multiplier, 2) END || ' HP' AS value,
  'box' AS type,
  applied_multiplier AS boost_mult,
  created_at
FROM opened_boxes
WHERE box_type NOT IN ('standard_all', 'happy_all')

UNION ALL

-- 6. Social Approved Post Submissions
SELECT
  'post-' || id AS id,
  lower(address) AS address,
  'Task' AS action,
  'Approved' AS badge,
  '+' || CASE WHEN reviewed_at < '2026-05-07 12:00:00+00' THEN COALESCE(ROUND(hp_awarded * 100, 2), 500.00) ELSE COALESCE(ROUND(hp_awarded, 2), 5.00) END || ' HP' AS value,
  'quest' AS type,
  COALESCE(applied_multiplier, 1.0) AS boost_mult,
  reviewed_at AS created_at
FROM post_submissions
WHERE status = 'approved'

UNION ALL

-- 7. Daily Activity Leaderboard rewards (TOP 30)
SELECT
  'act-' || id AS id,
  lower(address) AS address,
  'Activity' AS action,
  CASE WHEN rank <= 20 THEN 'TOP-20' ELSE 'TOP-30' END AS badge,
  '+' || CASE WHEN created_at < '2026-05-07 12:00:00+00' THEN ROUND(points * 100, 2) ELSE ROUND(points, 2) END || ' HP' AS value,
  'win' AS type,
  1.0 AS boost_mult,
  created_at
FROM activity_rewards;

GRANT SELECT ON user_activity TO anon, authenticated;
GRANT EXECUTE ON FUNCTION distribute_daily_rewards() TO service_role;
