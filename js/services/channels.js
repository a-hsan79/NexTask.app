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

  async getVideos(channelId, { status, search, unassigned, section } = {}) {
    let query = supabase
      .from('yt_videos')
      .select('*, assigned_profile:profiles!yt_videos_assigned_to_fkey(full_name, role), creator:profiles!yt_videos_created_by_fkey(full_name), yt_channels!inner(name, section)')
      .order('created_at', { ascending: false });

    if (channelId) query = query.eq('channel_id', channelId);
    if (section) query = query.eq('yt_channels.section', section);
    if (status && status !== 'all') query = query.eq('status', status);
    if (unassigned) query = query.is('assigned_to', null);
    else if (unassigned === false) query = query.not('assigned_to', 'is', null);
    
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

  // Get video count and completion status per channel
  async getChannelVideoCount(channelId) {
    const { data, error } = await supabase
      .from('yt_videos')
      .select('status')
      .eq('channel_id', channelId);
    
    if (error) return { total: 0, done: 0, uploaded: 0 };
    
    const total = data.length;
    const done = data.filter(v => v.status === 'published' || v.status === 'done').length;
    const uploaded = data.filter(v => v.status === 'uploaded').length;
    
    return { total, done, uploaded };
  },

  // Get all video stats across all channels for a specific section
  async getAllVideoStats(section = 'automation') {
    const { data, error } = await supabase
      .from('yt_videos')
      .select('status, assigned_to, yt_channels!inner(section)')
      .eq('yt_channels.section', section);

    if (error) throw error;
    const stats = { 
      total: 0, 
      unassigned: 0, 
      assigned: 0, 
      done: 0,
      draft: 0, scripting: 0, recording: 0, editing: 0, uploaded: 0, published: 0 
    };
    
    (data || []).forEach(v => {
      stats.total++;
      
      // Track specific statuses (Published is tracked separately from summary Done)
      if (v.status === 'draft') stats.draft++;
      else if (v.status === 'scripting') stats.scripting++;
      else if (v.status === 'recording') stats.recording++;
      else if (v.status === 'editing') stats.editing++;
      else if (v.status === 'uploaded') stats.uploaded++;
      else if (v.status === 'published') stats.published++;
      
      // Assignment stats
      if (!v.assigned_to) {
        stats.unassigned++;
      } else {
        // Only count as 'assigned' if it's NOT in a finished or pending-publish state
        if (v.status !== 'published' && v.status !== 'done' && v.status !== 'uploaded') {
          stats.assigned++;
        }
      }
      
      // Summary 'Done' (Published OR explicit Done status)
      if (v.status === 'published' || v.status === 'done') {
        stats.done++;
      }
    });
    return stats;
  },

  // === REAL-TIME SUBSCRIPTIONS ===

  subscribeToChannels(callback) {
    return supabase
      .channel('public:yt_channels')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yt_channels' }, (payload) => {
        callback(payload);
      })
      .subscribe();
  },

  subscribeToVideos(channelId, callback) {
    const filter = channelId ? `channel_id=eq.${channelId}` : undefined;
    return supabase
      .channel(`public:yt_videos:${channelId || 'all'}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'yt_videos',
        filter: filter
      }, (payload) => {
        callback(payload);
      })
      .subscribe();
  }
};
