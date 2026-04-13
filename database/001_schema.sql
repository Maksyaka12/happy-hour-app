-- database/001_schema.sql
-- Run in Supabase SQL Editor first.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  address      TEXT PRIMARY KEY,
  basename     TEXT,
  points       INTEGER NOT NULL DEFAULT 0,
  wins         INTEGER NOT NULL DEFAULT 0,
  entries      INTEGER NOT NULL DEFAULT 0,
  streak       INTEGER NOT NULL DEFAULT 0,
  streak_last  DATE,
  referrer     TEXT REFERENCES users(address),
  referral_count  INTEGER NOT NULL DEFAULT 0,
  referral_points INTEGER NOT NULL DEFAULT 0,
  ref_code        TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rounds (
  id              BIGSERIAL PRIMARY KEY,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',
  total_pot       NUMERIC(18,6) NOT NULL DEFAULT 0,
  winner          TEXT,
  prize           NUMERIC(18,6),
  already_paid    BOOLEAN NOT NULL DEFAULT FALSE,
  tx_hash_payout  TEXT,
  payout_error    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bets (
  id           BIGSERIAL PRIMARY KEY,
  round_id     BIGINT NOT NULL REFERENCES rounds(id),
  address      TEXT NOT NULL REFERENCES users(address),
  amount       NUMERIC(18,6) NOT NULL,
  tickets      INTEGER NOT NULL,
  tx_hash      TEXT UNIQUE NOT NULL,
  block_number BIGINT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkins (
  id           BIGSERIAL PRIMARY KEY,
  address      TEXT NOT NULL REFERENCES users(address),
  checked_date DATE NOT NULL,
  tx_hash      TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, checked_date)
);

CREATE TABLE IF NOT EXISTS tasks (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type       TEXT NOT NULL,
  text       TEXT NOT NULL,
  url        TEXT NOT NULL,
  points     INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_completions (
  id           BIGSERIAL PRIMARY KEY,
  task_id      TEXT NOT NULL REFERENCES tasks(id),
  address      TEXT NOT NULL REFERENCES users(address),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, address)
);

CREATE INDEX IF NOT EXISTS bets_round_idx ON bets(round_id);
CREATE INDEX IF NOT EXISTS bets_address_idx ON bets(address);
CREATE INDEX IF NOT EXISTS users_points_idx ON users(points DESC);
CREATE INDEX IF NOT EXISTS checkins_address_date_idx ON checkins(address, checked_date DESC);
CREATE INDEX IF NOT EXISTS task_completions_address_idx ON task_completions(address, completed_at DESC);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'public read users'
  ) THEN
    CREATE POLICY "public read users" ON users FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rounds' AND policyname = 'public read rounds'
  ) THEN
    CREATE POLICY "public read rounds" ON rounds FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bets' AND policyname = 'public read bets'
  ) THEN
    CREATE POLICY "public read bets" ON bets FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'public read tasks'
  ) THEN
    CREATE POLICY "public read tasks" ON tasks FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_completions' AND policyname = 'public read tc'
  ) THEN
    CREATE POLICY "public read tc" ON task_completions FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'checkins' AND policyname = 'public read checkins'
  ) THEN
    CREATE POLICY "public read checkins" ON checkins FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bets;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE users;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'checkins'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE checkins;
  END IF;
END $$;
