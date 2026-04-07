import { getSupabase } from '../../config/supabase.js';

const memorySettings = [];

const defaultSettings = {
  theme: 'dark',
  language: 'en',
  default_pixel: '720',
  notifications_enabled: true,
  autoplay: true
};

const UserSettingsModel = {
  async findByUser(userId) {
    const supabase = getSupabase();
    if (!supabase) {
      return memorySettings.find(s => s.user_id === userId) || { ...defaultSettings, user_id: userId };
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No settings found, create defaults
      return await UserSettingsModel.create(userId, defaultSettings);
    }
    if (error) throw new Error(error.message);
    return data;
  },

  async create(userId, settings = {}) {
    const supabase = getSupabase();
    const merged = { ...defaultSettings, ...settings, user_id: userId };
    
    if (!supabase) {
      memorySettings.push(merged);
      return merged;
    }

    const { data, error } = await supabase
      .from('user_settings')
      .insert(merged)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async update(userId, updates) {
    const supabase = getSupabase();
    if (!supabase) {
      const idx = memorySettings.findIndex(s => s.user_id === userId);
      if (idx >= 0) Object.assign(memorySettings[idx], updates);
      else memorySettings.push({ ...defaultSettings, ...updates, user_id: userId });
      return memorySettings.find(s => s.user_id === userId);
    }

    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
};

export default UserSettingsModel;
