-- database/008_history_multipliers.sql

-- 1. Add multiplier columns to tracking tables
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE hp_boosts ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS winner_multiplier NUMERIC DEFAULT 1.0;

-- 2. Modify add_points to return the applied multiplier
CREATE OR REPLACE FUNCTION add_points(
  p_address TEXT,
  p_points INTEGER,
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
  v_actual_points INTEGER := p_points;
BEGIN
  IF v_address IS NULL OR v_address = '' OR p_points IS NULL OR p_points = 0 THEN
    RETURN 1.0;
  END IF;

  SELECT active_multiplier, multiplier_expires_at INTO v_user_multiplier, v_user_expires
  FROM users WHERE address = v_address;

  IF v_user_expires > NOW() AND v_user_multiplier > 1.0 THEN
    v_actual_points := ceil(p_points * v_user_multiplier)::integer;
  ELSE
    v_user_multiplier := 1.0;
  END IF;

  INSERT INTO users (address, points)
  VALUES (v_address, v_actual_points)
  ON CONFLICT (address)
  DO UPDATE SET points = users.points + EXCLUDED.points;

  SELECT referrer INTO v_referrer FROM users WHERE address = v_address;

  IF v_referrer IS NOT NULL AND v_referrer <> v_address THEN
    UPDATE users
    SET 
      points = points + ceil(p_points::float / 2)::integer,
      referral_points = referral_points + ceil(p_points::float / 2)::integer
    WHERE address = v_referrer;
  END IF;

  RETURN v_user_multiplier;
END;
$$;

-- 3. Update process_checkin
CREATE OR REPLACE FUNCTION process_checkin(
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
  v_user users;
  v_today DATE := CURRENT_DATE;
  v_new_streak INTEGER;
  v_pts_earned INTEGER := 1;
  v_bonus INTEGER := 0;
  v_mult NUMERIC;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing address or tx hash');
  END IF;

  PERFORM sync_user_profile(v_address, NULL, NULL);

  IF EXISTS (
    SELECT 1 FROM checkins
    WHERE address = v_address
      AND checked_date = v_today
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already checked in today');
  END IF;

  SELECT * INTO v_user
  FROM users
  WHERE address = v_address
  FOR UPDATE;

  IF v_user.streak_last = v_today - 1 THEN
    v_new_streak := v_user.streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  SELECT COALESCE(MAX(pts), 0)
  INTO v_bonus
  FROM (
    VALUES (3, 10), (7, 30), (14, 100), (21, 300), (30, 500)
  ) AS rewards(days, pts)
  WHERE days = v_new_streak;

  v_pts_earned := v_pts_earned + v_bonus;

  -- Add points first to get the multiplier
  v_mult := add_points(v_address, v_pts_earned, 'checkin');

  INSERT INTO checkins (address, checked_date, tx_hash, points, multiplier)
  VALUES (v_address, v_today, v_tx_hash, v_pts_earned, v_mult);

  UPDATE users
  SET
    streak = v_new_streak,
    streak_last = v_today
  WHERE address = v_address;

  RETURN jsonb_build_object(
    'ok', true,
    'newStreak', v_new_streak,
    'ptsEarned', ceil(v_pts_earned * v_mult)
  );
END;
$$;

-- 4. Update process_hp_boost
CREATE OR REPLACE FUNCTION process_hp_boost(
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
  v_today DATE := CURRENT_DATE;
  v_pts_earned INTEGER := 100;
  v_mult NUMERIC;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing address or tx hash');
  END IF;

  PERFORM sync_user_profile(v_address, NULL, NULL);

  IF EXISTS (
    SELECT 1 FROM hp_boosts
    WHERE address = v_address
      AND boost_date = v_today
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already boosted today');
  END IF;

  v_mult := add_points(v_address, v_pts_earned, 'hp_boost');

  INSERT INTO hp_boosts (address, boost_date, tx_hash, points, multiplier)
  VALUES (v_address, v_today, v_tx_hash, v_pts_earned, v_mult);

  UPDATE users
  SET boost_last = v_today
  WHERE address = v_address;

  RETURN jsonb_build_object(
    'ok', true,
    'ptsEarned', ceil(v_pts_earned * v_mult)
  );
END;
$$;

-- 5. Update claim_task_completion
CREATE OR REPLACE FUNCTION claim_task_completion(
  p_task_id TEXT,
  p_address TEXT
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
  v_mult NUMERIC;
BEGIN
  IF v_address IS NULL OR v_address = '' OR p_task_id IS NULL OR trim(p_task_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing task or address');
  END IF;

  PERFORM sync_user_profile(v_address, NULL, NULL);

  SELECT * INTO v_task
  FROM tasks
  WHERE id = p_task_id
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Task not found or expired');
  END IF;

  v_mult := add_points(v_address, v_task.points, 'task:' || p_task_id);

  INSERT INTO task_completions (task_id, address, multiplier)
  VALUES (p_task_id, v_address, v_mult)
  ON CONFLICT (task_id, address) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Task already claimed');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pointsAwarded', ceil(v_task.points * v_mult)
  );
END;
$$;

-- 6. Update record_deposit
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
  v_mult NUMERIC;
BEGIN
  IF p_round_id IS NULL OR v_address IS NULL OR v_address = '' OR p_amount IS NULL OR p_amount <= 0 OR p_tickets IS NULL OR p_tickets <= 0 OR p_tx_hash IS NULL OR trim(p_tx_hash) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid deposit payload');
  END IF;

  PERFORM sync_user_profile(v_address, NULL, NULL);

  v_mult := add_points(v_address, p_tickets, 'deposit:' || p_tx_hash);

  INSERT INTO bets (round_id, address, amount, tickets, tx_hash, block_number, multiplier)
  VALUES (p_round_id, v_address, p_amount, p_tickets, lower(trim(p_tx_hash)), p_block_number, v_mult)
  ON CONFLICT (tx_hash) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'duplicate', true);
  END IF;

  UPDATE rounds
  SET total_pot = total_pot + p_amount
  WHERE id = p_round_id;

  PERFORM increment_entries(v_address);

  RETURN jsonb_build_object(
    'ok', true,
    'roundId', p_round_id,
    'tickets', ceil(p_tickets * v_mult)
  );
END;
$$;

-- 7. Update user_activity view to return multiplied points and boost_mult
CREATE OR REPLACE VIEW user_activity AS
-- 1. Deposits (Bets)
SELECT 
  'bet-' || id AS id,
  lower(address) AS address,
  'Deposit' AS action,
  'Round ' || round_id AS badge,
  '+' || ceil(tickets * multiplier) || ' HP' AS value,
  'deposit' AS type,
  created_at,
  multiplier AS boost_mult
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
  created_at,
  multiplier AS boost_mult
FROM checkins

UNION ALL

-- 3. Wins in Raffle
SELECT 
  'win-' || id AS id,
  lower(winner) AS address,
  'Reward' AS action,
  'Win Round ' || id AS badge,
  '+' || ceil(30 * winner_multiplier) || ' HP' AS value,
  'win' AS type,
  ends_at AS created_at,
  winner_multiplier AS boost_mult
FROM rounds
WHERE winner IS NOT NULL AND status = 'done'

UNION ALL

-- 4. Completed Tasks
SELECT 
  'tc-' || tc.id AS id,
  lower(tc.address) AS address,
  'Quest' AS action,
  t.type AS badge,
  '+' || ceil(t.points * tc.multiplier) || ' HP' AS value,
  'quest' AS type,
  tc.completed_at AS created_at,
  tc.multiplier AS boost_mult
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
  created_at,
  multiplier AS boost_mult
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
  created_at,
  1.0 AS boost_mult
FROM purchased_multipliers;

GRANT SELECT ON user_activity TO anon, authenticated;
