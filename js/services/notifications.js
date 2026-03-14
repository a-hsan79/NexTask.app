// ===========================
// NEXT TASK — Notifications Service
// ===========================

import { supabase } from './supabase.js';

export const NotificationsService = {

  // Get all notifications for current user
  async getNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get unread count
  async getUnreadCount(userId) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) return 0;
    return count || 0;
  },

  // Mark single notification as read
  async markAsRead(notifId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
    if (error) throw error;
  },

  // Mark all as read for a user
  async markAllAsRead(userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
  },

  // Delete a notification
  async deleteNotification(notifId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notifId);
    if (error) throw error;
  },

  // Create a notification (for system/admin use)
  async createNotification({ userId, title, message, type = 'info' }) {
    const insertData = {
      user_id: userId,
      title,
      message,
      type,
      is_read: false
    };
    const { data, error } = await supabase
      .from('notifications')
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Send notification to all team members
  async notifyAll(teamMembers, { title, message, type = 'info' }) {
    const inserts = teamMembers.map(m => ({
      user_id: m.id,
      title,
      message,
      type,
      is_read: false
    }));
    const { error } = await supabase.from('notifications').insert(inserts);
    if (error) throw error;
  },

  // Clear all notifications for a user
  async clearAll(userId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  }
};
