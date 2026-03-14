// ===========================
// NexTask — Tasks CRUD Service
// ===========================

import { supabase } from './supabase.js';

export const TasksService = {

  // Fetch all tasks (or user's own based on permissions)
  async getTasks({ status, priority, category, assignedTo, search, limit = 50 } = {}) {
    let query = supabase
      .from('tasks')
      .select('*, assigned_profile:profiles!tasks_assigned_to_fkey(full_name, role, is_remote), creator:profiles!tasks_created_by_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') query = query.eq('status', status);
    if (priority && priority !== 'all') query = query.eq('priority', priority);
    if (category && category !== 'all') query = query.eq('category', category);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get single task
  async getTask(id) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assigned_profile:profiles!tasks_assigned_to_fkey(full_name, role), creator:profiles!tasks_created_by_fkey(full_name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Create new task
  async createTask(task) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update task
  async updateTask(id, updates) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Delete task
  async deleteTask(id) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Get task counts by status
  async getTaskStats(category) {
    let query = supabase.from('tasks').select('status');
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    const stats = { total: 0, pending: 0, in_progress: 0, review: 0, completed: 0 };
    (data || []).forEach(t => {
      stats.total++;
      if (stats[t.status] !== undefined) stats[t.status]++;
    });
    return stats;
  }
};
