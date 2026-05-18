-- ============================================
-- DuitKu API: Create app_users table
-- 
-- This table replaces Supabase Auth for user management.
-- All authentication is handled by the backend API with JWT.
-- 
-- Run this in Supabase SQL Editor.
-- ============================================

-- Create app_users table (separate from auth.users)
CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  owner_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: owner cannot have owner_id, staff must have owner_id
  CONSTRAINT valid_role_owner CHECK (
    (role = 'owner' AND owner_id IS NULL) OR
    (role = 'staff' AND owner_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_owner_id ON app_users(owner_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_app_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_app_users_updated_at();

-- ============================================
-- IMPORTANT: Disable RLS on app_users
-- Because we access this table via service_role key
-- which bypasses RLS anyway. Security is handled
-- by the backend API (JWT + middleware).
-- ============================================
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (this is the default behavior)
-- No RLS policies needed since service_role bypasses RLS.

-- ============================================
-- NOTE: The existing tables (transactions, categories, budgets)
-- still reference auth.users(id) via user_id column.
-- 
-- For the new system, transactions.user_id will store
-- the app_users.id of the OWNER (not staff).
-- The backend ensures this by using ownerId from JWT.
--
-- Since we use service_role key, RLS is bypassed and
-- the backend handles all access control.
-- ============================================
