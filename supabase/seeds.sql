-- ==========================================
-- 1. SCHEMA MODIFICATIONS
-- ==========================================

-- Remove email from public.users if it exists (Redundant with auth.users)
DO $$
BEGIN
    
    -- Ensure username exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
        ALTER TABLE public.users ADD COLUMN username VARCHAR(50) UNIQUE;
    END IF;
END $$;

-- Enable PGCrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to safely look up email by username
-- Joins public.users (username) with auth.users (email)
CREATE OR REPLACE FUNCTION get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth -- Access to auth schema required
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT au.email INTO v_email
    FROM public.users pu
    JOIN auth.users au ON pu.id = au.id
    WHERE pu.username = p_username;
    
    RETURN v_email;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon, authenticated, service_role;

-- ==========================================
-- 2. SEED DATA (Users with Usernames)
-- ==========================================

-- 2.1 ADMIN -> Username: 'admin'
DO $$
DECLARE
  var_user_id UUID;
BEGIN
  -- Check if user exists in auth.users
  SELECT id INTO var_user_id FROM auth.users WHERE email = 'admin@phhub.com';

  IF var_user_id IS NULL THEN
    var_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, raw_app_meta_data, raw_user_meta_data)
    VALUES (var_user_id, 'admin@phhub.com', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{}');
  END IF;

  -- Insert/Update public.users using the resolved ID
  INSERT INTO public.users (id, email, full_name, role, username)
  VALUES (var_user_id, 'admin@phhub.com', 'Admin Principal', 'ADMIN', 'admin')
  ON CONFLICT (id) DO UPDATE SET username = 'admin', email = 'admin@phhub.com';
END $$;

-- 2.2 OPERATOR -> Username: 'operador'
DO $$
DECLARE
  var_user_id UUID;
BEGIN
  SELECT id INTO var_user_id FROM auth.users WHERE email = 'operador@phhub.com';

  IF var_user_id IS NULL THEN
    var_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, raw_app_meta_data, raw_user_meta_data)
    VALUES (var_user_id, 'operador@phhub.com', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{}');
  END IF;

  INSERT INTO public.users (id, email, full_name, role, username)
  VALUES (var_user_id, 'operador@phhub.com', 'Operador Logístico', 'OPERATOR', 'operador')
  ON CONFLICT (id) DO UPDATE SET username = 'operador', email = 'operador@phhub.com';
END $$;

-- 2.3 USER -> Username: 'apto101'
DO $$
DECLARE
  var_user_id UUID;
  var_unit_id UUID;
BEGIN
  -- Create Unit
  INSERT INTO public.units (number, coefficient, owner_name)
  VALUES ('APT-101', 0.05, 'Juan Pérez')
  ON CONFLICT (number) DO UPDATE SET owner_name = 'Juan Pérez'
  RETURNING id INTO var_unit_id;

  -- Check Auth User
  SELECT id INTO var_user_id FROM auth.users WHERE email = 'usuario@phhub.com';

  IF var_user_id IS NULL THEN
    var_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, raw_app_meta_data, raw_user_meta_data)
    VALUES (var_user_id, 'usuario@phhub.com', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{}');
  END IF;

  -- Create Public User
  INSERT INTO public.users (id, email, full_name, role, unit_id, username)
  VALUES (var_user_id, 'usuario@phhub.com', 'Juan Pérez', 'USER', var_unit_id, 'apto101')
  ON CONFLICT (id) DO UPDATE SET username = 'apto101', email = 'usuario@phhub.com';
END $$;
