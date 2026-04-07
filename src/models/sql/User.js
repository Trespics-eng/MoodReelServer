import { getSupabase } from '../../config/supabase.js';

// ─── In-memory fallback for when Supabase is not configured ────
const memoryUsers = [];

const UserModel = {
  // Create a new user
  async create({ email, passwordHash, username, profilePic = '', role = 'user' }) {
    const supabase = getSupabase();
    if (!supabase) {
      const user = {
        id: crypto.randomUUID(),
        email, password_hash: passwordHash, username,
        profile_pic: profilePic, role: role || 'user', is_active: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };
      memoryUsers.push(user);
      return user;
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        username,
        profile_pic: profilePic,
        role: role || 'user'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Find user by email
  async findByEmail(email) {
    const supabase = getSupabase();
    if (!supabase) return memoryUsers.find(u => u.email === email) || null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data || null;
  },

  // Find user by ID
  async findById(id) {
    const supabase = getSupabase();
    if (!supabase) return memoryUsers.find(u => u.id === id) || null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data || null;
  },

  // Find user by username
  async findByUsername(username) {
    const supabase = getSupabase();
    if (!supabase) return memoryUsers.find(u => u.username === username) || null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data || null;
  },

  // Update user profile
  async update(id, updates) {
    const supabase = getSupabase();
    if (!supabase) {
      const idx = memoryUsers.findIndex(u => u.id === id);
      if (idx >= 0) Object.assign(memoryUsers[idx], updates);
      return memoryUsers[idx] || null;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Get all users (admin) with pagination
  async findAll({ page = 1, limit = 20, search = '' } = {}) {
    const supabase = getSupabase();
    if (!supabase) {
      let filtered = memoryUsers;
      if (search) filtered = filtered.filter(u => 
        u.username.includes(search) || u.email.includes(search)
      );
      return { users: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
    }

    const offset = (page - 1) * limit;
    let query = supabase.from('users').select('*', { count: 'exact' });
    
    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return { users: data || [], total: count || 0 };
  },

  // Delete user
  async delete(id) {
    const supabase = getSupabase();
    if (!supabase) {
      const idx = memoryUsers.findIndex(u => u.id === id);
      if (idx >= 0) memoryUsers.splice(idx, 1);
      return true;
    }

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  // Count total users
  async count() {
    const supabase = getSupabase();
    if (!supabase) return memoryUsers.length;

    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) throw new Error(error.message);
    return count || 0;
  }
};

export default UserModel;
