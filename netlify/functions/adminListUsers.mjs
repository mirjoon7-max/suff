import { createClient } from '@supabase/supabase-js'

export async function handler(event){
  try{
    if(event.httpMethod !== 'GET'){
      return json(405, { ok: false, error: 'Method not allowed' })
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '').toLowerCase()

    if(!SUPABASE_URL) return json(500, { ok: false, error: 'Missing SUPABASE_URL' })
    if(!SERVICE_ROLE) return json(500, { ok: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY' })

    const auth = event.headers.authorization || event.headers.Authorization || ''
    if(!auth.startsWith('Bearer ')){
      return json(401, { ok: false, error: 'Missing Authorization Bearer token' })
    }
    const token = auth.slice('Bearer '.length).trim()

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // Verify caller
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if(userErr || !userData?.user){
      return json(401, { ok: false, error: 'Invalid session token' })
    }

    const callerEmail = (userData.user.email || '').toLowerCase()
    if(ADMIN_EMAIL && callerEmail !== ADMIN_EMAIL){
      return json(403, { ok: false, error: 'Not authorized' })
    }

    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if(error) throw error

    const users = (data?.users || []).map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      phone: u.phone
    }))

    return json(200, { ok: true, users })
  }catch(e){
    return json(500, { ok: false, error: e?.message || 'Server error' })
  }
}

function json(statusCode, obj){
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    },
    body: JSON.stringify(obj)
  }
}
