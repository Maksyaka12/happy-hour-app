-- database/023_account_levels.sql

-- ==========================================
-- 1. ACCOUNT LEVELS CONFIGURATION
-- ==========================================
CREATE TABLE IF NOT EXISTS account_levels (
  level INTEGER PRIMARY KEY,
  price_usdc NUMERIC NOT NULL,
  multiplier NUMERIC NOT NULL
);

INSERT INTO account_levels (level, price_usdc, multiplier) VALUES
  (1, 0.00, 1.0),
  (2, 0.95, 1.2),
  (3, 1.75, 1.5),
  (4, 3.00, 1.7),
  (5, 5.00, 2.0)
ON CONFLICT (level) DO UPDATE SET 
  price_usdc = EXCLUDED.price_usdc, 
  multiplier = EXCLUDED.multiplier;

-- Add level column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_level INTEGER DEFAULT 1 REFERENCES account_levels(level);

-- Track level upgrades
CREATE TABLE IF NOT EXISTS level_upgrades (
  id BIGSERIAL PRIMARY KEY,
  address TEXT NOT NULL REFERENCES users(address),
  old_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  price_paid NUMERIC NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. ANTI-INFLATION: "GREATEST" MULTIPLIER LOGIC
-- ==========================================
CREATE OR REPLACE FUNCTION add_points(
  p_address TEXT,
  p_points NUMERIC,
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
  v_temp_multiplier NUMERIC := 1.0;
  v_temp_expires TIMESTAMPTZ;
  v_level_multiplier NUMERIC := 1.0;
  v_final_multiplier NUMERIC := 1.0;
  v_actual_points NUMERIC := p_points;
BEGIN
  IF v_address IS NULL OR v_address = '' OR p_points IS NULL OR p_points = 0 THEN
    RETURN 1.0;
  END IF;

  -- Get temporary multiplier
  SELECT active_multiplier, multiplier_expires_at INTO v_temp_multiplier, v_temp_expires
  FROM users WHERE address = v_address;
  IF v_temp_expires <= NOW() OR v_temp_multiplier IS NULL THEN
    v_temp_multiplier := 1.0;
  END IF;

  -- Get permanent level multiplier
  SELECT al.multiplier INTO v_level_multiplier
  FROM users u
  JOIN account_levels al ON u.account_level = al.level
  WHERE u.address = v_address;
  
  IF v_level_multiplier IS NULL THEN v_level_multiplier := 1.0; END IF;

  -- ANTI-INFLATION: Take the HIGHEST multiplier!
  v_final_multiplier := GREATEST(v_temp_multiplier, v_level_multiplier);

  v_actual_points := ROUND(p_points * v_final_multiplier, 2);

  INSERT INTO users (address, points)
  VALUES (v_address, v_actual_points)
  ON CONFLICT (address)
  DO UPDATE SET points = users.points + EXCLUDED.points;

  SELECT referrer INTO v_referrer FROM users WHERE address = v_address;

  IF v_referrer IS NOT NULL AND v_referrer <> v_address THEN
    UPDATE users
    SET 
      points = points + ROUND(p_points / 2.0, 2),
      referral_points = referral_points + ROUND(p_points / 2.0, 2)
    WHERE address = v_referrer;
  END IF;

  RETURN v_final_multiplier;
END;
$$;


-- ==========================================
-- 3. UPGRADE LEVEL RPC
-- ==========================================
CREATE OR REPLACE FUNCTION buy_account_level(p_address TEXT, p_tx_hash TEXT, p_target_level INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_current_level INTEGER;
  v_price NUMERIC;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' OR p_target_level IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
  END IF;

  PERFORM sync_user_profile(v_address, NULL, NULL);

  SELECT account_level INTO v_current_level FROM users WHERE address = v_address;
  IF v_current_level >= p_target_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already at or above this level');
  END IF;
  IF p_target_level - v_current_level > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Must upgrade one level at a time');
  END IF;

  SELECT price_usdc INTO v_price FROM account_levels WHERE level = p_target_level;
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid level');
  END IF;

  -- Record upgrade
  UPDATE users SET account_level = p_target_level, total_spent = total_spent + v_price WHERE address = v_address;
  INSERT INTO level_upgrades (address, old_level, new_level, price_paid, tx_hash) VALUES (v_address, v_current_level, p_target_level, v_price, v_tx_hash);
  
  -- === ACTIVITY TRACKING ===
  INSERT INTO daily_stats (address, day, tx_count) VALUES (v_address, CURRENT_DATE, 1) ON CONFLICT (address, day) DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'newLevel', p_target_level);
END;
$$;


-- ==========================================
-- 4. FIX BOX LOGIC TO RESPECT ACCOUNT LEVELS
-- ==========================================
CREATE OR REPLACE FUNCTION open_happy_box(p_address TEXT, p_box_type TEXT, p_tx_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_hp_won NUMERIC; v_mult_won NUMERIC := 1.0; v_price NUMERIC := 0.0;
  v_current_temp_mult NUMERIC; v_current_level_mult NUMERIC; v_max_current_mult NUMERIC;
  v_actual_mult_applied NUMERIC := 1.0; v_applied_mult NUMERIC; v_rand_num NUMERIC;
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid input'); END IF;
  PERFORM sync_user_profile(v_address, NULL, NULL);
  v_rand_num := random();
  
  IF p_box_type = 'common' THEN 
    v_price := 0.20; v_hp_won := floor(random() * (8 - 4 + 1)) + 4;
  ELSIF p_box_type = 'epic' THEN 
    v_price := 0.45; v_hp_won := floor(random() * (20 - 10 + 1)) + 10; IF v_rand_num < 0.05 THEN v_mult_won := 2.0; END IF;
  ELSIF p_box_type = 'legendary' THEN 
    v_price := 0.95; v_hp_won := floor(random() * (40 - 21 + 1)) + 21; IF v_rand_num < 0.025 THEN v_mult_won := 5.0; END IF;
  ELSE RETURN jsonb_build_object('ok', false, 'error', 'Invalid box type');
  END IF;

  -- Get both multipliers to see if the won multiplier actually improves the player's status
  SELECT active_multiplier INTO v_current_temp_mult FROM users WHERE address = v_address AND multiplier_expires_at > NOW();
  SELECT al.multiplier INTO v_current_level_mult FROM users u JOIN account_levels al ON u.account_level = al.level WHERE u.address = v_address;
  v_max_current_mult := GREATEST(COALESCE(v_current_temp_mult, 1.0), COALESCE(v_current_level_mult, 1.0));

  -- Only apply the temporary multiplier if it's better than their current highest multiplier!
  IF v_mult_won > 1.0 THEN
    IF v_mult_won > v_max_current_mult THEN 
      v_actual_mult_applied := v_mult_won; 
      UPDATE users SET active_multiplier = v_mult_won, multiplier_expires_at = NOW() + INTERVAL '24 hours' WHERE address = v_address;
    END IF;
  END IF;

  v_applied_mult := add_points(v_address, v_hp_won, 'box_open');
  INSERT INTO opened_boxes (address, box_type, hp_won, applied_multiplier, multiplier_won, price_paid, tx_hash) VALUES (v_address, p_box_type, v_hp_won, v_applied_mult, v_actual_mult_applied, v_price, v_tx_hash);
  UPDATE users SET total_spent = total_spent + v_price WHERE address = v_address;

  INSERT INTO daily_stats (address, day, tx_count) VALUES (v_address, CURRENT_DATE, 1) ON CONFLICT (address, day) DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  PERFORM update_daily_score(v_address);
  RETURN jsonb_build_object('ok', true, 'hp_won', ROUND(v_hp_won * v_applied_mult, 2), 'applied_multiplier', v_applied_mult);
END;
$$;


-- ==========================================
-- 5. GUARDIAN TRIGGER UPDATE (Fallback Multiplier)
-- ==========================================
CREATE OR REPLACE FUNCTION trg_fix_multiplier()
RETURNS TRIGGER AS $$
DECLARE
  v_temp NUMERIC := 1.0;
  v_level NUMERIC := 1.0;
BEGIN
  -- Get temp
  SELECT active_multiplier INTO v_temp FROM users WHERE address = lower(NEW.address) AND multiplier_expires_at > NOW();
  -- Get level
  SELECT al.multiplier INTO v_level FROM users u JOIN account_levels al ON u.account_level = al.level WHERE u.address = lower(NEW.address);
  
  -- Set Guardian to the MAX of both!
  NEW.multiplier := GREATEST(COALESCE(v_temp, 1.0), COALESCE(v_level, 1.0));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger is already attached, this just overwrote the function to be smarter.

GRANT SELECT ON account_levels TO anon, authenticated;
GRANT SELECT ON level_upgrades TO anon, authenticated;
