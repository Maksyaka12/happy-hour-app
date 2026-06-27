-- database/Season 2/050_add_payout_error_column.sql
-- Migration: Add payout_error column to the rounds table to prevent Edge Function crashes
--            and enable automatic recovery from stuck spinning states.

ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS payout_error TEXT;
