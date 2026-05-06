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

-- (The buy_multiplier function and user_activity view have been removed from here as they were rewritten in 021_activity_fixes.sql)
