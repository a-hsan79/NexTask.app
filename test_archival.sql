-- Simulation Script for Archival System
-- Run this in your Supabase SQL Editor to make some items "Old" (over 24 hours)

-- 1. Make some videos archived
UPDATE yt_videos 
SET created_at = NOW() - INTERVAL '48 hours'
WHERE id IN (
  SELECT id FROM yt_videos LIMIT 3
);

-- 2. Make some freelance orders archived
UPDATE freelance_orders 
SET created_at = NOW() - INTERVAL '48 hours'
WHERE id IN (
  SELECT id FROM freelance_orders LIMIT 3
);
