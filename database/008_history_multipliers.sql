-- database/008_history_multipliers.sql

-- 1. Add multiplier columns to tracking tables
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE hp_boosts ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS winner_multiplier NUMERIC DEFAULT 1.0;

-- 2. Modify add_points to return the applied multiplier
DROP FUNCTION IF EXISTS add_points(TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION add_points(
  p_address TEXT,
  p_points INTEGER,
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
  v_user_multiplier NUMERIC := 1.0;
  v_user_expires TIMESTAMPTZ;
  v_actual_points INTEGER := p_points;
BEGIN
  IF v_address IS NULL OR v_address = '' OR p_points IS NULL OR p_points = 0 THEN
    RETURN 1.0;
  END IF;

  SELECT active_multiplier, multiplier_expires_at INTO v_user_multiplier, v_user_expires
  FROM users WHERE address = v_address;

  IF v_user_expires > NOW() AND v_user_multiplier > 1.0 THEN
    v_actual_points := ceil(p_points * v_user_multiplier)::integer;
  ELSE
    v_user_multiplier := 1.0;
  END IF;

  INSERT INTO users (address, points)
  VALUES (v_address, v_actual_points)
  ON CONFLICT (address)
  DO UPDATE SET points = users.points + EXCLUDED.points;

  SELECT referrer INTO v_referrer FROM users WHERE address = v_address;

  IF v_referrer IS NOT NULL AND v_referrer <> v_address THEN
    UPDATE users
    SET 
      points = points + ceil(p_points::float / 2)::integer,
      referral_points = referral_points + ceil(p_points::float / 2)::integer
    WHERE address = v_referrer;
  END IF;

  RETURN v_user_multiplier;
END;
$$;

-- (The functions process_checkin, process_hp_boost, claim_task_completion, record_deposit, and user_activity view have been removed as they were rewritten in 020_activity_leaderboard.sql and 021_activity_fixes.sql)
