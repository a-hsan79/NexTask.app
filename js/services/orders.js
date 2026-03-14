// ===========================
// NEXT TASK — Orders CRUD Service
// ===========================

import { supabase } from './supabase.js';

export const OrdersService = {

  // Fetch all orders
  async getOrders({ status, platform, assignedTo, search, limit = 50 } = {}) {
    let query = supabase
      .from('orders')
      .select('*, assigned_profile:profiles!orders_assigned_to_fkey(full_name, role), creator:profiles!orders_created_by_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') query = query.eq('status', status);
    if (platform && platform !== 'all') query = query.eq('platform', platform);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get single order
  async getOrder(id) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, assigned_profile:profiles!orders_assigned_to_fkey(full_name, role), creator:profiles!orders_created_by_fkey(full_name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Create new order
  async createOrder(order) {
    const { data, error } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update order
  async updateOrder(id, updates) {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Delete order
  async deleteOrder(id) {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Get order stats
  async getOrderStats() {
    const { data, error } = await supabase.from('orders').select('status, platform, amount');
    if (error) throw error;

    const stats = {
      total: 0, new: 0, in_progress: 0, delivered: 0, completed: 0, cancelled: 0,
      fiverr: 0, upwork: 0, direct: 0,
      totalRevenue: 0
    };
    (data || []).forEach(o => {
      stats.total++;
      if (stats[o.status] !== undefined) stats[o.status]++;
      if (stats[o.platform] !== undefined) stats[o.platform]++;
      if (o.status !== 'cancelled') stats.totalRevenue += (o.amount || 0);
    });
    return stats;
  }
};
