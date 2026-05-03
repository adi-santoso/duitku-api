import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let supabase: SupabaseClient;

/**
 * Get Supabase client with service_role key (bypasses RLS)
 */
export function getDb(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}
