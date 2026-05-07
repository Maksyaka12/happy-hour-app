-- database/022_economy_v2.sql

-- ==========================================
-- 1. THE SQUISH & DECIMALS (NUMERIC 10,2)
-- ==========================================
DROP VIEW IF EXISTS leaderboard CASCADE;
DROP VIEW IF EXISTS user_activity CASCADE;

ALTER TABLE users 
  ALTER COLUMN points TYPE NUMERIC(10,2) USING ROUND(points::numeric / 100.0, 2),
  ALTER COLUMN referral_points TYPE NUMERIC(10,2) USING ROUND(referral_points::numeric / 100.0, 2);

ALTER TABLE checkins 
  ALTER COLUMN points TYPE NUMERIC(10,2) USING ROUND(points::numeric / 100.0, 2);

ALTER TABLE hp_boosts 
  ALTER COLUMN points TYPE NUMERIC(10,2) USING ROUND(points::numeric / 100.0, 2);

ALTER TABLE opened_boxes 
  ALTER COLUMN hp_won TYPE NUMERIC(10,2) USING ROUND(hp_won::numeric / 100.0, 2);

ALTER TABLE post_submissions 
  ALTER COLUMN hp_awarded TYPE NUMERIC(10,2) USING ROUND(hp_awarded::numeric / 100.0, 2);

ALTER TABLE activity_rewards 
  ALTER COLUMN points TYPE NUMERIC(10,2) USING ROUND(points::numeric / 100.0, 2);

-- Set all existing tasks to the new balanced value (1.5 HP as an average of 1-2)
UPDATE tasks SET points = 1.5;
ALTER TABLE tasks ALTER COLUMN points TYPE NUMERIC(10,2);


