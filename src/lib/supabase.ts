import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Singleton instance to avoid "Multiple GoTrueClient instances" warning
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase environment variables are missing. Client will not be initialized.");
      return null as unknown as ReturnType<typeof createClient>;
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    })
  }
  return supabaseInstance;
}

// Export a dummy client during build to avoid "supabaseUrl is required" error.
// The actual initialization happens when getSupabase() is called.
const dummyClient = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOtp: async () => ({ data: null, error: null }),
    exchangeCodeForSession: async () => ({ data: null, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          in: () => Promise.resolve({ data: [], error: null })
        })
      })
    })
  })
} as any;

export const supabase = typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey 
  ? getSupabase() 
  : dummyClient;
