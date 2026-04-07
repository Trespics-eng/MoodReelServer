import { getSupabase } from '../../config/supabase.js';

const CreationProgressModel = {
  async save({ userId, type, title, data, step, status = 'in_progress' }) {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, creation progress not saved');
      return null;
    }

    const { data: existing } = await supabase
      .from('creation_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .single();

    if (existing) {
      const { data: updated, error } = await supabase
        .from('creation_progress')
        .update({
          type,
          title,
          data,
          step,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('creation_progress')
        .insert({
          user_id: userId,
          type,
          title,
          data,
          step,
          status
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return inserted;
    }
  },

  async findLatestByUserId(userId) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('creation_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data || null;
  },

  async delete(id) {
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase.from('creation_progress').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
};

export default CreationProgressModel;
