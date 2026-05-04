-- database/019_task_onchain_claim.sql
-- Update claim_task_completion to require a tx_hash

-- First, add tx_hash column to task_completions if it doesn't exist
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS tx_hash TEXT;

CREATE OR REPLACE FUNCTION claim_task_completion(
  p_task_id TEXT,
  p_address TEXT,
  p_tx_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address TEXT := lower(trim(p_address));
  v_task tasks;
  v_inserted BIGINT;
BEGIN
  IF v_address IS NULL OR v_address = '' OR p_task_id IS NULL OR trim(p_task_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing task or address');
  END IF;

  -- Ensure user profile exists
  PERFORM sync_user_profile(v_address, NULL, NULL);

  -- Get task details
  SELECT * INTO v_task
  FROM tasks
  WHERE id = p_task_id
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Task not found or expired');
  END IF;

  -- Record completion with tx_hash
  INSERT INTO task_completions (task_id, address, tx_hash)
  VALUES (p_task_id, v_address, lower(trim(p_tx_hash)))
  ON CONFLICT (task_id, address) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Task already claimed');
  END IF;

  -- Award points
  PERFORM add_points(v_address, v_task.points, 'task:' || p_task_id);

  RETURN jsonb_build_object(
    'ok', true,
    'pointsAwarded', v_task.points,
    'txHash', p_tx_hash
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION claim_task_completion(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
