import { createClient } from '@supabase/supabase-js'
import { HAS_SUPABASE_CONFIG, SUPABASE_URL, SUPABASE_ANON } from './constants'

if (!HAS_SUPABASE_CONFIG) {
  console.warn('Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON before deploy.')
}

const safeUrl = SUPABASE_URL || 'https://placeholder.supabase.co'
const safeAnon = SUPABASE_ANON || 'placeholder-anon-key'

export const db = createClient(safeUrl, safeAnon, {
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
