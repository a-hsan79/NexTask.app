-- ==========================================
-- STORAGE SETUP: AVATARS BUCKET
-- ==========================================
-- Run this in your Supabase SQL Editor to enable profile picture storage.

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to read avatars
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'avatars' );

-- 3. Allow authenticated staff (Owners, Admins, Managers) to upload avatars
CREATE POLICY "Staff Upload Access" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin', 'manager')
);

-- 4. Allow authenticated staff to update/delete avatars
CREATE POLICY "Staff Update Access" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'avatars' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin', 'manager')
);

CREATE POLICY "Staff Delete Access" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'avatars' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin', 'manager')
);
