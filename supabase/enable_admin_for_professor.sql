-- ============================================================
-- Enable dual role (professor + admin) for a specific user
-- Replace 'YOUR_EMAIL_HERE' with your actual email
-- ============================================================

-- Step 1: Find your profile and verify it exists
SELECT id, email, full_name, role, is_admin 
FROM profiles 
WHERE email = 'YOUR_EMAIL_HERE';

-- Step 2: Update your profile to have admin privileges
-- (Run this after confirming your email above)
UPDATE profiles 
SET is_admin = true 
WHERE email = 'YOUR_EMAIL_HERE';

-- Step 3: Verify the change
SELECT id, email, full_name, role, is_admin 
FROM profiles 
WHERE email = 'YOUR_EMAIL_HERE';

-- ============================================================
-- ALTERNATIVE: If you don't have a profile yet, create one
-- (Only run this if you need to create your account from scratch)
-- ============================================================

-- First, you need to sign up via the app or Supabase Auth UI
-- Then run the UPDATE above to set is_admin = true
