-- database/027_task_admin_enhancements.sql
-- Migration to support administrative task management, custom icons, editing, and deleting.

-- 1. Add icon_url column to tasks table if it does not exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- 2. Create or replace admin task edit function
CREATE OR REPLACE FUNCTION admin_update_task(
  p_admin_address TEXT,
  p_task_id TEXT,
  p_type TEXT,
  p_text TEXT,
  p_url TEXT,
  p_points INTEGER,
  p_icon_url TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
BEGIN
  IF lower(trim(p_admin_address)) <> ADMIN_WALLET THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  UPDATE tasks
  SET
    type = p_type,
    text = p_text,
    url = p_url,
    points = p_points,
    icon_url = NULLIF(trim(p_icon_url), ''),
    expires_at = COALESCE(p_expires_at, expires_at)
  WHERE id = p_task_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_task(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ) TO anon, authenticated, service_role;

-- 3. Create or replace admin task delete function
CREATE OR REPLACE FUNCTION admin_delete_task(
  p_admin_address TEXT,
  p_task_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
BEGIN
  IF lower(trim(p_admin_address)) <> ADMIN_WALLET THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  -- First delete completions associated with this task to prevent foreign key issues
  DELETE FROM task_completions WHERE task_id = p_task_id;
  
  -- Delete the task itself
  DELETE FROM tasks WHERE id = p_task_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_task(TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. Create or replace admin task creation function with 7 arguments
CREATE OR REPLACE FUNCTION admin_create_task(
  p_admin_address TEXT,
  p_type TEXT,
  p_text TEXT,
  p_url TEXT,
  p_points INTEGER,
  p_icon_url TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_WALLET TEXT := '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a';
  v_expires TIMESTAMPTZ;
BEGIN
  IF lower(trim(p_admin_address)) <> ADMIN_WALLET THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  v_expires := COALESCE(p_expires_at, NOW() + INTERVAL '24 hours');

  INSERT INTO tasks (type, text, url, points, expires_at, icon_url)
  VALUES (p_type, p_text, p_url, p_points, v_expires, NULLIF(trim(p_icon_url), ''));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_task(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ) TO anon, authenticated, service_role;

-- 5. Backwards compatibility overload for admin_create_task (5 arguments)
CREATE OR REPLACE FUNCTION admin_create_task(
  p_admin_address TEXT,
  p_type TEXT,
  p_text TEXT,
  p_url TEXT,
  p_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN admin_create_task(p_admin_address, p_type, p_text, p_url, p_points, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_task(TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated, service_role;
