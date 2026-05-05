-- database/020_activity_leaderboard.sql

-- 1. Table to track daily activity points
CREATE TABLE IF NOT EXISTS daily_stats (
  address TEXT NOT NULL REFERENCES users(address),
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks_done INTEGER NOT NULL DEFAULT 0,
  tx_count INTEGER NOT NULL DEFAULT 0,
  posts_approved INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  checkin_done BOOLEAN NOT NULL DEFAULT FALSE,
  score INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (address, day)
);

-- 2. Function to update daily score based on weights
-- Weights: Checkin=50, Task=20, Tx=10, Post=100
CREATE OR REPLACE FUNCTION update_daily_score(p_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO daily_stats (address, day)
  VALUES (lower(p_address), CURRENT_DATE)
  ON CONFLICT (address, day) DO UPDATE
  SET 
    score = (daily_stats.checkin_done::int * 50) + 
            daily_stats.streak + 
            (daily_stats.tasks_done * 20) + 
            (daily_stats.tx_count * 10) + 
            (daily_stats.posts_approved * 100),
    updated_at = NOW();
END;
$$;

-- 3. Update existing functions to track activity

-- Update process_checkin
CREATE OR REPLACE FUNCTION process_checkin(p_address TEXT, p_tx_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_user users;
  v_today DATE := CURRENT_DATE;
  v_new_streak INTEGER;
  v_pts_earned INTEGER := 1;
  v_bonus INTEGER := 0;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing address or tx hash');
  END IF;

  PERFORM sync_user_profile(v_address, NULL, NULL);

  IF EXISTS (SELECT 1 FROM checkins WHERE address = v_address AND checked_date = v_today) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already checked in today');
  END IF;

  SELECT * INTO v_user FROM users WHERE address = v_address FOR UPDATE;
  IF v_user.streak_last = v_today - 1 THEN v_new_streak := v_user.streak + 1; ELSE v_new_streak := 1; END IF;

  SELECT COALESCE(MAX(pts), 0) INTO v_bonus FROM (VALUES (3, 10), (7, 30), (14, 100), (21, 300), (30, 500)) AS rewards(days, pts) WHERE days = v_new_streak;
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

-- Update claim_task_completion
CREATE OR REPLACE FUNCTION claim_task_completion(p_task_id TEXT, p_address TEXT, p_tx_hash TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
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

  PERFORM add_points(v_address, v_task.points, 'task:' || p_task_id);

  -- ACTIVITY TRACKING
  INSERT INTO daily_stats (address, day, tasks_done, tx_count)
  VALUES (v_address, CURRENT_DATE, 1, 1)
  ON CONFLICT (address, day) DO UPDATE
  SET tasks_done = daily_stats.tasks_done + 1, tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'pointsAwarded', v_task.points, 'txHash', p_tx_hash);
END;
$$;

-- Update record_deposit (for boxes and tickets)
CREATE OR REPLACE FUNCTION record_deposit(p_round_id BIGINT, p_address TEXT, p_amount NUMERIC, p_tickets INTEGER, p_tx_hash TEXT, p_block_number BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
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
  PERFORM add_points(v_address, p_tickets, 'deposit:' || p_tx_hash);
  PERFORM increment_entries(v_address);

  -- ACTIVITY TRACKING
  INSERT INTO daily_stats (address, day, tx_count)
  VALUES (v_address, CURRENT_DATE, 1)
  ON CONFLICT (address, day) DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'roundId', p_round_id, 'tickets', p_tickets);
END;
$$;

-- Update approve_post
CREATE OR REPLACE FUNCTION approve_post(p_admin_address TEXT, p_submission_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
  POST_HP INTEGER := 10;
  v_sub post_submissions;
  v_mult NUMERIC;
BEGIN
  IF lower(trim(p_admin_address)) <> ADMIN_WALLET THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;
  SELECT * INTO v_sub FROM post_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Submission not found'); END IF;
  IF v_sub.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Already reviewed'); END IF;

  v_mult := add_points(v_sub.address, POST_HP, 'post_approval');
  UPDATE post_submissions SET status = 'approved', reviewed_at = NOW(), hp_awarded = ceil(POST_HP * v_mult), applied_multiplier = v_mult WHERE id = p_submission_id;

  -- ACTIVITY TRACKING
  INSERT INTO daily_stats (address, day, posts_approved)
  VALUES (v_sub.address, CURRENT_DATE, 1)
  ON CONFLICT (address, day) DO UPDATE SET posts_approved = daily_stats.posts_approved + 1;
  PERFORM update_daily_score(v_sub.address);

  RETURN jsonb_build_object('ok', true, 'hp_awarded', ceil(POST_HP * v_mult), 'multiplier', v_mult);
END;
$$;

-- 4. Reward Distribution Function (TOP 20)
-- Rewards: 1st=1000, 2-3rd=500, 4-10th=200, 11-20th=100 HP
CREATE OR REPLACE FUNCTION distribute_daily_rewards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_rank INTEGER := 0;
  v_reward INTEGER;
  v_day DATE := CURRENT_DATE;
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
      WHEN v_rank = 1 THEN v_reward := 1000;
      WHEN v_rank <= 3 THEN v_reward := 500;
      WHEN v_rank <= 10 THEN v_reward := 200;
      ELSE v_reward := 100;
    END CASE;

    PERFORM add_points(r.address, v_reward, 'daily_activity_rank_' || v_rank);
  END LOOP;
END;
$$;

-- 5. Grant access
GRANT SELECT ON daily_stats TO anon, authenticated;
