-- database/006_hp_boost.sql

CREATE TABLE IF NOT EXISTS hp_boosts (
  id           BIGSERIAL PRIMARY KEY,
  address      TEXT NOT NULL REFERENCES users(address),
  boost_date   DATE NOT NULL,
  tx_hash      TEXT UNIQUE NOT NULL,
  points       INTEGER NOT NULL DEFAULT 100,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, boost_date)
);

CREATE INDEX IF NOT EXISTS hp_boosts_address_date_idx ON hp_boosts(address, boost_date DESC);
ALTER TABLE hp_boosts ENABLE ROW LEVEL SECURITY;

-- Track last boost date directly in users table for performance
ALTER TABLE users ADD COLUMN IF NOT EXISTS boost_last DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hp_boosts' AND policyname = 'public read hp_boosts'
  ) THEN
    CREATE POLICY "public read hp_boosts" ON hp_boosts FOR SELECT USING (true);
  END IF;
END $$;

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
BEGIN
  IF v_address IS NULL OR v_address = '' OR v_tx_hash IS NULL OR v_tx_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing address or tx hash');
  END IF;

  -- Ensure user exists
  PERFORM sync_user_profile(v_address, NULL, NULL);

  -- Check if already boosted today
  IF EXISTS (
    SELECT 1 FROM hp_boosts
    WHERE address = v_address
      AND boost_date = v_today
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already boosted today');
  END IF;

  -- Record the boost
  INSERT INTO hp_boosts (address, boost_date, tx_hash, points)
  VALUES (v_address, v_today, v_tx_hash, v_pts_earned);

  -- Add points to user
  PERFORM add_points(v_address, v_pts_earned, 'hp_boost');

  -- Update last boost date in users table
  UPDATE users
  SET boost_last = v_today
  WHERE address = v_address;

  RETURN jsonb_build_object(
    'ok', true,
    'ptsEarned', v_pts_earned
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_hp_boost(TEXT, TEXT) TO anon, authenticated, service_role;

-- Add to realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'hp_boosts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hp_boosts;
  END IF;
END $$;

-- Update history view to include HP Boosts
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
  'HP Boost' AS action,
  'Daily' AS badge,
  '+' || points || ' PTS' AS value,
  'boost' AS type,
  created_at
FROM hp_boosts;

GRANT SELECT ON user_activity TO anon, authenticated;
