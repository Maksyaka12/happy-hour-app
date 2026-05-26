-- database/028_standard_chests.sql

-- 1. Function to open a single standard chest (cost: 0.30 USDC)
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

  -- Generate random reward between 2.0 and 10.0, rounded to 1 decimal place
  v_hp_won := ROUND((random() * (10.0 - 2.0) + 2.0)::numeric, 1);

  -- Add points using the user's permanent HP Boost (multiplier)
  v_applied_mult := add_points(v_address, v_hp_won, 'box_open');

  -- Record box open entry
  INSERT INTO opened_boxes (
    address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash
  ) VALUES (
    v_address, 'standard', v_hp_won, v_applied_mult, 1.0, v_price, v_tx_hash
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


-- 2. Function to open all 6 chests at once (cost: 1.50 USDC)
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
    -- Generate random reward between 2.0 and 10.0, rounded to 1 decimal place
    v_hp_won := ROUND((random() * (10.0 - 2.0) + 2.0)::numeric, 1);
    
    -- Add points
    v_applied_mult := add_points(v_address, v_hp_won, 'box_open');
    v_total_hp_won := v_total_hp_won + (v_hp_won * v_applied_mult);

    -- Record each box open with a unique transaction hash suffix
    INSERT INTO opened_boxes (
      address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash
    ) VALUES (
      v_address, 'standard_all', v_hp_won, v_applied_mult, 1.0, 0.25, v_tx_hash || '_' || v_idx
    );

    -- Append to rewards array
    v_rewards := jsonb_insert(
      v_rewards,
      array_to_json(ARRAY[jsonb_array_length(v_rewards)])::text[],
      jsonb_build_object(
        'index', v_idx,
        'hp_won', ROUND(v_hp_won * v_applied_mult, 1),
        'base_hp', v_hp_won,
        'applied_multiplier', v_applied_mult
      )
    );
  END LOOP;

  -- Insert a master tracking entry for the transaction hash so it cannot be double spent
  INSERT INTO opened_boxes (
    address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash
  ) VALUES (
    v_address, 'standard_bundle', 0, 1.0, 1.0, v_price, v_tx_hash
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
