-- database/032_activity_boost.sql
-- V3 Core Loop: Activity Boost Integration

-- 1. Create activity_levels configuration table
CREATE TABLE IF NOT EXISTS activity_levels (
  level INTEGER PRIMARY KEY,
  price_usdc NUMERIC NOT NULL,
  multiplier NUMERIC NOT NULL
);

INSERT INTO activity_levels (level, price_usdc, multiplier) VALUES
  (1, 0.00, 1.0),
  (2, 0.10, 1.2),
  (3, 0.25, 1.5),
  (4, 0.50, 1.7),
  (5, 1.00, 2.0)
ON CONFLICT (level) DO UPDATE SET 
  price_usdc = EXCLUDED.price_usdc, 
  multiplier = EXCLUDED.multiplier;

-- 2. Add activity_level column to users table referencing activity_levels
ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_level INTEGER DEFAULT 1 REFERENCES activity_levels(level);

-- 3. Create activity upgrades logging table (optional but good for accounting)
CREATE TABLE IF NOT EXISTS activity_upgrades (
  id BIGSERIAL PRIMARY KEY,
  address TEXT NOT NULL REFERENCES users(address),
  old_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  price_paid NUMERIC NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create buy_activity_level secure RPC function
CREATE OR REPLACE FUNCTION buy_activity_level(
  p_address TEXT, 
  p_tx_hash TEXT, 
  p_target_level INTEGER
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_tx_hash TEXT := lower(trim(p_tx_hash));
  v_current_level INTEGER;
  v_price NUMERIC;
BEGIN
  -- Input validation
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' OR p_target_level IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input parameters');
  END IF;

  -- Sync user profile if needed
  PERFORM sync_user_profile(v_address, NULL, NULL);

  -- Fetch current activity level
  SELECT COALESCE(activity_level, 1) INTO v_current_level FROM users WHERE address = v_address;
  
  -- Verify logic
  IF v_current_level >= p_target_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already at or above this Activity Boost level');
  END IF;
  
  IF p_target_level - v_current_level > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Must upgrade Activity Boost one level at a time');
  END IF;

  -- Get target level price
  SELECT price_usdc INTO v_price FROM activity_levels WHERE level = p_target_level;
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid Activity Boost level specified');
  END IF;

  -- Record upgrade, add price to total_spent
  UPDATE users 
  SET 
    activity_level = p_target_level, 
    total_spent = total_spent + v_price 
  WHERE address = v_address;
  
  INSERT INTO activity_upgrades (address, old_level, new_level, price_paid, tx_hash) 
  VALUES (v_address, v_current_level, p_target_level, v_price, v_tx_hash);
  
  -- Increment daily stats transactions count and recalculate daily score
  INSERT INTO daily_stats (address, day, tx_count) 
  VALUES (v_address, CURRENT_DATE, 1) 
  ON CONFLICT (address, day) 
  DO UPDATE SET tx_count = daily_stats.tx_count + 1;
  
  PERFORM update_daily_score(v_address);

  RETURN jsonb_build_object('ok', true, 'newActivityLevel', p_target_level);
END;
$$;

-- 5. Update update_daily_score to dynamically apply Activity Boost multiplier
CREATE OR REPLACE FUNCTION update_daily_score(p_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_act_mult NUMERIC := 1.0;
BEGIN
  -- Get user's activity boost multiplier
  SELECT COALESCE(al.multiplier, 1.0) INTO v_act_mult
  FROM users u
  LEFT JOIN activity_levels al ON u.activity_level = al.level
  WHERE u.address = v_address;

  INSERT INTO daily_stats (address, day)
  VALUES (v_address, CURRENT_DATE)
  ON CONFLICT (address, day) DO UPDATE
  SET 
    score = ROUND(
      ((daily_stats.checkin_done::int * 30) + 
       daily_stats.streak + 
       (daily_stats.tasks_done * 10) + 
       (daily_stats.tx_count * 10) + 
       (daily_stats.posts_approved * 30)) * v_act_mult
    )::integer - daily_stats.ap_burned,
    updated_at = NOW();
END;
$$;

-- Grant permissions to make the RPC public
GRANT SELECT ON activity_levels TO anon, authenticated;
GRANT EXECUTE ON FUNCTION buy_activity_level(TEXT, TEXT, INTEGER) TO anon, authenticated;
