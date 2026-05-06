-- database/015_raffle_multiplier.sql
-- Adds multiplier support for raffle wins.
-- Safe to run: only adds a trigger and updates the history view.
-- Does NOT modify any existing functions or Edge Functions.

-- ============================================================
-- STEP 1: Trigger to capture winner's active multiplier
-- ============================================================
-- The 'winner_multiplier' column already exists in rounds (added in 008).
-- This trigger fires BEFORE UPDATE when the winner field is first set (NULL -> value).
-- It reads the winner's current active multiplier and stores it permanently.
-- add_points() already applies the multiplier to the HP balance correctly.
-- This trigger just records WHAT multiplier was used, for history display.

CREATE OR REPLACE FUNCTION fn_capture_winner_multiplier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mult NUMERIC := 1.0;
BEGIN
  -- Only fire when winner is first assigned (NULL -> address)
  IF NEW.winner IS NOT NULL AND OLD.winner IS NULL THEN
    SELECT COALESCE(active_multiplier, 1.0) INTO v_mult
    FROM users
    WHERE address = lower(NEW.winner)
      AND multiplier_expires_at > NOW();

    NEW.winner_multiplier := COALESCE(v_mult, 1.0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_capture_winner_mult ON rounds;
CREATE TRIGGER tr_capture_winner_mult
  BEFORE UPDATE ON rounds
  FOR EACH ROW
  EXECUTE FUNCTION fn_capture_winner_multiplier();

GRANT EXECUTE ON FUNCTION fn_capture_winner_multiplier() TO service_role;

-- (The user_activity view has been removed from here as it was rewritten in 021_activity_fixes.sql)
