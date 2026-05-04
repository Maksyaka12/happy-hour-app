-- database/018_manual_referral.sql
-- Function to apply a referral code manually

CREATE OR REPLACE FUNCTION apply_referral_code(
  p_address TEXT,
  p_code    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_address TEXT;
  v_current_referrer TEXT;
BEGIN
  -- 1. Check if the user already has a referrer
  SELECT referrer INTO v_current_referrer FROM users WHERE address = lower(p_address);
  
  IF v_current_referrer IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already been referred.');
  END IF;

  -- 2. Find the owner of the referral code
  SELECT address INTO v_referrer_address FROM users WHERE lower(ref_code) = lower(p_code);

  -- 3. Validation
  IF v_referrer_address IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid code');
  END IF;

  IF v_referrer_address = lower(p_address) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot use your own referral code.');
  END IF;

  -- 4. Apply referral
  UPDATE users 
  SET referrer = v_referrer_address 
  WHERE address = lower(p_address);

  -- 5. Increment referral count for the referrer
  UPDATE users 
  SET referral_count = referral_count + 1 
  WHERE address = v_referrer_address;

  RETURN jsonb_build_object('ok', true, 'referrer_address', v_referrer_address);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION apply_referral_code(TEXT, TEXT) TO anon, authenticated;
