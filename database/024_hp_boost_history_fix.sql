-- database/024_hp_boost_history_fix.sql

-- 1. Attach Guardian Trigger to hp_boosts
DROP TRIGGER IF EXISTS trg_hp_boosts_mult ON hp_boosts;
CREATE TRIGGER trg_hp_boosts_mult BEFORE INSERT ON hp_boosts FOR EACH ROW EXECUTE FUNCTION trg_fix_multiplier();

-- 2. Retroactively fix any hp_boosts that were inserted with multiplier = 1.0 today
UPDATE hp_boosts hb
SET multiplier = GREATEST(
  COALESCE((SELECT active_multiplier FROM users WHERE address = hb.address AND multiplier_expires_at > NOW()), 1.0),
  COALESCE((SELECT al.multiplier FROM users u JOIN account_levels al ON u.account_level = al.level WHERE u.address = hb.address), 1.0)
)
WHERE multiplier = 1.0 AND boost_date = CURRENT_DATE;
