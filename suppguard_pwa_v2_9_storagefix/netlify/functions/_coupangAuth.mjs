import crypto from 'crypto'

function pad2(n){
  return String(n).padStart(2,'0')
}

// Coupang HMAC signed-date format used in most examples: yyMMdd'T'HHmmss'Z'
// We generate it in UTC to avoid "signature expired" issues.
export function signedDateUTC(){
  const d = new Date()
  const yy = String(d.getUTCFullYear()).slice(2)
  const MM = pad2(d.getUTCMonth()+1)
  const DD = pad2(d.getUTCDate())
  const hh = pad2(d.getUTCHours())
  const mm = pad2(d.getUTCMinutes())
  const ss = pad2(d.getUTCSeconds())
  return `${yy}${MM}${DD}T${hh}${mm}${ss}Z`
}

export function buildAuthHeader({ method, uri, accessKey, secretKey }){
  // uri example: "/v2/.../products/search?keyword=%EB%B9%84%ED%83%80%EB%AF%BC&limit=10&subId=..."
  const [path, query = ""] = uri.split('?')
  const signedDate = signedDateUTC()
  const message = signedDate + method.toUpperCase() + path + query
  const signature = crypto.createHmac('sha256', secretKey).update(message, 'utf8').digest('hex')

  // Common authorization header format shown in Partner/OpenAPI examples.
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`
}

// Encode query values with encodeURIComponent (space => %20), not URLSearchParams (space => +)
export function encodeQuery(params){
  return Object.entries(params)
    .filter(([,v]) => v !== undefined && v !== null && v !== '')
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
}