-- ==========================================
-- 2. UPDATE ADD_POINTS (Decimal precision & Referral Fix)
-- ==========================================
DROP FUNCTION IF EXISTS add_points(TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION add_points(
  p_address TEXT,
  p_points NUMERIC,
  p_reason TEXT DEFAULT ''
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_referrer TEXT;
  v_user_multiplier NUMERIC := 1.0;
  v_user_expires TIMESTAMPTZ;
  v_actual_points NUMERIC := p_points;
BEGIN
  IF v_address IS NULL OR v_address = '' OR p_points IS NULL OR p_points = 0 THEN
    RETURN 1.0;
  END IF;

  SELECT active_multiplier, multiplier_expires_at INTO v_user_multiplier, v_user_expires
  FROM users WHERE address = v_address;

  IF v_user_expires > NOW() AND v_user_multiplier > 1.0 THEN
    v_actual_points := ROUND(p_points * v_user_multiplier, 2);
  ELSE
    v_user_multiplier := 1.0;
  END IF;

  INSERT INTO users (address, points)
  VALUES (v_address, v_actual_points)
  ON CONFLICT (address)
  DO UPDATE SET points = users.points + EXCLUDED.points;

  SELECT referrer INTO v_referrer FROM users WHERE address = v_address;

  -- 50% referral bonus using exact decimals!
  IF v_referrer IS NOT NULL AND v_referrer <> v_address THEN
    UPDATE users
    SET 
      points = points + ROUND(p_points / 2.0, 2),
      referral_points = referral_points + ROUND(p_points / 2.0, 2)
    WHERE address = v_referrer;
  END IF;

  RETURN v_user_multiplier;
END;
$$;


-- ==========================================
-- 3. REMOVE DIRECT MULTIPLIER PURCHASE
-- ==========================================
DROP FUNCTION IF EXISTS buy_multiplier(TEXT, TEXT, NUMERIC);


-- ==========================================
-- 4. UPDATE ACTIVITY SCORE FORMULA
-- ==========================================
CREATE OR REPLACE FUNCTION update_daily_score(p_address TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO daily_stats (address, day)
  VALUES (lower(p_address), CURRENT_DATE)
  ON CONFLICT (address, day) DO UPDATE
  SET 
    score = (daily_stats.checkin_done::int * 50) + 
            daily_stats.streak + 
            (daily_stats.tasks_done * 10) + 
            (daily_stats.tx_count * 10) + 
            (daily_stats.posts_approved * 50),
    updated_at = NOW();
END;
$$;


-- ==========================================
-- 5. UPDATE REWARD VALUES & PRICING
-- ==========================================

-- A. Daily Check-in
CREATE OR REPLACE FUNCTION process_checkin(p_address TEXT, p_tx_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_user users;
  v_today DATE := CURRENT_DATE;
  v_new_streak INTEGER;
  v_pts_earned NUMERIC := 1.0;
  v_bonus NUMERIC := 0.0;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Missing input'); END IF;
  PERFORM sync_user_profile(v_address, NULL, NULL);
  IF EXISTS (SELECT 1 FROM checkins WHERE address = v_address AND checked_date = v_today) THEN RETURN jsonb_build_object('ok', false, 'error', 'Already checked in today'); END IF;

  SELECT * INTO v_user FROM users WHERE address = v_address FOR UPDATE;
  IF v_user.streak_last = v_today - 1 THEN v_new_streak := v_user.streak + 1; ELSE v_new_streak := 1; END IF;

  SELECT COALESCE(MAX(pts), 0.0) INTO v_bonus FROM (VALUES (3, 1.0), (7, 3.0), (14, 7.0), (30, 15.0)) AS rewards(days, pts) WHERE days = v_new_streak;
  v_pts_earned := v_pts_earned + v_bonus;

  INSERT INTO checkins (address, checked_date, tx_hash, points) VALUES (v_address, v_today, v_tx_hash, v_pts_earned);
  UPDATE users SET streak = v_new_streak, streak_last = v_today WHERE address = v_address;
  PERFORM add_points(v_address, v_pts_earned, 'checkin');

  -- ACTIVITY TRACKING
  INSERT INTO daily_stats (address, day, checkin_done, tx_count, streak)
  VALUES (v_address, v_today, TRUE, 1, v_new_streak)
  ON CONFLICT (address, day) DO UPDATE
  SET checkin_done = TRUE, tx_count = daily_stats.tx_count + 1, streak = EXCLUDED.streak;
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'newStreak', v_new_streak, 'ptsEarned', v_pts_earned);
END;
$$;


-- B. HP Boost
CREATE OR REPLACE FUNCTION process_hp_boost(p_address TEXT, p_tx_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_today DATE := CURRENT_DATE;
  v_pts_earned NUMERIC := 2.0;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Missing input'); END IF;
  PERFORM sync_user_profile(v_address, NULL, NULL);
  IF EXISTS (SELECT 1 FROM hp_boosts WHERE address = v_address AND boost_date = v_today) THEN RETURN jsonb_build_object('ok', false, 'error', 'Already boosted'); END IF;

  INSERT INTO hp_boosts (address, boost_date, tx_hash, points) VALUES (v_address, v_today, v_tx_hash, v_pts_earned);
  PERFORM add_points(v_address, v_pts_earned, 'hp_boost');
  UPDATE users SET boost_last = v_today WHERE address = v_address;

  INSERT INTO daily_stats (address, day, tx_count) VALUES (v_address, CURRENT_DATE, 1) ON CONFLICT (address, day) DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);
  RETURN jsonb_build_object('ok', true, 'ptsEarned', v_pts_earned);
END;
$$;


-- C. Happy Boxes
CREATE OR REPLACE FUNCTION open_happy_box(p_address TEXT, p_box_type TEXT, p_tx_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_hp_won NUMERIC; v_mult_won NUMERIC := 1.0; v_price NUMERIC := 0.0;
  v_current_mult NUMERIC; v_actual_mult_applied NUMERIC := 1.0; v_applied_mult NUMERIC; v_rand_num NUMERIC;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid input'); END IF;
  PERFORM sync_user_profile(v_address, NULL, NULL);
  v_rand_num := random();
  
  IF p_box_type = 'common' THEN 
    v_price := 0.20; v_hp_won := floor(random() * (8 - 4 + 1)) + 4;
  ELSIF p_box_type = 'epic' THEN 
    v_price := 0.45; v_hp_won := floor(random() * (20 - 10 + 1)) + 10; IF v_rand_num < 0.05 THEN v_mult_won := 2.0; END IF;
  ELSIF p_box_type = 'legendary' THEN 
    v_price := 0.95; v_hp_won := floor(random() * (40 - 21 + 1)) + 21; IF v_rand_num < 0.025 THEN v_mult_won := 5.0; END IF;
  ELSE RETURN jsonb_build_object('ok', false, 'error', 'Invalid box type');
  END IF;

  SELECT active_multiplier INTO v_current_mult FROM users WHERE address = v_address;
  IF v_mult_won > 1.0 THEN
    IF v_mult_won = 2.0 AND COALESCE(v_current_mult, 1.0) < 2.0 THEN v_actual_mult_applied := 2.0; UPDATE users SET active_multiplier = 2.0, multiplier_expires_at = NOW() + INTERVAL '24 hours' WHERE address = v_address;
    ELSIF v_mult_won = 5.0 AND COALESCE(v_current_mult, 1.0) < 5.0 THEN v_actual_mult_applied := 5.0; UPDATE users SET active_multiplier = 5.0, multiplier_expires_at = NOW() + INTERVAL '24 hours' WHERE address = v_address;
    END IF;
  END IF;

  v_applied_mult := add_points(v_address, v_hp_won, 'box_open');
  INSERT INTO opened_boxes (address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash) VALUES (v_address, p_box_type, v_hp_won, v_applied_mult, v_actual_mult_applied, v_price, v_tx_hash);
  UPDATE users SET total_spent = total_spent + v_price WHERE address = v_address;

  INSERT INTO daily_stats (address, day, tx_count) VALUES (v_address, CURRENT_DATE, 1) ON CONFLICT (address, day) DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);
  RETURN jsonb_build_object('ok', true, 'hp_won', ROUND(v_hp_won * v_applied_mult, 2), 'applied_multiplier', v_applied_mult);
END;
$$;


-- D. Post Approval
CREATE OR REPLACE FUNCTION approve_post(p_admin_address TEXT, p_submission_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
  POST_HP NUMERIC := 5.0;
  v_sub post_submissions;
  v_mult NUMERIC;
BEGIN
  IF lower(trim(p_admin_address)) <> ADMIN_WALLET THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;
  SELECT * INTO v_sub FROM post_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Submission not found'); END IF;
  IF v_sub.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Already reviewed'); END IF;

  v_mult := add_points(v_sub.address, POST_HP, 'post_approval');
  UPDATE post_submissions SET status = 'approved', reviewed_at = NOW(), hp_awarded = ROUND(POST_HP * v_mult, 2), applied_multiplier = v_mult WHERE id = p_submission_id;

  INSERT INTO daily_stats (address, day, posts_approved) VALUES (v_sub.address, CURRENT_DATE, 1) ON CONFLICT (address, day) DO UPDATE SET posts_approved = daily_stats.posts_approved + 1;
  PERFORM update_daily_score(v_sub.address);
  RETURN jsonb_build_object('ok', true, 'hp_awarded', ROUND(POST_HP * v_mult, 2), 'multiplier', v_mult);
END;
$$;


-- E. Daily Leaderboard Rewards
CREATE OR REPLACE FUNCTION distribute_daily_rewards()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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
    LIMIT 20
  ) LOOP
    v_rank := v_rank + 1;
    
    CASE 
      WHEN v_rank = 1 THEN v_reward := 50.0;
      WHEN v_rank <= 5 THEN v_reward := 30.0;
      WHEN v_rank <= 10 THEN v_reward := 15.0;
      WHEN v_rank <= 15 THEN v_reward := 10.0;
      WHEN v_rank <= 20 THEN v_reward := 5.0;
      ELSE v_reward := 0.0;
    END CASE;

    IF v_reward > 0 THEN
      UPDATE users SET points = points + v_reward WHERE address = r.address;
      INSERT INTO activity_rewards (address, day, rank, points)
      VALUES (r.address, v_day, v_rank, v_reward);
    END IF;
  END LOOP;
END;
$$;


-- ==========================================
-- 6. FIX HISTORY VIEW (No CEIL, 5 HP for Raffle Win)
-- ==========================================
DROP VIEW IF EXISTS user_activity;
CREATE OR REPLACE VIEW user_activity AS

SELECT
  'bet-' || id AS id,
  lower(address) AS address,
  'Deposit' AS action,
  'Round ' || round_id AS badge,
  '+' || ROUND(tickets * multiplier, 2) || ' HP' AS value,
  'deposit' AS type,
  multiplier AS boost_mult,
  created_at
FROM bets

UNION ALL

SELECT
  'checkin-' || id AS id,
  lower(address) AS address,
  'Daily Claim' AS action,
  'Streak' AS badge,
  '+' || ROUND(points * multiplier, 2) || ' HP' AS value,
  'checkin' AS type,
  multiplier AS boost_mult,
  created_at
FROM checkins

UNION ALL

SELECT
  'win-' || id AS id,
  lower(winner) AS address,
  'Reward' AS action,
  'Win Round ' || id AS badge,
  '+' || ROUND(5.0 * COALESCE(winner_multiplier, 1.0), 2) || ' HP' AS value,
  'win' AS type,
  COALESCE(winner_multiplier, 1.0) AS boost_mult,
  ends_at AS created_at
FROM rounds
WHERE winner IS NOT NULL AND status = 'done'

UNION ALL

SELECT
  'tc-' || tc.id AS id,
  lower(tc.address) AS address,
  'Quest' AS action,
  t.type AS badge,
  '+' || ROUND(t.points * COALESCE(tc.multiplier, 1.0), 2) || ' HP' AS value,
  'quest' AS type,
  COALESCE(tc.multiplier, 1.0) AS boost_mult,
  tc.completed_at AS created_at
FROM task_completions tc
JOIN tasks t ON tc.task_id = t.id

UNION ALL

SELECT
  'boost-' || id AS id,
  lower(address) AS address,
  'Daily' AS action,
  'Boost' AS badge,
  '+' || ROUND(points * multiplier, 2) || ' HP' AS value,
  'boost' AS type,
  multiplier AS boost_mult,
  created_at
FROM hp_boosts

UNION ALL

SELECT
  'mult-' || id AS id,
  lower(address) AS address,
  'Multiplier' AS action,
  multiplier || 'x Boost' AS badge,
  '24 Hours' AS value,
  'boost' AS type,
  1.0 AS boost_mult,
  created_at
FROM purchased_multipliers

UNION ALL

SELECT
  'box-' || id AS id,
  lower(address) AS address,
  'Reward' AS action,
  initcap(box_type) || ' Box' AS badge,
  '+' || ROUND(hp_won * applied_multiplier, 2) || ' HP' AS value,
  'box' AS type,
  applied_multiplier AS boost_mult,
  created_at
FROM opened_boxes

UNION ALL

SELECT
  'post-' || id AS id,
  lower(address) AS address,
  'Task' AS action,
  'Approved' AS badge,
  '+' || COALESCE(ROUND(hp_awarded, 2), 5.00) || ' HP' AS value,
  'quest' AS type,
  COALESCE(applied_multiplier, 1.0) AS boost_mult,
  reviewed_at AS created_at
FROM post_submissions
WHERE status = 'approved'

UNION ALL

SELECT
  'act-' || id AS id,
  lower(address) AS address,
  'Activity' AS action,
  'TOP-20' AS badge,
  '+' || ROUND(points, 2) || ' HP' AS value,
  'win' AS type,
  1.0 AS boost_mult,
  created_at
FROM activity_rewards;

GRANT SELECT ON user_activity TO anon, authenticated;
