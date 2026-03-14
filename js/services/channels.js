// ===========================
// NEXT TASK — Channels + Videos Service
// ===========================

import { supabase } from './supabase.js';

export const ChannelsService = {

  // === CHANNELS ===

  async getChannels(section = 'automation') {
    const { data, error } = await supabase
      .from('yt_channels')
      .select('*, creator:profiles!yt_channels_created_by_fkey(full_name)')
      .eq('section', section)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getChannel(id) {
    const { data, error } = await supabase
      .from('yt_channels')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createChannel(channel) {
    const { data, error } = await supabase
      .from('yt_channels')
      .insert(channel)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateChannel(id, updates) {
    const { data, error } = await supabase
      .from('yt_channels')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteChannel(id) {
    const { error } = await supabase.from('yt_channels').delete().eq('id', id);
    if (error) throw error;
  },

  // === VIDEOS ===

  async getVideos(channelId, { status, search } = {}) {
    let query = supabase
      .from('yt_videos')
      .select('*, assigned_profile:profiles!yt_videos_assigned_to_fkey(full_name, role), creator:profiles!yt_videos_created_by_fkey(full_name)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createVideo(video) {
    const { data, error } = await supabase
      .from('yt_videos')
      .insert(video)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateVideo(id, updates) {
    const { data, error } = await supabase
      .from('yt_videos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteVideo(id) {
    const { error } = await supabase.from('yt_videos').delete().eq('id', id);
    if (error) throw error;
  },

  // Get video count per channel
  async getChannelVideoCount(channelId) {
    const { count, error } = await supabase
      .from('yt_videos')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId);
    if (error) return 0;
    return count || 0;
  },

  // Get all video stats across all channels for a specific section
  async getAllVideoStats(section = 'automation') {
    const { data, error } = await supabase
      .from('yt_videos')
      .select('status, yt_channels!inner(section)')
      .eq('yt_channels.section', section);

    if (error) throw error;
    const stats = { total: 0, draft: 0, scripting: 0, recording: 0, editing: 0, uploaded: 0, published: 0 };
    (data || []).forEach(v => {
      stats.total++;
      if (stats[v.status] !== undefined) stats[v.status]++;
    });
    return stats;
  }
};
