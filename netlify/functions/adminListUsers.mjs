import { createClient } from '@supabase/supabase-js'

function json(status, obj){
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    }
  })
}

export default async function handler(req){
  try{
    // Only allow GET
    if((req.method || 'GET').toUpperCase() !== 'GET'){
      return json(405, { ok:false, error:'Method not allowed' })
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim()

    if(!SUPABASE_URL) return json(500, { ok:false, error:'Missing SUPABASE_URL (or VITE_SUPABASE_URL)' })
    if(!SERVICE_ROLE) return json(500, { ok:false, error:'Missing SUPABASE_SERVICE_ROLE_KEY' })
    if(!ADMIN_EMAIL) return json(500, { ok:false, error:'Missing ADMIN_EMAIL' })

    // Verify caller JWT + email via Supabase
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if(!token){
      return json(401, { ok:false, error:'Missing Authorization Bearer token' })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession:false, autoRefreshToken:false }
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if(userErr || !userData?.user){
      return json(401, { ok:false, error:'Invalid token' })
    }

    const callerEmail = (userData.user.email || '').toLowerCase()
    if(callerEmail !== ADMIN_EMAIL){
      return json(403, { ok:false, error:'Forbidden' })
    }

    const url = new URL(req.url)
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)))
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))

    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: limit,
    })

    if(error){
      return json(500, { ok:false, error: String(error.message || error) })
    }

    const users = (data?.users || []).map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at || u.confirmed_at || null,
      app_metadata: u.app_metadata,
      user_metadata: u.user_metadata,
    }))

    return json(200, { ok:true, page, limit, total: data?.total ?? null, users })
  }catch(e){
    return json(500, { ok:false, error: String(e?.message || e) })
  }
}
