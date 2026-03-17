-- Phase 30: 24-Hour Archival System (RJ Folders)
ALTER TABLE yt_videos ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE freelance_orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
