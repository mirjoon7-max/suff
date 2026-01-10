import { createClient } from '@supabase/supabase-js'

// IMPORTANT: Do NOT hardcode secrets in the frontend.
// These values must be provided via environment variables.
// - Local: .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
// - Netlify: Environment variables

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = (url && anonKey)
  ? createClient(url, anonKey)
  : null
