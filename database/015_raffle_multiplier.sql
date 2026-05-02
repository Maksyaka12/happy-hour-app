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

-- ============================================================
-- STEP 2: Update history view to display multiplied raffle rewards
-- ============================================================
-- This replaces the view from 012_history_fixes.sql.
-- The only change vs 012 is in section "3. Wins in Raffle":
--   BEFORE: '+30 HP' and 1.0 AS boost_mult (hardcoded)
--   AFTER:  '+' || ceil(30 * winner_multiplier) || ' HP' and winner_multiplier AS boost_mult

DROP VIEW IF EXISTS user_activity;

CREATE OR REPLACE VIEW user_activity AS

-- 1. Deposits (Bets)
SELECT
  'bet-' || id AS id,
  lower(address) AS address,
  'Deposit' AS action,
  'Round ' || round_id AS badge,
  '+' || ceil(tickets * multiplier) || ' HP' AS value,
  'deposit' AS type,
  multiplier AS boost_mult,
  created_at
FROM bets

UNION ALL

-- 2. Daily Check-ins
SELECT
  'checkin-' || id AS id,
  lower(address) AS address,
  'Daily Claim' AS action,
  'Streak' AS badge,
  '+' || ceil(points * multiplier) || ' HP' AS value,
  'checkin' AS type,
  multiplier AS boost_mult,
  created_at
FROM checkins

UNION ALL

-- 3. Wins in Raffle (with multiplier support)
SELECT
  'win-' || id AS id,
  lower(winner) AS address,
  'Reward' AS action,
  'Win Round ' || id AS badge,
  '+' || ceil(30 * COALESCE(winner_multiplier, 1.0)) || ' HP' AS value,
  'win' AS type,
  COALESCE(winner_multiplier, 1.0) AS boost_mult,
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
  '+' || ceil(t.points * COALESCE(tc.multiplier, 1.0)) || ' HP' AS value,
  'quest' AS type,
  COALESCE(tc.multiplier, 1.0) AS boost_mult,
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
  '+' || ceil(points * multiplier) || ' HP' AS value,
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
  '+' || ceil(hp_won * applied_multiplier) || ' HP' AS value,
  'box' AS type,
  applied_multiplier AS boost_mult,
  created_at
FROM opened_boxes;

GRANT SELECT ON user_activity TO anon, authenticated;
