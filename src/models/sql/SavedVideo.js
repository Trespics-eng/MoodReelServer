import { getSupabase } from '../../config/supabase.js';

const memorySaved = [];

const SavedVideoModel = {
  async save(userId, videoId, platform = 'youtube') {
    const supabase = getSupabase();
    if (!supabase) {
      const existing = memorySaved.find(s => s.user_id === userId && s.video_id === videoId);
      if (!existing) {
        memorySaved.push({ id: crypto.randomUUID(), user_id: userId, video_id: videoId, platform, saved_at: new Date().toISOString() });
      }
      return true;
    }

    const { error } = await supabase
      .from('saved_videos')
      .upsert({ user_id: userId, video_id: videoId, platform }, { onConflict: 'user_id,video_id' });

    if (error) throw new Error(error.message);
    return true;
  },

  async unsave(userId, videoId) {
    const supabase = getSupabase();
    if (!supabase) {
      const idx = memorySaved.findIndex(s => s.user_id === userId && s.video_id === videoId);
      if (idx >= 0) memorySaved.splice(idx, 1);
      return true;
    }

    const { error } = await supabase
      .from('saved_videos')
      .delete()
      .eq('user_id', userId)
      .eq('video_id', videoId);

    if (error) throw new Error(error.message);
    return true;
  },

  async findByUser(userId) {
    const supabase = getSupabase();
    if (!supabase) return memorySaved.filter(s => s.user_id === userId);

    const { data, error } = await supabase
      .from('saved_videos')
      .select('*')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async isSaved(userId, videoId) {
    const supabase = getSupabase();
    if (!supabase) return !!memorySaved.find(s => s.user_id === userId && s.video_id === videoId);

    const { data, error } = await supabase
      .from('saved_videos')
      .select('id')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return !!data;
  }
};

export default SavedVideoModel;
