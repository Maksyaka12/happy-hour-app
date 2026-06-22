-- database/044_contest_submissions.sql
-- "Launch Contest" post submissions: submission & review flow.

CREATE TABLE IF NOT EXISTS contest_submissions (
  id           BIGSERIAL PRIMARY KEY,
  address      TEXT NOT NULL,
  url          TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contest_submissions_address ON contest_submissions(address);

-- submit_contest_post — user submits a link for the Launch Contest (unlimited times, no 24h block)
CREATE OR REPLACE FUNCTION submit_contest_post(
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

  INSERT INTO contest_submissions (address, url)
  VALUES (v_address, p_url);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- get_contest_submissions — admin fetches all submissions queue
CREATE OR REPLACE FUNCTION get_contest_submissions(p_admin_address TEXT)
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
  SELECT cs.id, cs.address, cs.url, cs.submitted_at
  FROM contest_submissions cs
  ORDER BY cs.submitted_at DESC;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION submit_contest_post(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_contest_submissions(TEXT) TO anon, authenticated, service_role;
GRANT ALL ON TABLE contest_submissions TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE contest_submissions_id_seq TO anon, authenticated, service_role;
