// ===========================
// NEXT TASK — Expenses CRUD Service
// ===========================

import { supabase } from './supabase.js';

export const ExpensesService = {

  // Fetch expenses
  async getExpenses({ category, month, year, timeFilter = 'current_month', limit = 100 } = {}) {
    let query = supabase
      .from('expenses')
      .select('*, paid_profile:profiles!expenses_paid_by_fkey(full_name), creator:profiles!expenses_created_by_fkey(full_name)')
      .order('date', { ascending: false })
      .limit(limit);

    if (category && category !== 'all') query = query.eq('category', category);

    if (month !== undefined && year !== undefined) {
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      query = query.gte('date', startDate).lte('date', endDate);
    } else {
      // Auto-archival mechanism: only fetch this month by default, or older if 'history'
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      
      if (timeFilter === 'current_month') {
        query = query.gte('date', firstDayOfMonth);
      } else if (timeFilter === 'history') {
        query = query.lt('date', firstDayOfMonth);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Create expense
  async createExpense(expense) {
    const { data, error } = await supabase
      .from('expenses')
      .insert(expense)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update expense
  async updateExpense(id, updates) {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Delete expense
  async deleteExpense(id) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Get expense stats for current month
  async getMonthlyStats() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('expenses')
      .select('amount, category, currency')
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    const stats = { total: 0, team: 0, office: 0, software: 0, equipment: 0, other: 0, count: 0 };
    (data || []).forEach(e => {
      stats.total += (e.amount || 0);
      stats.count++;
      if (stats[e.category] !== undefined) stats[e.category] += (e.amount || 0);
    });
    return stats;
  }
};
