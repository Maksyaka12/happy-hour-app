import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON } from './constants'

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn('Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON before deploy.')
}

export const db = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
})
