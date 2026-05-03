-- database/017_simulated_users.sql
-- Feature: Simulated users (bots) for leaderboard competition

-- 1. Add is_bot flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;

-- 2. Function to generate random wallet addresses
CREATE OR REPLACE FUNCTION generate_random_address()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := '0123456789abcdef';
  res TEXT := '0x';
  i INTEGER;
BEGIN
  FOR i IN 1..40 LOOP
    res := res || substr(chars, floor(random() * 16 + 1)::int, 1);
  END LOOP;
  RETURN res;
END;
$$;

-- 3. Function to mass create bots
-- Example: SELECT create_bots(20, 500, 5000);
CREATE OR REPLACE FUNCTION create_bots(
  p_count      INTEGER,
  p_min_points INTEGER,
  p_max_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
  v_addr TEXT;
  v_points INTEGER;
BEGIN
  FOR i IN 1..p_count LOOP
    v_addr := generate_random_address();
    v_points := floor(random() * (p_max_points - p_min_points + 1) + p_min_points);
    
    INSERT INTO users (address, points, wins, entries, is_bot)
    VALUES (
      v_addr, 
      v_points, 
      floor(random() * 5)::int,    -- 0-4 random wins
      floor(random() * 50)::int,   -- 0-49 random entries
      true
    );
  END LOOP;
  
  RETURN jsonb_build_object('ok', true, 'created', p_count);
END;
$$;

-- 4. Function to update bot points manually
CREATE OR REPLACE FUNCTION update_bot_points(
  p_admin_address TEXT,
  p_bot_address   TEXT,
  p_new_points    INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
BEGIN
  IF lower(p_admin_address) <> ADMIN_WALLET THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  UPDATE users 
  SET points = p_new_points 
  WHERE address = p_bot_address AND is_bot = true;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. Function to delete all bots (reset)
CREATE OR REPLACE FUNCTION delete_all_bots(p_admin_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
BEGIN
  IF lower(p_admin_address) <> ADMIN_WALLET THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  DELETE FROM users WHERE is_bot = true;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_bots(INTEGER, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_bot_points(TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_all_bots(TEXT) TO anon, authenticated;
