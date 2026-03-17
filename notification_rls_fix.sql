-- ==========================================
-- FIX: Notification RLS Permissions
-- ==========================================
-- This script fixes the "RLS Policy Violation" when Managers/Admins 
-- assign tasks and trigger notifications for other users.

-- 1. Update SELECT policy: Allow users to see their own notifications 
--    OR Managers/Admins to see all (needed for the .select() return in JS)
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users or Managers can view notifications" ON notifications;
CREATE POLICY "Users or Managers can view notifications" 
ON notifications FOR SELECT 
USING (user_id = auth.uid() OR get_my_role() IN ('owner', 'admin', 'manager'));

-- 2. Update INSERT policy: Explicitly allow Managers/Admins to create notifications
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Managers can create notifications" ON notifications;
CREATE POLICY "Managers can create notifications" 
ON notifications FOR INSERT 
WITH CHECK (get_my_role() IN ('owner', 'admin', 'manager') OR user_id = auth.uid());

-- 3. Update DELETE policy for consistency
DROP POLICY IF EXISTS "Users or Admins can delete notifications" ON notifications;
DROP POLICY IF EXISTS "Users or Managers can delete notifications" ON notifications;
CREATE POLICY "Users or Managers can delete notifications" 
ON notifications FOR DELETE 
USING (user_id = auth.uid() OR get_my_role() IN ('owner', 'admin', 'manager'));

-- 4. Expand the allowed notification types (Add 'info', 'success', etc.)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('task', 'order', 'expense', 'system', 'reminder', 'info', 'success', 'warning', 'error'));
