// Lazily-constructed Supabase client — the ONLY module that reads the
// Supabase env vars. Import-time safe: createClient() only runs if both vars
// are present, so building/running with no env vars never touches the
// network and never throws.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export function isBackendEnabled(): boolean {
  return url.trim().length > 0 && anonKey.trim().length > 0;
}

export const supabase: SupabaseClient | null = isBackendEnabled()
  ? createClient(url, anonKey)
  : null;

/** Same client as `supabase`, narrowed to non-null. Throws if the backend isn't configured. */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase backend is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  }
  return supabase;
}
