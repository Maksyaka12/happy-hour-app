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

-- (approve_post function was removed here as it was rewritten in 020_activity_leaderboard.sql)

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

-- (The user_activity view has been removed from here as it was rewritten in 021_activity_fixes.sql)

-- Permissions
GRANT EXECUTE ON FUNCTION submit_post(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_post(TEXT, BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION reject_post(TEXT, BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_pending_posts(TEXT) TO anon, authenticated, service_role;
GRANT ALL ON TABLE post_submissions TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE post_submissions_id_seq TO anon, authenticated, service_role;
