-- ============================================================
-- Add admin capabilities to professors (dual role support)
-- This allows a professor to also have admin privileges
-- without changing the existing role-based RLS policies.
-- ============================================================

-- Add is_admin flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Create the get_user_role() function if it doesn't exist
-- This function returns 'admin' if the user has is_admin = true, otherwise returns their role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT 
    CASE 
      WHEN is_admin THEN 'admin'
      ELSE role::text
    END
  FROM public.profiles 
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- Grant admin the ability to toggle is_admin on profiles
-- ============================================================

-- Admins can set is_admin on any profile
CREATE POLICY "Admins can update is_admin flag"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
  );
