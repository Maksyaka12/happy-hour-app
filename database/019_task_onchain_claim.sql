-- database/019_task_onchain_claim.sql
-- Update claim_task_completion to require a tx_hash

-- First, add tx_hash column to task_completions if it doesn't exist
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS tx_hash TEXT;

-- (The claim_task_completion function has been removed from here as it was rewritten in 020_activity_leaderboard.sql)
