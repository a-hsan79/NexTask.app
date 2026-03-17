-- ==========================================
-- NEXT TASK — Enable Real-time for all tables
-- ==========================================

-- 1. Create the realtime publication if it doesn't exist
-- Note: Supabase usually has a 'supabase_realtime' publication by default.
-- We will add our tables to it.

-- Enable Realtime for YouTube Channels
ALTER TABLE yt_channels REPLICA IDENTITY FULL;
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'yt_channels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE yt_channels;
  END IF;
END $$;

-- Enable Realtime for YouTube Videos
ALTER TABLE yt_videos REPLICA IDENTITY FULL;
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'yt_videos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE yt_videos;
  END IF;
END $$;

-- Enable Realtime for Freelance Projects
ALTER TABLE freelance_projects REPLICA IDENTITY FULL;
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'freelance_projects') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE freelance_projects;
  END IF;
END $$;

-- Enable Realtime for Freelance Orders
ALTER TABLE freelance_orders REPLICA IDENTITY FULL;
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'freelance_orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE freelance_orders;
  END IF;
END $$;

-- Enable Realtime for General Tasks
ALTER TABLE tasks REPLICA IDENTITY FULL;
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;

-- 2. Ensure the 'authenticated' and 'anon' roles can access realtime
-- (Usually handled by Supabase default permissions, but safe to ensure)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
