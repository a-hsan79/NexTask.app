// ===========================
// NEXT TASK — Team CRUD Service
// ===========================

import { supabase } from './supabase.js';

export const TeamService = {

  // Get all team members (confirmed only)
  async getMembers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_confirmed', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Get a single member
  async getMember(id) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Update a member's profile (role, name, etc.)
  async updateMember(id, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Get unconfirmed users
  async getPendingUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_confirmed', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Confirm a user
  async confirmUser(id) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_confirmed: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Reject/Delete a pending user
  async rejectUser(id) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Get member names for dropdown selects
  async getMemberOptions() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('is_confirmed', true)
      .order('full_name');
    if (error) throw error;
    return data || [];
  },

  // Upload an avatar image to storage
  async uploadAvatar(file, userId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  // Delete an avatar from storage
  async deleteAvatar(url) {
    if (!url) return;
    try {
      // Extract path from URL (Supabase public URL structure)
      const pathPart = url.split('/storage/v1/object/public/avatars/')[1];
      if (pathPart) {
        await supabase.storage.from('avatars').remove([pathPart]);
      }
    } catch (err) {
      console.warn('Failed to delete old avatar:', err);
    }
  }
};
