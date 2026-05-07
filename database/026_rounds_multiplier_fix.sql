-- database/026_rounds_multiplier_fix.sql

-- 1. Create a specialized trigger function for the rounds table
-- (because the column name is winner instead of address)
CREATE OR REPLACE FUNCTION trg_fix_rounds_multiplier()
RETURNS TRIGGER AS $$
DECLARE
  v_temp NUMERIC := 1.0;
  v_level NUMERIC := 1.0;
BEGIN
  IF NEW.winner IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get temp multiplier from users table
  SELECT active_multiplier INTO v_temp 
  FROM users 
  WHERE address = lower(NEW.winner) AND multiplier_expires_at > NOW();
  
  -- Get permanent level multiplier from users table
  SELECT al.multiplier INTO v_level 
  FROM users u 
  JOIN account_levels al ON u.account_level = al.level 
  WHERE u.address = lower(NEW.winner);
  
  -- Set winner_multiplier to the GREATEST of both
  NEW.winner_multiplier := GREATEST(COALESCE(v_temp, 1.0), COALESCE(v_level, 1.0));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the trigger to the rounds table
-- It should fire BEFORE UPDATE when status changes to 'spinning' or 'done'
DROP TRIGGER IF EXISTS trg_rounds_mult_guardian ON rounds;
CREATE TRIGGER trg_rounds_mult_guardian 
BEFORE UPDATE ON rounds 
FOR EACH ROW 
WHEN (NEW.status IN ('spinning', 'done'))
EXECUTE FUNCTION trg_fix_rounds_multiplier();

-- 3. Retroactively fix any rounds finished today that show multiplier = 1.0
UPDATE rounds r
SET winner_multiplier = GREATEST(
  COALESCE((SELECT active_multiplier FROM users WHERE address = r.winner AND multiplier_expires_at > NOW()), 1.0),
  COALESCE((SELECT al.multiplier FROM users u JOIN account_levels al ON u.account_level = al.level WHERE u.address = r.winner), 1.0)
)
WHERE (winner_multiplier IS NULL OR winner_multiplier = 1.0) 
  AND status = 'done' 
  AND ends_at >= CURRENT_DATE;
