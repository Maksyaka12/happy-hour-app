-- database/012_history_fixes.sql
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
