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

-- (The open_happy_box function and user_activity view have been removed as they were rewritten in 021_activity_fixes.sql)
