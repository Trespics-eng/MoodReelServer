import { getSupabase } from '../../config/supabase.js';

const memoryUploads = [];

const UploadedVideoModel = {
  async create(videoData) {
    const supabase = getSupabase();
    if (!supabase) {
      const upload = { id: crypto.randomUUID(), ...videoData, created_at: new Date().toISOString() };
      memoryUploads.push(upload);
      return upload;
    }

    const { data, error } = await supabase
      .from('uploaded_videos')
      .insert(videoData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async findByUser(userId) {
    const supabase = getSupabase();
    if (!supabase) return memoryUploads.filter(u => u.user_id === userId);

    const { data, error } = await supabase
      .from('uploaded_videos')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async findById(videoId) {
    const supabase = getSupabase();
    if (!supabase) return memoryUploads.find(u => u.video_id === videoId) || null;

    const { data, error } = await supabase
      .from('uploaded_videos')
      .select('*')
      .eq('video_id', videoId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data || null;
  },

  async findAll({ page = 1, limit = 20, category = '', status = 'active' } = {}) {
    const supabase = getSupabase();
    if (!supabase) {
      let filtered = memoryUploads.filter(u => u.status !== 'removed');
      if (category) filtered = filtered.filter(u => u.category === category);
      return { videos: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
    }

    const offset = (page - 1) * limit;
    let query = supabase.from('uploaded_videos').select('*', { count: 'exact' });
    
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return { videos: data || [], total: count || 0 };
  },

  async incrementViews(videoId) {
    const supabase = getSupabase();
    if (!supabase) {
      const upload = memoryUploads.find(u => u.video_id === videoId);
      if (upload) upload.views = (upload.views || 0) + 1;
      return;
    }

    const { data } = await supabase
      .from('uploaded_videos')
      .select('views')
      .eq('video_id', videoId)
      .single();

    if (data) {
      await supabase
        .from('uploaded_videos')
        .update({ views: (data.views || 0) + 1 })
        .eq('video_id', videoId);
    }
  },

  async delete(videoId) {
    const supabase = getSupabase();
    if (!supabase) {
      const idx = memoryUploads.findIndex(u => u.video_id === videoId);
      if (idx >= 0) memoryUploads[idx].status = 'removed';
      return true;
    }

    const { error } = await supabase
      .from('uploaded_videos')
      .update({ status: 'removed' })
      .eq('video_id', videoId);

    if (error) throw new Error(error.message);
    return true;
  },

  async update(videoId, updates) {
    const supabase = getSupabase();
    if (!supabase) {
      const idx = memoryUploads.findIndex(u => u.video_id === videoId);
      if (idx >= 0) {
        memoryUploads[idx] = { ...memoryUploads[idx], ...updates, updated_at: new Date().toISOString() };
        return memoryUploads[idx];
      }
      return null;
    }

    const { data, error } = await supabase
      .from('uploaded_videos')
      .update(updates)
      .eq('video_id', videoId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async count() {
    const supabase = getSupabase();
    if (!supabase) return memoryUploads.filter(u => u.status !== 'removed').length;

    const { count, error } = await supabase
      .from('uploaded_videos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (error) throw new Error(error.message);
    return count || 0;
  }
};

export default UploadedVideoModel;
