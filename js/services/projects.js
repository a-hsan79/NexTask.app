// ===========================
// NEXT TASK — Freelance Projects + Orders Service
// ===========================

import { supabase } from './supabase.js';

export const ProjectsService = {

  // === PROJECTS ===

  async getProjects({ platform, search } = {}) {
    let query = supabase
      .from('freelance_projects')
      .select('*, creator:profiles!freelance_projects_created_by_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (platform && platform !== 'all') query = query.eq('platform', platform);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getProject(id) {
    const { data, error } = await supabase
      .from('freelance_projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createProject(project) {
    const { data, error } = await supabase
      .from('freelance_projects')
      .insert(project)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProject(id, updates) {
    const { data, error } = await supabase
      .from('freelance_projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProject(id) {
    const { error } = await supabase.from('freelance_projects').delete().eq('id', id);
    if (error) throw error;
  },

  // === ORDERS ===

  async getOrders(projectId, { status, search, platform, includeArchived = false } = {}) {
    let query = supabase
      .from('freelance_orders')
      .select('*, assigned_profile:profiles!freelance_orders_assigned_to_fkey(full_name, role), creator:profiles!freelance_orders_created_by_fkey(full_name), freelance_projects!inner(name, platform)')
      .order('created_at', { ascending: false });

    // Manual Archival Logic
    if (includeArchived) {
      query = query.eq('is_archived', true);
    } else {
      query = query.eq('is_archived', false);
    }

    if (projectId) query = query.eq('project_id', projectId);
    if (status && status !== 'all') query = query.eq('status', status);
    if (platform && platform !== 'all') query = query.eq('freelance_projects.platform', platform);

    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createOrder(order) {
    const { data, error } = await supabase
      .from('freelance_orders')
      .insert(order)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateOrder(id, updates) {
    const { data, error } = await supabase
      .from('freelance_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteOrder(id) {
    const { error } = await supabase.from('freelance_orders').delete().eq('id', id);
    if (error) throw error;
  },

  async archiveOrder(id) {
    const { error } = await supabase.from('freelance_orders').update({ is_archived: true }).eq('id', id);
    if (error) throw error;
  },

  async unarchiveOrder(id) {
    const { error } = await supabase.from('freelance_orders').update({ is_archived: false }).eq('id', id);
    if (error) throw error;
  },

  // Get order count and completion status per project (Active only)
  async getProjectOrderCount(projectId) {
    const { data, error } = await supabase
      .from('freelance_orders')
      .select('status')
      .eq('project_id', projectId)
      .eq('is_archived', false);
    
    if (error) return { total: 0, done: 0 };
    
    const total = data.length;
    const done = data.filter(o => o.status === 'completed' || o.status === 'done').length;
    const delivered = data.filter(o => o.status === 'delivered').length;
    
    return { total, done, delivered };
  },

  // Get all order stats across all projects (Active only)
  async getAllOrderStats() {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('freelance_orders')
      .select('status, amount, assigned_to')
      .gte('created_at', dayAgo);

    if (error) throw error;
    const stats = { 
      total: 0, 
      unassigned: 0, 
      assigned: 0, 
      done: 0,
      new: 0, in_progress: 0, delivered: 0, completed: 0, revision: 0, cancelled: 0, totalRevenue: 0 
    };
    
    (data || []).forEach(o => {
      stats.total++;
      if (stats[o.status] !== undefined && o.status !== 'done') stats[o.status]++;
      if (o.status !== 'cancelled') stats.totalRevenue += (o.amount || 0);
      
      if (!o.assigned_to) stats.unassigned++;
      else {
        if (o.status !== 'completed' && o.status !== 'done' && o.status !== 'cancelled') {
          stats.assigned++;
        }
      }
      
      if (o.status === 'completed' || o.status === 'done') stats.done++;
    });
    return stats;
  },

  // === ARCHIVE LOGIC ===

  async getArchivedOrderDates(projectId) {
    let query = supabase
      .from('freelance_orders')
      .select('created_at')
      .eq('is_archived', true)
      .order('created_at', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);

    const { data, error } = await query;
    if (error) throw error;

    // Group by unique YYYY-MM-DD
    const dates = [...new Set(data.map(o => o.created_at.split('T')[0]))];
    return dates;
  },

  // BULK methods for performance
  async getBulkProjectOrderCounts(projectIds) {
    if (!projectIds || !projectIds.length) return {};
    
    const { data, error } = await supabase
      .from('freelance_orders')
      .select('project_id, status')
      .in('project_id', projectIds)
      .eq('is_archived', false);
      
    if (error) throw error;
    
    const res = {};
    projectIds.forEach(id => res[id] = { total: 0, done: 0, delivered: 0 });
    
    (data || []).forEach(o => {
      res[o.project_id].total++;
      if (o.status === 'completed' || o.status === 'done') res[o.project_id].done++;
      if (o.status === 'delivered') res[o.project_id].delivered++;
    });
    return res;
  },

  async getBulkArchivedOrderDates(projectIds) {
    if (!projectIds || !projectIds.length) return {};
    
    const { data, error } = await supabase
      .from('freelance_orders')
      .select('project_id, created_at')
      .in('project_id', projectIds)
      .eq('is_archived', true);
      
    if (error) throw error;
    
    const res = {};
    projectIds.forEach(id => res[id] = []);
    
    (data || []).forEach(o => {
      res[o.project_id].push(o.created_at.split('T')[0]);
    });
    
    for (const [id, dates] of Object.entries(res)) {
      res[id] = [...new Set(dates)];
    }
    return res;
  },

  // Delete all archived items for a specific date
  async deleteArchivedByDate(projectId, dateStr) {
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;
    
    const { error } = await supabase
      .from('freelance_orders')
      .delete()
      .eq('project_id', projectId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);
    
    if (error) throw error;
  }
,

  // === REAL-TIME SUBSCRIPTIONS ===

  subscribeToProjects(callback) {
    return supabase
      .channel('public:freelance_projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freelance_projects' }, (payload) => {
        callback(payload);
      })
      .subscribe();
  },

  subscribeToOrders(projectId, callback) {
    const filter = projectId ? `project_id=eq.${projectId}` : undefined;
    return supabase
      .channel(`public:freelance_orders:${projectId || 'all'}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'freelance_orders',
        filter: filter
      }, (payload) => {
        callback(payload);
      })
      .subscribe();
  }
};
