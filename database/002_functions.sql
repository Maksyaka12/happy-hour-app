-- database/002_functions.sql
-- Run after 001_schema.sql.

CREATE OR REPLACE FUNCTION sync_user_profile(
  p_address TEXT,
  p_basename TEXT DEFAULT NULL,
  p_ref_code TEXT DEFAULT NULL
)
RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_basename TEXT := NULLIF(trim(p_basename), '');
  v_ref_code TEXT := lower(trim(p_ref_code));
  v_referrer TEXT;
  v_user users;
  v_is_new BOOLEAN;
BEGIN
  IF v_address IS NULL OR v_address = '' THEN
    RAISE EXCEPTION 'address is required';
  END IF;

  -- Resolve short code to address
  IF v_ref_code IS NOT NULL THEN
    SELECT address INTO v_referrer FROM users WHERE ref_code = v_ref_code;
  END IF;

  IF v_referrer = v_address THEN
    v_referrer := NULL;
  END IF;

  -- Ensure referrer exists as a user record if provided
  IF v_referrer IS NOT NULL THEN
    INSERT INTO users (address)
    VALUES (v_referrer)
    ON CONFLICT (address) DO NOTHING;
  END IF;

  -- Detect if this is a new signup to increment referral count
  SELECT NOT EXISTS (SELECT 1 FROM users WHERE address = v_address) INTO v_is_new;

  IF v_is_new AND v_referrer IS NOT NULL THEN
    UPDATE users SET referral_count = referral_count + 1 WHERE address = v_referrer;
  END IF;

  INSERT INTO users (address, basename, referrer, ref_code)
  VALUES (v_address, v_basename, v_referrer, substring(md5(v_address || now()::text), 1, 8))
  ON CONFLICT (address)
  DO UPDATE SET
    basename = COALESCE(EXCLUDED.basename, users.basename),
    referrer = COALESCE(users.referrer, EXCLUDED.referrer),
    ref_code = COALESCE(users.ref_code, EXCLUDED.ref_code);

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
  v_referrer TEXT;
BEGIN
  IF v_address IS NULL OR v_address = '' OR p_points IS NULL OR p_points = 0 THEN
    RETURN;
  END IF;

  INSERT INTO users (address, points)
  VALUES (v_address, p_points)
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

  IF v_user.streak_last = v_today - 1 THEN
    v_new_streak := v_user.streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  SELECT COALESCE(MAX(pts), 0)
  INTO v_bonus
  FROM (
    VALUES (3, 5), (7, 10), (14, 20), (30, 50)
  ) AS rewards(days, pts)
  WHERE days = v_new_streak;

  v_pts_earned := v_pts_earned + v_bonus;

  INSERT INTO checkins (address, checked_date, tx_hash, points)
  VALUES (v_address, v_today, v_tx_hash, v_pts_earned);

  UPDATE users
  SET
    streak = v_new_streak,
    streak_last = v_today
  WHERE address = v_address;

  PERFORM add_points(v_address, v_pts_earned, 'checkin');

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

CREATE OR REPLACE FUNCTION admin_create_task(
  p_admin_address TEXT,
  p_type TEXT,
  p_text TEXT,
  p_url TEXT,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
BEGIN
  IF lower(trim(p_admin_address)) <> ADMIN_WALLET THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  INSERT INTO tasks (type, text, url, points, expires_at)
  VALUES (p_type, p_text, p_url, p_points, NOW() + INTERVAL '24 hours');

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_task(TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated, service_role;
