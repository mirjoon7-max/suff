import { buildAuthHeader, encodeQuery } from './_coupangAuth.mjs'

const DOMAIN = 'https://api-gateway.coupang.com'

function json(res, status=200){
  return new Response(JSON.stringify(res), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  })
}

export default async function handler(req){
  try{
    if(req.method !== 'POST') return json({ ok:false, error:'POST only' }, 405)
    const accessKey = process.env.COUPANG_ACCESS_KEY
    const secretKey = process.env.COUPANG_SECRET_KEY
    const subId = process.env.COUPANG_SUB_ID || ''
    if(!accessKey || !secretKey) return json({ ok:false, error:'Missing COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY' }, 500)

    const bodyText = await req.text()
    let body
    try { body = JSON.parse(bodyText || '{}') } catch { body = {} }

    const coupangUrl = (body?.coupangUrl || body?.url || '').trim()
    if(!coupangUrl) return json({ ok:false, error:'coupangUrl is required' }, 400)

    // Many examples use /v1/deeplink.
    // subId is commonly passed as query (and sometimes in the payload), so we support both.
    const q = encodeQuery({ ...(subId ? { subId } : {}) })
    const uri = q
      ? `/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink?${q}`
      : `/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink`

    const payload = {
      coupangUrls: [coupangUrl],
      ...(subId ? { subId } : {})
    }

    const authorization = buildAuthHeader({ method:'POST', uri, accessKey, secretKey })
    const resp = await fetch(`${DOMAIN}${uri}`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8'
      },
      body: JSON.stringify(payload)
    })

    const text = await resp.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    if(!resp.ok){
      return json({ ok:false, error:'Coupang API request failed', status: resp.status, raw: data }, 502)
    }

    // Coupang deeplink response shapes vary across docs/examples.
    // Common patterns:
    //  - { data: [ { originalUrl, shortenUrl, landingUrl? } ] }
    //  - { data: { shortenUrlList: [ { shortenUrl } ] } }
    //  - { data: { shortenUrl: "..." } }
    const dataField = data?.data
    const firstFromArray = Array.isArray(dataField) ? dataField[0] : null
    const firstFromList = Array.isArray(dataField?.shortenUrlList) ? dataField.shortenUrlList[0] : null

    const deepLink =
      firstFromArray?.shortenUrl ||
      firstFromArray?.landingUrl ||
      firstFromArray?.coupangUrl ||
      firstFromList?.shortenUrl ||
      dataField?.shortenUrl ||
      dataField?.coupangUrl ||
      null

    if(!deepLink){
      return json({ ok:false, error:'Deeplink not found in response', raw: data }, 502)
    }

    return json({ ok:true, deepLink, raw: data })
  }catch(e){
    return json({ ok:false, error: String(e?.message || e) }, 500)
  }
}
