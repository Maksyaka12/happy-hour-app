-- database/007_consumable_boosts.sql

-- 1. Update users table to track active multipliers
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS multiplier_expires_at TIMESTAMPTZ;

-- 2. Create history table for purchased multipliers
CREATE TABLE IF NOT EXISTS purchased_multipliers (
  id           BIGSERIAL PRIMARY KEY,
  address      TEXT NOT NULL REFERENCES users(address),
  multiplier   NUMERIC NOT NULL,
  tx_hash      TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS purchased_mults_addr_idx ON purchased_multipliers(address, created_at DESC);
ALTER TABLE purchased_multipliers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'purchased_multipliers' AND policyname = 'public read purchased_multipliers'
  ) THEN
    CREATE POLICY "public read purchased_multipliers" ON purchased_multipliers FOR SELECT USING (true);
  END IF;
END $$;

-- 3. Function to buy/activate a multiplier
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
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' OR p_multiplier <= 1.0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
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

  -- Activate multiplier for 24 hours
  -- If they already have a multiplier, it overwrites it and restarts the 24h clock.
  UPDATE users
  SET 
    active_multiplier = p_multiplier,
    multiplier_expires_at = NOW() + INTERVAL '24 hours'
  WHERE address = v_address;

  RETURN jsonb_build_object(
    'ok', true,
    'multiplier', p_multiplier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION buy_multiplier(TEXT, TEXT, NUMERIC) TO anon, authenticated, service_role;

-- Add to realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'purchased_multipliers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE purchased_multipliers;
  END IF;
END $$;

-- 4. Recreate view to include multipliers
CREATE OR REPLACE VIEW user_activity AS
-- 1. Deposits (Bets)
SELECT 
  'bet-' || id AS id,
  lower(address) AS address,
  'Deposit' AS action,
  'Round ' || round_id AS badge,
  '+' || amount || ' USDC' AS value,
  'deposit' AS type,
  created_at
FROM bets

UNION ALL

-- 2. Daily Check-ins
SELECT 
  'checkin-' || id AS id,
  lower(address) AS address,
  'Daily Claim' AS action,
  'Streak' AS badge,
  '+' || points || ' PTS' AS value,
  'checkin' AS type,
  created_at
FROM checkins

UNION ALL

-- 3. Wins in Raffle
SELECT 
  'win-' || id AS id,
  lower(winner) AS address,
  'Reward' AS action,
  'Win Round ' || id AS badge,
  '+30 PTS' AS value,
  'win' AS type,
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
  '+' || t.points || ' PTS' AS value,
  'quest' AS type,
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
  '+' || points || ' PTS' AS value,
  'boost' AS type,
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
  created_at
FROM purchased_multipliers;

GRANT SELECT ON user_activity TO anon, authenticated;
