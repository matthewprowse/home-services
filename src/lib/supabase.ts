import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Singleton instance to avoid "Multiple GoTrueClient instances" warning
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance;
}

// For convenience, but getSupabase() is safer for singleton pattern
export const supabase = getSupabase();
