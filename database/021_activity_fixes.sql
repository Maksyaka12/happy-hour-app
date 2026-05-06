-- database/021_activity_fixes.sql

-- ==========================================
-- 1. FIX HISTORY VIEW (boost_mult and formatting)
-- ==========================================
DROP VIEW IF EXISTS user_activity;
CREATE OR REPLACE VIEW user_activity AS

-- 1. Deposits (Bets)
SELECT
  'bet-' || id AS id,
  lower(address) AS address,
  'Deposit' AS action,
  'Round ' || round_id AS badge,
  '+' || ceil(tickets * multiplier) || ' HP' AS value,
  'deposit' AS type,
  multiplier AS boost_mult,
  created_at
FROM bets

UNION ALL

-- 2. Daily Check-ins
SELECT
  'checkin-' || id AS id,
  lower(address) AS address,
  'Daily Claim' AS action,
  'Streak' AS badge,
  '+' || ceil(points * multiplier) || ' HP' AS value,
  'checkin' AS type,
  multiplier AS boost_mult,
  created_at
FROM checkins

UNION ALL

-- 3. Wins in Raffle
SELECT
  'win-' || id AS id,
  lower(winner) AS address,
  'Reward' AS action,
  'Win Round ' || id AS badge,
  '+' || ceil(30 * COALESCE(winner_multiplier, 1.0)) || ' HP' AS value,
  'win' AS type,
  COALESCE(winner_multiplier, 1.0) AS boost_mult,
  ends_at AS created_at
FROM rounds
WHERE winner IS NOT NULL AND status = 'done'

UNION ALL

-- 4. Completed Tasks
SELECT
  'tc-' || tc.id AS id,
  lower(tc.address) AS address,
  'Quest' AS action,
  t.type AS badge,
  '+' || ceil(t.points * COALESCE(tc.multiplier, 1.0)) || ' HP' AS value,
  'quest' AS type,
  COALESCE(tc.multiplier, 1.0) AS boost_mult,
  tc.completed_at AS created_at
FROM task_completions tc
JOIN tasks t ON tc.task_id = t.id

UNION ALL

-- 5. HP Boosts
SELECT
  'boost-' || id AS id,
  lower(address) AS address,
  'Daily' AS action,
  'Boost' AS badge,
  '+' || ceil(points * multiplier) || ' HP' AS value,
  'boost' AS type,
  multiplier AS boost_mult,
  created_at
FROM hp_boosts

UNION ALL

-- 6. Purchased Multipliers
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

-- 7. Opened Boxes
SELECT
  'box-' || id AS id,
  lower(address) AS address,
  'Reward' AS action,
  initcap(box_type) || ' Box' AS badge,
  '+' || ceil(hp_won * applied_multiplier) || ' HP' AS value,
  'box' AS type,
  applied_multiplier AS boost_mult,
  created_at
FROM opened_boxes

UNION ALL

-- 8. Approved Post Submissions
SELECT
  'post-' || id AS id,
  lower(address) AS address,
  'Task' AS action,
  'Approved' AS badge,
  '+' || COALESCE(hp_awarded, 10) || ' HP' AS value,
  'quest' AS type,
  COALESCE(applied_multiplier, 1.0) AS boost_mult,
  reviewed_at AS created_at
FROM post_submissions
WHERE status = 'approved'

UNION ALL

-- 9. Activity Rewards (TOP 20)
SELECT
  'act-' || id AS id,
  lower(address) AS address,
  'Activity' AS action,
  'TOP-20' AS badge,
  '+' || points || ' HP' AS value,
  'win' AS type,
  1.0 AS boost_mult,
  created_at
FROM activity_rewards;

-- ==========================================
-- 2. AUTOMATIC MULTIPLIER TRACKING (GUARDIAN TRIGGERS)
-- ==========================================
CREATE OR REPLACE FUNCTION trg_fix_multiplier()
RETURNS TRIGGER AS $$
BEGIN
  -- Йдемо в таблицю users і беремо актуальний множник на момент запису
  SELECT active_multiplier INTO NEW.multiplier
  FROM users 
  WHERE address = lower(NEW.address) 
    AND multiplier_expires_at > NOW();

  -- Якщо множника немає або час вийшов, ставимо 1.0
  IF NEW.multiplier IS NULL THEN
    NEW.multiplier := 1.0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Вішаємо "охоронця" на таблиці
DROP TRIGGER IF EXISTS trg_checkins_mult ON checkins;
CREATE TRIGGER trg_checkins_mult BEFORE INSERT ON checkins FOR EACH ROW EXECUTE FUNCTION trg_fix_multiplier();

DROP TRIGGER IF EXISTS trg_bets_mult ON bets;
CREATE TRIGGER trg_bets_mult BEFORE INSERT ON bets FOR EACH ROW EXECUTE FUNCTION trg_fix_multiplier();

