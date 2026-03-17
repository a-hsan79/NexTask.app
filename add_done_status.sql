-- ==========================================
-- Phase 23: Global 'Done' Status Migration
-- ==========================================

-- Update yt_videos status constraint
ALTER TABLE yt_videos DROP CONSTRAINT IF EXISTS yt_videos_status_check;
ALTER TABLE yt_videos ADD CONSTRAINT yt_videos_status_check 
  CHECK (status IN ('draft', 'scripting', 'recording', 'editing', 'uploaded', 'published', 'done'));

-- Update freelance_orders status constraint
ALTER TABLE freelance_orders DROP CONSTRAINT IF EXISTS freelance_orders_status_check;
ALTER TABLE freelance_orders ADD CONSTRAINT freelance_orders_status_check 
  CHECK (status IN ('new', 'in_progress', 'delivered', 'completed', 'revision', 'cancelled', 'done'));

-- Update tasks status constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'done'));
