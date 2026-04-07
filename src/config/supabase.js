import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabase = null;

const initSupabase = () => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || (!serviceKey && !anonKey)) {
    console.log('⚠️  Supabase not configured — using in-memory fallbacks');
    return null;
  }

  try {
    // Use service key for server-side operations (bypasses RLS)
    supabase = createClient(url, serviceKey || anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase client initialized (DB + Storage)');
    return supabase;
  } catch (error) {
    console.error('❌ Supabase initialization error:', error.message);
    return null;
  }
};

const getSupabase = () => supabase;

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'videos';

export { initSupabase, getSupabase, BUCKET_NAME };
export default initSupabase;
