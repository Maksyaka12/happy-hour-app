-- database/009_total_spent.sql

-- 1. Add total_spent column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0.00;

-- 2. Update process_hp_boost to increment total_spent by 0.10
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
  SET 
    boost_last = v_today,
    total_spent = total_spent + 0.10
  WHERE address = v_address;

  RETURN jsonb_build_object(
    'ok', true,
    'ptsEarned', ceil(v_pts_earned * v_mult)
  );
END;
$$;

-- 3. Update buy_multiplier to increment total_spent based on multiplier price
CREATE OR REPLACE FUNCTION buy_multiplier(
  p_address TEXT,
  p_tx_hash TEXT,
  p_multiplier NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_price NUMERIC := 0.00;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' OR p_multiplier <= 1.0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
  END IF;

  -- Determine price based on multiplier
  IF p_multiplier = 2.0 THEN
    v_price := 0.50;
  ELSIF p_multiplier = 5.0 THEN
    v_price := 1.00;
  END IF;

  -- Ensure user exists
  PERFORM sync_user_profile(v_address, NULL, NULL);

  -- Record purchase
  BEGIN
    INSERT INTO purchased_multipliers (address, multiplier, tx_hash)
    VALUES (v_address, p_multiplier, v_tx_hash);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transaction already processed');
  END;

  -- Activate multiplier for 24 hours and increment total_spent
  UPDATE users
  SET 
    active_multiplier = p_multiplier,
    multiplier_expires_at = NOW() + INTERVAL '24 hours',
    total_spent = total_spent + v_price
  WHERE address = v_address;

  RETURN jsonb_build_object(
    'ok', true,
    'multiplier', p_multiplier,
    'spent_added', v_price
  );
END;
$$;
