-- ==========================================
-- NEXT TASK — FINAL CONSOLIDATED DATABASE SCRIPT
-- ==========================================
-- This file contains the complete, final structure for the NexTask database.
-- It applies all tables, columns (including V2), relationships, and the final strict RLS policies.
-- Simply copy this entire file and paste it into your Supabase SQL Editor and hit "Run".

-- ==========================================
-- 1. UTILITY FUNCTIONS
-- ==========================================

-- Function to safely check user role without recursive RLS failures
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to autocreate profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 
    new.email,
    'editor' -- Default role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user()
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'manager', 'editor', 'designer', 'writer')),
  avatar_url TEXT,
  phone TEXT,
  is_remote BOOLEAN DEFAULT false,
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- YT CHANNELS
CREATE TABLE IF NOT EXISTS yt_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  description TEXT,
  section TEXT DEFAULT 'automation' CHECK (section IN ('automation', 'office')),
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- YT VIDEOS (Includes V2 links)
CREATE TABLE IF NOT EXISTS yt_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES yt_channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  script_link TEXT,
  voiceover_link TEXT,
  thumbnail_link TEXT,
  video_link TEXT,
  script_v2_link TEXT,
  voiceover_v2_link TEXT,
  thumbnail_v2_link TEXT,
  video_v2_link TEXT,
  assigned_to UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scripting', 'recording', 'editing', 'uploaded', 'published')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FREELANCE PROJECTS
CREATE TABLE IF NOT EXISTS freelance_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'direct' CHECK (platform IN ('fiverr', 'upwork', 'direct')),
  client_name TEXT,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FREELANCE ORDERS
