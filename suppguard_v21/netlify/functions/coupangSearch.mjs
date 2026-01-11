import { buildAuthHeader, encodeQuery } from './_coupangAuth.mjs'

const DOMAIN = 'https://api-gateway.coupang.com'

function json(res, status=200){
  return new Response(JSON.stringify(res), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  })
}

function normalizeProducts(apiJson){
  const data = apiJson?.data
  const list = data?.productData || data?.products || data?.productList || []
  if(!Array.isArray(list)) return []
  return list.map(p => ({
    productId: p.productId ?? p.id,
    productName: p.productName ?? p.name,
    productImage: p.productImage ?? p.image ?? p.productImageUrl,
    productPrice: p.productPrice ?? p.price,
    productUrl: p.productUrl ?? p.productLink ?? p.productUrlMobile ?? p.url,
    isRocket: p.isRocket ?? p.rocket,
    reviewCount: p.reviewCount,
    rating: p.rating
  })).filter(x => x.productName && x.productUrl)
}

export default async function handler(req){
  try{
    const url = new URL(req.url)
    const keyword = (url.searchParams.get('keyword') || '').trim()
    const limit = Number(url.searchParams.get('limit') || 10)
    if(!keyword) return json({ ok:false, error:'keyword is required' }, 400)
    const accessKey = process.env.COUPANG_ACCESS_KEY
    const secretKey = process.env.COUPANG_SECRET_KEY
    const subId = process.env.COUPANG_SUB_ID || url.searchParams.get('subId') || ''
    if(!accessKey || !secretKey) return json({ ok:false, error:'Missing COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY' }, 500)

    const safeLimit = Math.min(Math.max(limit, 1), 20)
    const q = encodeQuery({ keyword, limit: safeLimit, ...(subId ? { subId } : {}) })

    // Different docs/posts show both endpoints (with/without /v1). We'll try v1 first then fallback.
    const candidates = [
      `/v2/providers/affiliate_open_api/apis/openapi/v1/products/search?${q}`,
      `/v2/providers/affiliate_open_api/apis/openapi/products/search?${q}`
    ]

    let lastErr = null
    for(const uri of candidates){
      const authorization = buildAuthHeader({ method:'GET', uri, accessKey, secretKey })
      const resp = await fetch(`${DOMAIN}${uri}`, {
        method: 'GET',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json;charset=UTF-8'
        }
      })
      const text = await resp.text()
      let data
      try { data = JSON.parse(text) } catch { data = { raw: text } }
      if(resp.ok){
        return json({ ok:true, products: normalizeProducts(data), raw: data })
      }
      lastErr = { status: resp.status, data }
    }

    return json({ ok:false, error:'Coupang API request failed', detail: lastErr }, 502)
  }catch(e){
    return json({ ok:false, error: String(e?.message || e) }, 500)
  }
}
