-- database/011_happy_boxes.sql

-- 1. Create opened_boxes table
CREATE TABLE IF NOT EXISTS opened_boxes (
  id                 BIGSERIAL PRIMARY KEY,
  address            TEXT NOT NULL REFERENCES users(address),
  box_type           TEXT NOT NULL,
  hp_won             INTEGER NOT NULL,
  applied_multiplier NUMERIC DEFAULT 1.0,
  multiplier_won     NUMERIC DEFAULT 1.0,
  price_paid         NUMERIC NOT NULL,
  tx_hash            TEXT UNIQUE NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS opened_boxes_addr_idx ON opened_boxes(address, created_at DESC);
ALTER TABLE opened_boxes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'opened_boxes' AND policyname = 'public read opened_boxes'
  ) THEN
    CREATE POLICY "public read opened_boxes" ON opened_boxes FOR SELECT USING (true);
  END IF;
END $$;

-- 2. Create the RPC function
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
    'multiplier_won', v_actual_mult_applied
  );
END;
$$;

GRANT EXECUTE ON FUNCTION open_happy_box(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 3. Add to user_activity View
DROP VIEW IF EXISTS user_activity;

CREATE OR REPLACE VIEW user_activity AS
-- 1. Deposits (Bets)
SELECT 
  'bet-' || id AS id,
  lower(address) AS address,
  'Deposit' AS action,
  'Round ' || round_id AS badge,
  '+' || amount || ' USDC' AS value,
  'deposit' AS type,
  1.0 AS boost_mult,
  created_at
FROM bets

UNION ALL

-- 2. Daily Check-ins
SELECT 
  'checkin-' || id AS id,
  lower(address) AS address,
  'Daily Claim' AS action,
  'Streak' AS badge,
  '+' || points || ' HP' AS value,
  'checkin' AS type,
  multiplier AS boost_mult,
  created_at
FROM checkins

UNION ALL

-- 3. Wins in Raffle
SELECT 
  'win-' || id AS id,
  lower(winner) AS address,
  'Reward' AS action,
  'Win Round ' || id AS badge,
  '+30 HP' AS value,
  'win' AS type,
  1.0 AS boost_mult,
  ends_at AS created_at
FROM rounds
WHERE winner IS NOT NULL AND status = 'done'

UNION ALL

-- 4. Completed Tasks
SELECT 
  'tc-' || tc.id AS id,
  lower(tc.address) AS address,
  'Quest' AS action,
  t.type AS badge,
  '+' || t.points || ' HP' AS value,
  'quest' AS type,
  tc.multiplier AS boost_mult,
  tc.completed_at AS created_at
FROM task_completions tc
JOIN tasks t ON tc.task_id = t.id

UNION ALL

-- 5. HP Boosts
SELECT 
  'boost-' || id AS id,
  lower(address) AS address,
  'Daily' AS action,
  'Boost' AS badge,
  '+' || points || ' HP' AS value,
  'boost' AS type,
  multiplier AS boost_mult,
  created_at
FROM hp_boosts

UNION ALL

-- 6. Purchased Multipliers
SELECT 
  'mult-' || id AS id,
  lower(address) AS address,
  'Multiplier' AS action,
  multiplier || 'x Boost' AS badge,
  '24 Hours' AS value,
  'boost' AS type,
  1.0 AS boost_mult,
  created_at
FROM purchased_multipliers

UNION ALL

-- 7. Opened Boxes
SELECT 
  'box-' || id AS id,
  lower(address) AS address,
  'Reward' AS action,
  initcap(box_type) || ' Box' AS badge,
  '+' || hp_won || ' HP' AS value,
  'box' AS type,
  applied_multiplier AS boost_mult,
  created_at
FROM opened_boxes;

GRANT SELECT ON user_activity TO anon, authenticated;
