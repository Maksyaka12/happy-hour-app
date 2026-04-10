-- database/002_functions.sql
-- Run after 001_schema.sql.

CREATE OR REPLACE FUNCTION sync_user_profile(
  p_address TEXT,
  p_basename TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL
)
RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_basename TEXT := NULLIF(trim(p_basename), '');
  v_referrer TEXT := lower(NULLIF(trim(p_referrer), ''));
  v_user users;
BEGIN
  IF v_address IS NULL OR v_address = '' THEN
    RAISE EXCEPTION 'address is required';
  END IF;

  IF v_referrer = v_address THEN
    v_referrer := NULL;
  END IF;

  IF v_referrer IS NOT NULL THEN
    INSERT INTO users (address)
    VALUES (v_referrer)
    ON CONFLICT (address) DO NOTHING;
  END IF;

  INSERT INTO users (address, basename, referrer)
  VALUES (v_address, v_basename, v_referrer)
  ON CONFLICT (address)
  DO UPDATE SET
    basename = COALESCE(EXCLUDED.basename, users.basename),
    referrer = COALESCE(users.referrer, EXCLUDED.referrer);

  SELECT * INTO v_user FROM users WHERE address = v_address;
  RETURN v_user;
END;
$$;

CREATE OR REPLACE FUNCTION add_points(
  p_address TEXT,
  p_points INTEGER,
  p_reason TEXT DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
BEGIN
  IF v_address IS NULL OR v_address = '' OR p_points IS NULL OR p_points = 0 THEN
    RETURN;
  END IF;

  INSERT INTO users (address, points)
  VALUES (v_address, p_points)
  ON CONFLICT (address)
  DO UPDATE SET points = users.points + EXCLUDED.points;
END;
$$;

CREATE OR REPLACE FUNCTION increment_entries(p_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
BEGIN
  INSERT INTO users (address, entries)
  VALUES (v_address, 1)
  ON CONFLICT (address)
  DO UPDATE SET entries = users.entries + 1;
END;
$$;

CREATE OR REPLACE FUNCTION increment_wins(p_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
BEGIN
  INSERT INTO users (address, wins)
  VALUES (v_address, 1)
  ON CONFLICT (address)
  DO UPDATE SET wins = users.wins + 1;
END;
$$;

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

  INSERT INTO checkins (address, checked_date, tx_hash)
  VALUES (v_address, v_today, v_tx_hash);

  IF v_user.streak_last = v_today - 1 THEN
    v_new_streak := v_user.streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  SELECT COALESCE(MAX(pts), 0)
  INTO v_bonus
  FROM (
    VALUES (3, 1), (7, 5), (14, 10), (30, 50)
  ) AS rewards(days, pts)
  WHERE days = v_new_streak;

  v_pts_earned := v_pts_earned + v_bonus;

  UPDATE users
  SET
    streak = v_new_streak,
    streak_last = v_today,
    points = points + v_pts_earned
  WHERE address = v_address;

  IF v_user.referrer IS NOT NULL THEN
    UPDATE users
    SET points = points + GREATEST(1, v_pts_earned / 2)
    WHERE address = v_user.referrer;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'newStreak', v_new_streak,
    'ptsEarned', v_pts_earned
  );
END;
$$;

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

  INSERT INTO task_completions (task_id, address)
  VALUES (p_task_id, v_address)
  ON CONFLICT (task_id, address) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Task already claimed');
  END IF;

  PERFORM add_points(v_address, v_task.points, 'task:' || p_task_id);

  RETURN jsonb_build_object(
    'ok', true,
    'pointsAwarded', v_task.points
  );
END;
$$;

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
  ON CONFLICT (tx_hash) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'duplicate', true);
  END IF;

  UPDATE rounds
  SET total_pot = total_pot + p_amount
  WHERE id = p_round_id;

  PERFORM add_points(v_address, p_tickets, 'deposit:' || p_tx_hash);
  PERFORM increment_entries(v_address);

  RETURN jsonb_build_object(
    'ok', true,
    'roundId', p_round_id,
    'tickets', p_tickets
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sync_user_profile(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_points(TEXT, INTEGER, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_entries(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_wins(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_checkin(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_task_completion(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_deposit(BIGINT, TEXT, NUMERIC, INTEGER, TEXT, BIGINT) TO anon, authenticated, service_role;
