-- database/016_post_submissions.sql
-- "Post about us" feature: submission, review, approval flow.

-- ============================================================
-- STEP 1: Create post_submissions table
-- ============================================================
CREATE TABLE IF NOT EXISTS post_submissions (
  id                BIGSERIAL PRIMARY KEY,
  address           TEXT NOT NULL,
  url               TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  hp_awarded        INTEGER DEFAULT 10,
  applied_multiplier NUMERIC DEFAULT 1.0,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_post_submissions_address ON post_submissions(address);
CREATE INDEX IF NOT EXISTS idx_post_submissions_status  ON post_submissions(status);

-- Safely add new columns if they don't exist yet (for re-runs on existing table)
ALTER TABLE post_submissions ADD COLUMN IF NOT EXISTS hp_awarded INTEGER DEFAULT 10;
ALTER TABLE post_submissions ADD COLUMN IF NOT EXISTS applied_multiplier NUMERIC DEFAULT 1.0;

-- ============================================================
-- STEP 2: submit_post — user submits a link (max 1 pending per day)
-- ============================================================
CREATE OR REPLACE FUNCTION submit_post(
  p_address TEXT,
  p_url     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
BEGIN
  -- Validate input
  IF v_address IS NULL OR v_address = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid address');
  END IF;

  IF p_url IS NULL OR NOT (p_url LIKE 'http://%' OR p_url LIKE 'https://%') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'URL must start with http:// or https://');
  END IF;

  -- Max 1 submission per day (any status)
  IF EXISTS (
    SELECT 1 FROM post_submissions
    WHERE address = v_address
      AND submitted_at::date = CURRENT_DATE
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can only submit one post per day');
  END IF;

  INSERT INTO post_submissions (address, url)
  VALUES (v_address, p_url);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- STEP 3: approve_post — admin approves, HP awarded with multiplier
-- ============================================================
CREATE OR REPLACE FUNCTION approve_post(
  p_admin_address  TEXT,
  p_submission_id  BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET  TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
  POST_HP       INTEGER := 10;
  v_sub         post_submissions;
  v_mult        NUMERIC;
BEGIN
  IF lower(trim(p_admin_address)) <> ADMIN_WALLET THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_sub FROM post_submissions WHERE id = p_submission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Submission not found');
  END IF;

  IF v_sub.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already reviewed');
  END IF;

  -- Award HP with multiplier
  v_mult := add_points(v_sub.address, POST_HP, 'post_approval');

  UPDATE post_submissions
  SET
    status = 'approved',
    reviewed_at = NOW(),
    hp_awarded = ceil(POST_HP * v_mult),
    applied_multiplier = v_mult
  WHERE id = p_submission_id;

  RETURN jsonb_build_object(
    'ok', true,
    'hp_awarded', ceil(POST_HP * v_mult),
    'multiplier', v_mult
  );
END;
$$;

-- ============================================================
-- STEP 4: reject_post — admin rejects, nothing awarded
-- ============================================================
CREATE OR REPLACE FUNCTION reject_post(
  p_admin_address TEXT,
  p_submission_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
BEGIN
  IF lower(trim(p_admin_address)) <> ADMIN_WALLET THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  UPDATE post_submissions
  SET status = 'rejected', reviewed_at = NOW()
  WHERE id = p_submission_id AND status = 'pending';

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- STEP 5: get_pending_posts — admin fetches pending queue
-- ============================================================
CREATE OR REPLACE FUNCTION get_pending_posts(p_admin_address TEXT)
RETURNS TABLE (
  id           BIGINT,
  address      TEXT,
  url          TEXT,
  submitted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
BEGIN
  IF lower(trim(p_admin_address)) <> ADMIN_WALLET THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ps.id, ps.address, ps.url, ps.submitted_at
  FROM post_submissions ps
  WHERE ps.status = 'pending'
  ORDER BY ps.submitted_at ASC;
END;
$$;

-- ============================================================
-- STEP 6: Update user_activity view to include approved posts
-- ============================================================
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

-- 3. Wins in Raffle (with multiplier support, from 015)
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
FROM opened_boxes

UNION ALL

-- 8. Approved Post Submissions
SELECT
  'post-' || id AS id,
  lower(address) AS address,
  'Task' AS action,
  'Approved' AS badge,
  '+' || COALESCE(hp_awarded, 10) || ' HP' AS value,
  'quest' AS type,
  COALESCE(applied_multiplier, 1.0) AS boost_mult,
  reviewed_at AS created_at
FROM post_submissions
WHERE status = 'approved';

GRANT SELECT ON user_activity TO anon, authenticated;

-- Permissions
GRANT EXECUTE ON FUNCTION submit_post(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_post(TEXT, BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION reject_post(TEXT, BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_pending_posts(TEXT) TO anon, authenticated, service_role;
GRANT ALL ON TABLE post_submissions TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE post_submissions_id_seq TO anon, authenticated, service_role;
