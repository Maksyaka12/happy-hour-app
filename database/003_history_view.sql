-- database/003_history_view.sql
-- Run this in Supabase SQL Editor to create the unified user_activity view for the History section.

CREATE OR REPLACE VIEW user_activity AS
-- 1. Depsits (Bets)
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
JOIN tasks t ON tc.task_id = t.id;

-- Ensure the view is publically readable through Row Level Security logic 
-- (Views bypass RLS by default, but we grant access explicitly just in case)
GRANT SELECT ON user_activity TO anon, authenticated;
