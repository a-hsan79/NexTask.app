// ===========================
// NEXT TASK — Freelance Projects + Orders Service
// ===========================

import { supabase } from './supabase.js';

export const ProjectsService = {

  // === PROJECTS ===

  async getProjects({ platform, search, userProfile = null } = {}) {
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

  async getOrders(projectId, { status, search, unassigned } = {}) {
    let query = supabase
      .from('freelance_orders')
      .select('*, assigned_profile:profiles!freelance_orders_assigned_to_fkey(full_name, role), creator:profiles!freelance_orders_created_by_fkey(full_name), freelance_projects!inner(name)')
      .order('created_at', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);
    if (status && status !== 'all') query = query.eq('status', status);
    if (unassigned) query = query.is('assigned_to', null);
    else if (unassigned === false) query = query.not('assigned_to', 'is', null);

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

  // Get order count and completion status per project
  async getProjectOrderCount(projectId) {
    const { data, error } = await supabase
      .from('freelance_orders')
      .select('status')
      .eq('project_id', projectId);
    
    if (error) return { total: 0, done: 0 };
    
    const total = data.length;
    const done = data.filter(o => o.status === 'completed' || o.status === 'done').length;
    
    return { total, done };
  },

  // Get all order stats
  async getAllOrderStats(userProfile = null) {
    const { data, error } = await supabase
      .from('freelance_orders')
      .select('status, amount, assigned_to, created_by, freelance_projects!inner(is_public)');
      
    if (error) throw error;

    const role = userProfile?.role;
    const isPowerUser = ['owner', 'admin', 'manager'].includes(role);

    const stats = { 
      total: 0, unassigned: 0, assigned: 0, done: 0,
      new: 0, in_progress: 0, delivered: 0, completed: 0, revision: 0, cancelled: 0, totalRevenue: 0 
    };
    
    (data || []).forEach(o => {
      // Visibility Check: Power users see all. Others see Public OR assigned.
      if (!isPowerUser && userProfile) {
        const canSee = o.freelance_projects?.is_public === true || 
                       o.assigned_to === userProfile.id || 
                       o.created_by === userProfile.id;
        if (!canSee) return;
      }

      stats.total++;
      if (stats[o.status] !== undefined && o.status !== 'done') stats[o.status]++;
      if (o.status !== 'cancelled') stats.totalRevenue += (o.amount || 0);
      
      if (!o.assigned_to) stats.unassigned++;
      else if (o.status !== 'completed' && o.status !== 'done' && o.status !== 'cancelled') stats.assigned++;
      
      if (o.status === 'completed' || o.status === 'done') stats.done++;
    });
    return stats;
  },

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
