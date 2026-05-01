-- database/013_happy_boxes_rpc_fix.sql

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
    v_hp_won := floor(random() * (300 - 101 + 1)) + 101;
  ELSIF p_box_type = 'epic' THEN
    v_price := 0.45;
    v_hp_won := floor(random() * (1000 - 301 + 1)) + 301;
    -- 10% chance for 2x
    IF v_rand_num < 0.10 THEN
      v_mult_won := 2.0;
    END IF;
  ELSIF p_box_type = 'legendary' THEN
    v_price := 0.95;
    v_hp_won := floor(random() * (2300 - 1001 + 1)) + 1001;
    -- 5% chance for 5x
    IF v_rand_num < 0.05 THEN
      v_mult_won := 5.0;
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid box type');
  END IF;

  -- Get current active multiplier
  SELECT active_multiplier INTO v_current_mult FROM users WHERE address = v_address;
  IF v_current_mult IS NULL THEN
    v_current_mult := 1.0;
  END IF;

  -- Smart multiplier application
  IF v_mult_won > 1.0 THEN
    IF v_mult_won = 2.0 THEN
      IF v_current_mult >= 2.0 THEN
        -- User already has 2x or 5x, discard won 2x
        v_actual_mult_applied := 1.0;
      ELSE
        -- Apply the won 2x
        v_actual_mult_applied := 2.0;
        UPDATE users SET active_multiplier = 2.0, multiplier_expires_at = NOW() + INTERVAL '24 hours' WHERE address = v_address;
      END IF;
    ELSIF v_mult_won = 5.0 THEN
      IF v_current_mult >= 5.0 THEN
        -- User already has 5x, discard won 5x
        v_actual_mult_applied := 1.0;
      ELSE
        -- Apply the won 5x
        v_actual_mult_applied := 5.0;
        UPDATE users SET active_multiplier = 5.0, multiplier_expires_at = NOW() + INTERVAL '24 hours' WHERE address = v_address;
      END IF;
    END IF;
  END IF;

  -- Add points (HP)
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