CREATE TABLE IF NOT EXISTS freelance_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES freelance_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  brief_link TEXT,
  design_link TEXT,
  deliverable_link TEXT,
  amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'PKR',
  assigned_to UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'delivered', 'completed', 'revision', 'cancelled')),
  deadline TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GENERAL TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'completed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  category TEXT DEFAULT 'yt_automation' CHECK (category IN ('yt_automation', 'freelance', 'office', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'PKR',
  category TEXT DEFAULT 'office' CHECK (category IN ('team', 'office', 'software', 'equipment', 'other')),
  paid_by UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'system' CHECK (type IN ('task', 'order', 'expense', 'system', 'reminder')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. APPLY TRIGGERS
-- ==========================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_yt_channels_updated_at ON yt_channels;
CREATE TRIGGER update_yt_channels_updated_at BEFORE UPDATE ON yt_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_yt_videos_updated_at ON yt_videos;
CREATE TRIGGER update_yt_videos_updated_at BEFORE UPDATE ON yt_videos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_freelance_projects_updated_at ON freelance_projects;
CREATE TRIGGER update_freelance_projects_updated_at BEFORE UPDATE ON freelance_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_freelance_orders_updated_at ON freelance_orders;
CREATE TRIGGER update_freelance_orders_updated_at BEFORE UPDATE ON freelance_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- 4. ENABLE RLS
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelance_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelance_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. APPLY STRICT RLS POLICIES (FINAL/CLEAN)
-- ==========================================

-- Clean ALL existing policies on these tables so we can apply fresh ones.
-- This ensures no conflicting policies cause issues.
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- PROFILES
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins+ can update profiles" ON profiles FOR UPDATE USING (get_my_role() IN ('owner', 'admin'));
CREATE POLICY "Admins+ can delete profiles" ON profiles FOR DELETE USING (get_my_role() IN ('owner', 'admin'));

-- YT CHANNELS
CREATE POLICY "Authenticated can view channels" ON yt_channels FOR SELECT USING (
  get_my_role() IN ('owner', 'admin', 'manager') OR 
  is_public = true OR 
  EXISTS (SELECT 1 FROM yt_videos WHERE channel_id = yt_channels.id AND (assigned_to = auth.uid() OR created_by = auth.uid()))
);
CREATE POLICY "Admins+ can create channels" ON yt_channels FOR INSERT WITH CHECK (get_my_role() IN ('owner', 'admin'));
CREATE POLICY "Admins+ can update channels" ON yt_channels FOR UPDATE USING (get_my_role() IN ('owner', 'admin'));
CREATE POLICY "Admins+ can delete channels" ON yt_channels FOR DELETE USING (get_my_role() IN ('owner', 'admin'));

-- YT VIDEOS
CREATE POLICY "Assigned users or Admins can view videos" ON yt_videos FOR SELECT USING (get_my_role() IN ('owner', 'admin', 'manager') OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Admins+ can create videos" ON yt_videos FOR INSERT WITH CHECK (get_my_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "Admins+ can update videos" ON yt_videos FOR UPDATE USING (get_my_role() IN ('owner', 'admin', 'manager') OR assigned_to = auth.uid());
CREATE POLICY "Admins+ can delete videos" ON yt_videos FOR DELETE USING (get_my_role() IN ('owner', 'admin', 'manager'));

-- FREELANCE PROJECTS
CREATE POLICY "Authenticated can view projects" ON freelance_projects FOR SELECT USING (
  get_my_role() IN ('owner', 'admin', 'manager') OR 
  is_public = true OR 
  EXISTS (SELECT 1 FROM freelance_orders WHERE project_id = freelance_projects.id AND (assigned_to = auth.uid() OR created_by = auth.uid()))
);
CREATE POLICY "Admins+ can create projects" ON freelance_projects FOR INSERT WITH CHECK (get_my_role() IN ('owner', 'admin'));
CREATE POLICY "Admins+ can update projects" ON freelance_projects FOR UPDATE USING (get_my_role() IN ('owner', 'admin'));
CREATE POLICY "Admins+ can delete projects" ON freelance_projects FOR DELETE USING (get_my_role() IN ('owner', 'admin'));

-- FREELANCE ORDERS
CREATE POLICY "Assigned users or Admins can view orders" ON freelance_orders FOR SELECT USING (get_my_role() IN ('owner', 'admin', 'manager') OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Admins+ can create orders" ON freelance_orders FOR INSERT WITH CHECK (get_my_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "Admins+ can update orders" ON freelance_orders FOR UPDATE USING (get_my_role() IN ('owner', 'admin', 'manager') OR assigned_to = auth.uid());
CREATE POLICY "Admins+ can delete orders" ON freelance_orders FOR DELETE USING (get_my_role() IN ('owner', 'admin', 'manager'));

-- GENERAL TASKS
CREATE POLICY "Assigned users or Admins can view tasks" ON tasks FOR SELECT USING (get_my_role() IN ('owner', 'admin', 'manager') OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Admins+ can create tasks" ON tasks FOR INSERT WITH CHECK (get_my_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "Admins+ can update tasks" ON tasks FOR UPDATE USING (get_my_role() IN ('owner', 'admin', 'manager') OR assigned_to = auth.uid());
CREATE POLICY "Admins+ can delete tasks" ON tasks FOR DELETE USING (get_my_role() IN ('owner', 'admin', 'manager'));

-- EXPENSES
CREATE POLICY "Admins+ can view expenses" ON expenses FOR SELECT USING (get_my_role() IN ('owner', 'admin'));
CREATE POLICY "Admins+ can create expenses" ON expenses FOR INSERT WITH CHECK (get_my_role() IN ('owner', 'admin'));
CREATE POLICY "Admins+ can update expenses" ON expenses FOR UPDATE USING (get_my_role() IN ('owner', 'admin'));
CREATE POLICY "Admins+ can delete expenses" ON expenses FOR DELETE USING (get_my_role() IN ('owner', 'admin'));

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users or Admins can delete notifications" ON notifications FOR DELETE USING (auth.uid() = user_id OR get_my_role() IN ('owner', 'admin'));

-- ==========================================
-- 6. INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_freelance_orders_assigned ON freelance_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_yt_videos_assigned ON yt_videos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
-- FINISHED!
