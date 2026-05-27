-- database/031_box_cap_and_ap_burn.sql
-- V3 Core Loop: Strategic AP Burn & Box Capping

-- 1. Add tracking columns to daily_stats
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS boxes_opened INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS bonus_opens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS ap_burned INTEGER NOT NULL DEFAULT 0;


-- 2. Update update_daily_score to subtract ap_burned
CREATE OR REPLACE FUNCTION update_daily_score(p_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO daily_stats (address, day)
  VALUES (lower(p_address), CURRENT_DATE)
  ON CONFLICT (address, day) DO UPDATE
  SET 
    score = (daily_stats.checkin_done::int * 30) + 
            daily_stats.streak + 
            (daily_stats.tasks_done * 10) + 
            (daily_stats.tx_count * 10) + 
            (daily_stats.posts_approved * 30) - 
            daily_stats.ap_burned,
    updated_at = NOW();
END;
$$;


-- 3. Create burn_ap_for_boxes secure RPC function
CREATE OR REPLACE FUNCTION burn_ap_for_boxes(p_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_score INTEGER;
  v_bonus_opens INTEGER;
  v_ap_burned INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Input validation
  IF v_address IS NULL OR v_address = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid address');
  END IF;

  -- Verify daily stats exists
  PERFORM sync_user_profile(v_address, NULL, NULL);
  
  -- Ensure row exists for today
  INSERT INTO daily_stats (address, day)
  VALUES (v_address, v_today)
  ON CONFLICT (address, day) DO NOTHING;

  -- Get current AP score, bonus opens, and ap_burned
  SELECT score, bonus_opens, ap_burned INTO v_score, v_bonus_opens, v_ap_burned
  FROM daily_stats
  WHERE address = v_address AND day = v_today;

  -- Validate score >= 100
  IF v_score IS NULL OR v_score < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient Activity Points. You need at least 100 AP.');
  END IF;

  -- Update daily stats
  UPDATE daily_stats
  SET 
    ap_burned = ap_burned + 100,
    bonus_opens = bonus_opens + 6
  WHERE address = v_address AND day = v_today;

  -- Recalculate daily score atomically
  PERFORM update_daily_score(v_address);

  -- Fetch updated daily stats
  SELECT score, bonus_opens, ap_burned INTO v_score, v_bonus_opens, v_ap_burned
  FROM daily_stats
  WHERE address = v_address AND day = v_today;

  RETURN jsonb_build_object(
    'ok', true,
    'newLimit', 12 + (v_bonus_opens * 6),
    'apBurned', v_ap_burned,
    'currentScore', v_score
  );
END;
$$;


-- 4. Update open_standard_chest to respect daily cap
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
  
  -- Limit variables
  v_opened_today INTEGER := 0;
  v_bonus_today INTEGER := 0;
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

  -- Fetch user daily box open limits
  SELECT COALESCE(boxes_opened, 0), COALESCE(bonus_opens, 0)
  INTO v_opened_today, v_bonus_today
  FROM daily_stats
  WHERE address = v_address AND day = CURRENT_DATE;

  -- Verify daily cap
  IF v_opened_today >= (12 + (v_bonus_today * 6)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Daily box open limit reached. Burn 100 AP to get +6 box openings!');
  END IF;

  -- Generate random reward between 2.0 and 15.0, rounded to 1 decimal place
  v_hp_won := ROUND((random() * (15.0 - 2.0) + 2.0)::numeric, 1);

  -- Add points using the user's permanent HP Boost (multiplier)
  v_applied_mult := add_points(v_address, v_hp_won, 'box_open');

  -- Record box open entry with multiplier_won = 1.0 (no temp multipliers)
  INSERT INTO opened_boxes (
    address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash
  ) VALUES (
    v_address, 'happy', v_hp_won, v_applied_mult, 1.0, v_price, v_tx_hash
  );

  -- Increment user's total spent
  UPDATE users SET total_spent = total_spent + v_price WHERE address = v_address;

  -- Increment daily stats and boxes_opened
  INSERT INTO daily_stats (address, day, tx_count, boxes_opened) 
  VALUES (v_address, CURRENT_DATE, 1, 1) 
  ON CONFLICT (address, day) 
  DO UPDATE SET 
    tx_count = daily_stats.tx_count + 1,
    boxes_opened = daily_stats.boxes_opened + 1;
  
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object(
    'ok', true,
    'hp_won', ROUND(v_hp_won * v_applied_mult, 1),
    'base_hp', v_hp_won,
    'applied_multiplier', v_applied_mult
  );
END;
$$;


-- 5. Update open_all_chests to respect daily cap
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
  v_sum_base_hp NUMERIC := 0.0;
  v_idx INTEGER;
  
  -- Limit variables
  v_opened_today INTEGER := 0;
  v_bonus_today INTEGER := 0;
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

  -- Fetch user daily box open limits
  SELECT COALESCE(boxes_opened, 0), COALESCE(bonus_opens, 0)
  INTO v_opened_today, v_bonus_today
  FROM daily_stats
  WHERE address = v_address AND day = CURRENT_DATE;

  -- Verify daily cap (needs at least 6 spots)
  IF (12 + (v_bonus_today * 6)) - v_opened_today < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough daily limits remaining. Burn 100 AP to get +6 box openings!');
  END IF;

  -- Open 6 chests
  FOR v_idx IN 1..6 LOOP
    -- Generate random reward between 2.0 and 15.0, rounded to 1 decimal place
    v_hp_won := ROUND((random() * (15.0 - 2.0) + 2.0)::numeric, 1);
    
    -- Add points
    v_applied_mult := add_points(v_address, v_hp_won, 'box_open');
    v_total_hp_won := v_total_hp_won + (v_hp_won * v_applied_mult);
    v_sum_base_hp := v_sum_base_hp + v_hp_won;

    -- Record each box open with a unique transaction hash suffix
    INSERT INTO opened_boxes (
      address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash
    ) VALUES (
      v_address, 'happy_all', v_hp_won, v_applied_mult, 1.0, 0.25, v_tx_hash || '_' || v_idx
    );

    -- Append to rewards array
    v_rewards := v_rewards || jsonb_build_object(
      'index', v_idx,
      'hp_won', ROUND(v_hp_won * v_applied_mult, 1),
      'base_hp', v_hp_won,
      'applied_multiplier', v_applied_mult
    );
  END LOOP;

  -- Insert a master tracking entry for the transaction hash so it cannot be double spent
  INSERT INTO opened_boxes (
    address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash
  ) VALUES (
    v_address, 'happy_bundle', v_sum_base_hp, v_applied_mult, 1.0, v_price, v_tx_hash
  );

  -- Increment user's total spent
  UPDATE users SET total_spent = total_spent + v_price WHERE address = v_address;

  -- Increment daily stats and boxes_opened by 6
  INSERT INTO daily_stats (address, day, tx_count, boxes_opened) 
  VALUES (v_address, CURRENT_DATE, 1, 6) 
  ON CONFLICT (address, day) 
  DO UPDATE SET 
    tx_count = daily_stats.tx_count + 1,
    boxes_opened = daily_stats.boxes_opened + 6;
  
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object(
    'ok', true,
    'total_hp_won', ROUND(v_total_hp_won, 1),
    'rewards', v_rewards
  );
END;
$$;
