import { getSupabase } from '../../config/supabase.js';

const CharacterModel = {
  // Fetch all characters including presets (is_public=true) and user-created characters
  async findAll({ page = 1, limit = 50, search = '', includeUsers = true }) {
    const supabase = getSupabase();
    if (!supabase) return { characters: [], total: 0 };

    let query = supabase.from('characters').select('*, users(username)', { count: 'exact' });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // For admin, fetch everything.
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);

    return {
      characters: data,
      total: count,
      page,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  async findById(id) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async create(charData) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('characters')
      .insert([charData])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, updates) {
    const supabase = getSupabase();
    if (!supabase) return null;

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('characters')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }
};

export default CharacterModel;
