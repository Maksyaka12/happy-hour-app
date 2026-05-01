-- database/010_backfill_total_spent.sql

-- Backfill total_spent for all users based on historical activity
UPDATE users u
SET total_spent = 
  -- 1. Calculate past Daily HP Boosts (0.10 USDC each)
  COALESCE(
    (SELECT COUNT(*) * 0.10 FROM hp_boosts WHERE address = u.address), 
    0.00
  ) 
  + 
  -- 2. Calculate past Multipliers (2.0x = 0.50 USDC, 5.0x = 1.00 USDC)
  COALESCE(
    (SELECT SUM(
      CASE 
        WHEN multiplier = 2.0 THEN 0.50
        WHEN multiplier = 5.0 THEN 1.00
        ELSE 0.00 
      END
    ) FROM purchased_multipliers WHERE address = u.address), 
    0.00
  );
