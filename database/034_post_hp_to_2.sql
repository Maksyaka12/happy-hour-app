-- database/034_post_hp_to_2.sql
-- V3 Core Loop: Update Post Approval Reward to 2.0 HP

CREATE OR REPLACE FUNCTION approve_post(p_admin_address TEXT, p_submission_id BIGINT)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
  -- Updated base post reward to exactly 2.0 HP
  POST_HP NUMERIC := 2.0; 
  v_sub post_submissions;
  v_mult NUMERIC;
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

  -- Add points using the user's permanent HP Boost (multiplier)
  v_mult := add_points(v_sub.address, POST_HP, 'post_approval');

  -- Update submission status with calculated HP reward
  UPDATE post_submissions 
  SET 
    status = 'approved', 
    reviewed_at = NOW(), 
    hp_awarded = ROUND(POST_HP * v_mult, 2), 
    applied_multiplier = v_mult 
  WHERE id = p_submission_id;

  -- Record daily activity stats
  INSERT INTO daily_stats (address, day, posts_approved) 
  VALUES (v_sub.address, CURRENT_DATE, 1) 
  ON CONFLICT (address, day) 
  DO UPDATE SET posts_approved = daily_stats.posts_approved + 1;
  
  PERFORM update_daily_score(v_sub.address);

  RETURN jsonb_build_object('ok', true, 'hp_awarded', ROUND(POST_HP * v_mult, 2), 'multiplier', v_mult);
END;
$$;
