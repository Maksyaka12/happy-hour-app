-- database/014_hp_rebalance.sql
-- HP Rebalance: Daily Boost 100->11, Boxes updated

-- 1. Update process_hp_boost: 100 HP -> 11 HP
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
  v_pts_earned INTEGER := 11;
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

GRANT EXECUTE ON FUNCTION process_hp_boost(TEXT, TEXT) TO anon, authenticated, service_role;


-- 2. Update open_happy_box: new HP ranges
--    Common:     20-45 HP
--    Epic:       46-130 HP  (10% chance 2x boost)
--    Legendary:  131-300 HP (5% chance 5x boost)
CREATE OR REPLACE FUNCTION open_happy_box(
  p_address TEXT,
  p_box_type TEXT,
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
  v_hp_won INTEGER;
  v_mult_won NUMERIC := 1.0;
  v_price NUMERIC := 0.0;
  v_current_mult NUMERIC;
  v_actual_mult_applied NUMERIC := 1.0;
  v_applied_mult NUMERIC;
  v_rand_num NUMERIC;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
  END IF;

  -- Ensure user exists
  PERFORM sync_user_profile(v_address, NULL, NULL);

  -- Determine Box Rewards and Price
  v_rand_num := random();

  IF p_box_type = 'common' THEN
    v_price := 0.20;
    -- 20 to 45 HP
    v_hp_won := floor(random() * 26) + 20;

  ELSIF p_box_type = 'epic' THEN
    v_price := 0.45;
    -- 46 to 130 HP
    v_hp_won := floor(random() * 85) + 46;
    -- 10% chance for 2x
    IF v_rand_num < 0.10 THEN
      v_mult_won := 2.0;
    END IF;

  ELSIF p_box_type = 'legendary' THEN
    v_price := 0.95;
    -- 131 to 300 HP
    v_hp_won := floor(random() * 170) + 131;
    -- 5% chance for 5x
    IF v_rand_num < 0.05 THEN
      v_mult_won := 5.0;
    END IF;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown box type');
  END IF;

  -- Smart Multiplier Logic
  SELECT active_multiplier INTO v_current_mult
  FROM users WHERE address = v_address;
  v_current_mult := COALESCE(v_current_mult, 1.0);

  IF v_mult_won > v_current_mult THEN
    -- Won a better multiplier: upgrade and track as newly won
    UPDATE users
    SET
      active_multiplier = v_mult_won,
      multiplier_expires_at = NOW() + INTERVAL '24 hours'
    WHERE address = v_address;
    v_actual_mult_applied := v_mult_won;
  ELSE
    -- No new multiplier (or won one that's not better)
    v_actual_mult_applied := 1.0;
  END IF;

  -- The add_points function automatically applies the active multiplier to the points being added.
  v_applied_mult := add_points(v_address, v_hp_won, 'box_open');

  -- Log the transaction
  BEGIN
    INSERT INTO opened_boxes (address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash)
    VALUES (v_address, p_box_type, v_hp_won, v_applied_mult, v_actual_mult_applied, v_price, v_tx_hash);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transaction already processed');
  END;

  -- Update total_spent
  UPDATE users SET total_spent = total_spent + v_price WHERE address = v_address;

  RETURN jsonb_build_object(
    'ok', true,
    'hp_won', ceil(v_hp_won * v_applied_mult),
    'applied_multiplier', v_applied_mult,
    'multiplier_won', v_actual_mult_applied
  );
END;
$$;

GRANT EXECUTE ON FUNCTION open_happy_box(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
