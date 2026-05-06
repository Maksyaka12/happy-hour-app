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

-- (The process_hp_boost function and user_activity view have been removed from here as they were rewritten in 021_activity_fixes.sql)
