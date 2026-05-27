-- database/029_happy_box_history.sql

-- 1. Update historical standard_bundle and happy_bundle rows to sum up the children rewards and copy the applied multiplier
UPDATE opened_boxes master
SET 
  hp_won = COALESCE((
    SELECT SUM(child.hp_won)
    FROM opened_boxes child
    WHERE child.tx_hash IN (
      master.tx_hash || '_1',
      master.tx_hash || '_2',
      master.tx_hash || '_3',
      master.tx_hash || '_4',
      master.tx_hash || '_5',
      master.tx_hash || '_6'
    )
  ), 0),
  applied_multiplier = COALESCE((
    SELECT MAX(child.applied_multiplier)
    FROM opened_boxes child
    WHERE child.tx_hash IN (
      master.tx_hash || '_1',
      master.tx_hash || '_2',
      master.tx_hash || '_3',
      master.tx_hash || '_4',
      master.tx_hash || '_5',
      master.tx_hash || '_6'
    )
  ), 1.0)
WHERE master.box_type IN ('standard_bundle', 'happy_bundle');


-- 2. Re-create user_activity view to cleanly map standard/happy boxes to 'Happy Box' and standard/happy bundles to 'Happy Boxes (6)' in History, and exclude individual bundle box opens
DROP VIEW IF EXISTS user_activity;
CREATE OR REPLACE VIEW user_activity AS

SELECT
  'bet-' || id AS id,
  lower(address) AS address,
  'Deposit' AS action,
  'Round ' || round_id AS badge,
  '+' || ROUND(tickets * multiplier, 2) || ' HP' AS value,
  'deposit' AS type,
  multiplier AS boost_mult,
  created_at
FROM bets

UNION ALL

SELECT
  'checkin-' || id AS id,
  lower(address) AS address,
  'Daily Claim' AS action,
  'Streak' AS badge,
  '+' || CASE WHEN created_at < '2026-05-07 12:00:00+00' THEN ROUND(points * multiplier * 100, 2) ELSE ROUND(points * multiplier, 2) END || ' HP' AS value,
  'checkin' AS type,
  multiplier AS boost_mult,
  created_at
FROM checkins

UNION ALL

SELECT
  'win-' || id AS id,
  lower(winner) AS address,
  'Reward' AS action,
  'Win Round ' || id AS badge,
  '+' || CASE WHEN ends_at < '2026-05-07 12:00:00+00' THEN ROUND(5.0 * COALESCE(winner_multiplier, 1.0) * 100, 2) ELSE ROUND(5.0 * COALESCE(winner_multiplier, 1.0), 2) END || ' HP' AS value,
  'win' AS type,
  COALESCE(winner_multiplier, 1.0) AS boost_mult,
  ends_at AS created_at
FROM rounds
WHERE winner IS NOT NULL AND status = 'done'

UNION ALL

SELECT
  'tc-' || tc.id AS id,
  lower(tc.address) AS address,
  'Quest' AS action,
  t.type AS badge,
  '+' || CASE WHEN tc.completed_at < '2026-05-07 12:00:00+00' THEN ROUND(t.points * COALESCE(tc.multiplier, 1.0) * 100, 2) ELSE ROUND(t.points * COALESCE(tc.multiplier, 1.0), 2) END || ' HP' AS value,
  'quest' AS type,
  COALESCE(tc.multiplier, 1.0) AS boost_mult,
  tc.completed_at AS created_at
FROM task_completions tc
JOIN tasks t ON tc.task_id = t.id

UNION ALL

SELECT
  'boost-' || id AS id,
  lower(address) AS address,
  'Daily' AS action,
  'Boost' AS badge,
  '+' || CASE WHEN created_at < '2026-05-07 12:00:00+00' THEN ROUND(points * multiplier * 100, 2) ELSE ROUND(points * multiplier, 2) END || ' HP' AS value,
  'boost' AS type,
  multiplier AS boost_mult,
  created_at
FROM hp_boosts

UNION ALL

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

SELECT
  'box-' || id AS id,
  lower(address) AS address,
  'Reward' AS action,
  CASE 
    WHEN box_type IN ('standard_bundle', 'happy_bundle') THEN 'Happy Boxes (6)'
    WHEN box_type IN ('standard', 'happy', 'standard_all', 'happy_all') THEN 'Happy Box'
    ELSE initcap(box_type) || ' Box'
  END AS badge,
  '+' || CASE WHEN created_at < '2026-05-07 12:00:00+00' THEN ROUND(hp_won * applied_multiplier * 100, 2) ELSE ROUND(hp_won * applied_multiplier, 2) END || ' HP' AS value,
  'box' AS type,
  applied_multiplier AS boost_mult,
  created_at
FROM opened_boxes
WHERE box_type NOT IN ('standard_all', 'happy_all')

UNION ALL

SELECT
  'post-' || id AS id,
  lower(address) AS address,
  'Task' AS action,
  'Approved' AS badge,
  '+' || CASE WHEN reviewed_at < '2026-05-07 12:00:00+00' THEN COALESCE(ROUND(hp_awarded * 100, 2), 500.00) ELSE COALESCE(ROUND(hp_awarded, 2), 5.00) END || ' HP' AS value,
  'quest' AS type,
  COALESCE(applied_multiplier, 1.0) AS boost_mult,
  reviewed_at AS created_at
FROM post_submissions
WHERE status = 'approved'

UNION ALL

SELECT
  'act-' || id AS id,
  lower(address) AS address,
  'Activity' AS action,
  'TOP-20' AS badge,
  '+' || CASE WHEN created_at < '2026-05-07 12:00:00+00' THEN ROUND(points * 100, 2) ELSE ROUND(points, 2) END || ' HP' AS value,
  'win' AS type,
  1.0 AS boost_mult,
  created_at
FROM activity_rewards;

GRANT SELECT ON user_activity TO anon, authenticated;
