-- database/033_incremental_activity_points.sql
-- V3 Core Loop: Incremental AP Accrual & Real-Time Multipliers

-- 1. Create a trigger function to incrementally accrue daily score based on exact active multipliers
CREATE OR REPLACE FUNCTION trigger_accrue_daily_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_act_mult NUMERIC := 1.0;
  v_base_ap NUMERIC := 0.0;
  v_delta_base NUMERIC := 0.0;
  v_delta_burned INTEGER := 0;
BEGIN
  -- Get user's active activity boost multiplier at this exact moment
  SELECT COALESCE(al.multiplier, 1.0) INTO v_act_mult
  FROM users u
  LEFT JOIN activity_levels al ON u.activity_level = al.level
  WHERE u.address = NEW.address;

  IF TG_OP = 'INSERT' THEN
    -- On INSERT, calculate score from scratch using the current active multiplier
    v_base_ap := (NEW.checkin_done::int * 30) + 
                 NEW.streak + 
                 (NEW.tasks_done * 10) + 
                 (NEW.tx_count * 10) + 
                 (NEW.posts_approved * 30);
    NEW.score := ROUND(v_base_ap * v_act_mult)::integer - NEW.ap_burned;
  ELSIF TG_OP = 'UPDATE' THEN
    -- On UPDATE, calculate the difference and add it incrementally
    -- A. Checkin (+30 AP)
    IF NEW.checkin_done IS DISTINCT FROM OLD.checkin_done AND NEW.checkin_done = TRUE THEN
      v_delta_base := v_delta_base + 30;
    END IF;

    -- B. Streak (+Streak AP)
    IF NEW.streak IS DISTINCT FROM OLD.streak THEN
      v_delta_base := v_delta_base + (NEW.streak - COALESCE(OLD.streak, 0));
    END IF;

    -- C. Tasks (+10 AP per task)
    IF NEW.tasks_done IS DISTINCT FROM OLD.tasks_done THEN
      v_delta_base := v_delta_base + (NEW.tasks_done - COALESCE(OLD.tasks_done, 0)) * 10;
    END IF;

    -- D. Transactions (+10 AP per tx)
    IF NEW.tx_count IS DISTINCT FROM OLD.tx_count THEN
      v_delta_base := v_delta_base + (NEW.tx_count - COALESCE(OLD.tx_count, 0)) * 10;
    END IF;

    -- E. Approved posts (+30 AP per post)
    IF NEW.posts_approved IS DISTINCT FROM OLD.posts_approved THEN
      v_delta_base := v_delta_base + (NEW.posts_approved - COALESCE(OLD.posts_approved, 0)) * 30;
    END IF;

    -- F. AP burned (flat subtraction, not multiplied)
    IF NEW.ap_burned IS DISTINCT FROM OLD.ap_burned THEN
      v_delta_burned := NEW.ap_burned - COALESCE(OLD.ap_burned, 0);
    END IF;

    -- Accrue delta score using active multiplier at that moment
    NEW.score := OLD.score + ROUND(v_delta_base * v_act_mult)::integer - v_delta_burned;
  END IF;

  -- Ensure score does not fall below 0
  IF NEW.score < 0 THEN
    NEW.score := 0;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Bind the trigger BEFORE INSERT OR UPDATE to daily_stats
DROP TRIGGER IF EXISTS trg_accrue_daily_score ON daily_stats;
CREATE TRIGGER trg_accrue_daily_score
BEFORE INSERT OR UPDATE ON daily_stats
FOR EACH ROW
EXECUTE FUNCTION trigger_accrue_daily_score();

-- 3. Redefine update_daily_score to a safe no-op to prevent other processes from overwriting score
CREATE OR REPLACE FUNCTION update_daily_score(p_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Daily score is now incrementally accrued in real-time via trg_accrue_daily_score trigger.
  -- This function is kept as a safe no-op for backward compatibility.
END;
$$;