DROP TRIGGER IF EXISTS trg_tasks_mult ON task_completions;
CREATE TRIGGER trg_tasks_mult BEFORE INSERT ON task_completions FOR EACH ROW EXECUTE FUNCTION trg_fix_multiplier();

-- ==========================================
-- 3. ACTIVITY SCORE FORMULA (FIXED tx_count * 10)
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
            (daily_stats.tasks_done * 20) + 
            (daily_stats.tx_count * 10) + -- FIXED WEIGHT
            (daily_stats.posts_approved * 100),
    updated_at = NOW();
END;
$$;

-- ==========================================
-- 4. RPC UPDATES WITH ACTIVITY TRACKING
-- ==========================================

-- A. HP Boost
CREATE OR REPLACE FUNCTION process_hp_boost(p_address TEXT, p_tx_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_today DATE := CURRENT_DATE;
  v_pts_earned INTEGER := 100;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing address or tx hash');
  END IF;
  PERFORM sync_user_profile(v_address, NULL, NULL);
  IF EXISTS (SELECT 1 FROM hp_boosts WHERE address = v_address AND boost_date = v_today) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already boosted today');
  END IF;

  INSERT INTO hp_boosts (address, boost_date, tx_hash, points) VALUES (v_address, v_today, v_tx_hash, v_pts_earned);
  PERFORM add_points(v_address, v_pts_earned, 'hp_boost');
  UPDATE users SET boost_last = v_today WHERE address = v_address;

  -- === ACTIVITY TRACKING ===
  INSERT INTO daily_stats (address, day, tx_count) VALUES (v_address, CURRENT_DATE, 1)
  ON CONFLICT (address, day) DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'ptsEarned', v_pts_earned);
END;
$$;

-- B. Buy Multiplier
CREATE OR REPLACE FUNCTION buy_multiplier(p_address TEXT, p_tx_hash TEXT, p_multiplier NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' OR p_multiplier <= 1.0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
  END IF;
  PERFORM sync_user_profile(v_address, NULL, NULL);
  INSERT INTO purchased_multipliers (address, multiplier, tx_hash) VALUES (v_address, p_multiplier, v_tx_hash);
  UPDATE users SET active_multiplier = p_multiplier, multiplier_expires_at = NOW() + INTERVAL '24 hours' WHERE address = v_address;

  -- === ACTIVITY TRACKING ===
  INSERT INTO daily_stats (address, day, tx_count) VALUES (v_address, CURRENT_DATE, 1)
  ON CONFLICT (address, day) DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'multiplier', p_multiplier);
END;
$$;

-- C. Open Happy Box
CREATE OR REPLACE FUNCTION open_happy_box(p_address TEXT, p_box_type TEXT, p_tx_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_hp_won INTEGER; v_mult_won NUMERIC := 1.0; v_price NUMERIC := 0.0;
  v_current_mult NUMERIC; v_actual_mult_applied NUMERIC := 1.0; v_applied_mult NUMERIC; v_rand_num NUMERIC;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid input'); END IF;
  PERFORM sync_user_profile(v_address, NULL, NULL);
  v_rand_num := random();
  
  IF p_box_type = 'common' THEN v_price := 0.20; v_hp_won := floor(random() * (300 - 101 + 1)) + 101;
  ELSIF p_box_type = 'epic' THEN v_price := 0.45; v_hp_won := floor(random() * (1000 - 301 + 1)) + 301; IF v_rand_num < 0.10 THEN v_mult_won := 2.0; END IF;
  ELSIF p_box_type = 'legendary' THEN v_price := 0.95; v_hp_won := floor(random() * (2300 - 1001 + 1)) + 1001; IF v_rand_num < 0.05 THEN v_mult_won := 5.0; END IF;
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

  -- === ACTIVITY TRACKING ===
  INSERT INTO daily_stats (address, day, tx_count) VALUES (v_address, CURRENT_DATE, 1)
  ON CONFLICT (address, day) DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'hp_won', ceil(v_hp_won * v_applied_mult), 'applied_multiplier', v_applied_mult);
END;
$$;

-- ==========================================
-- 5. DAILY REWARDS DISTRIBUTION FIX (targeting yesterday)
-- ==========================================
CREATE OR REPLACE FUNCTION distribute_daily_rewards()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
  v_rank INTEGER := 0;
  v_reward INTEGER;
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
      WHEN v_rank = 1 THEN v_reward := 1500;
      WHEN v_rank <= 5 THEN v_reward := 1000;
      WHEN v_rank <= 10 THEN v_reward := 500;
      ELSE v_reward := 200;
    END CASE;

    UPDATE users SET points = points + v_reward WHERE address = r.address;
    INSERT INTO activity_rewards (address, day, rank, points)
    VALUES (r.address, v_day, v_rank, v_reward);
  END LOOP;
END;
$$;

-- Permissions
GRANT SELECT ON user_activity TO anon, authenticated;
GRANT EXECUTE ON FUNCTION distribute_daily_rewards() TO service_role;
