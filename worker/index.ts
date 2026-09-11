interface Env {
  ASSETS: Fetcher
  DB: D1Database
  EMAIL: { send(message: { to: string; from: string; subject: string; html: string; text: string }): Promise<unknown> }
  AI: { run(model: string, input: unknown): Promise<{ response?: string }> }
  OPENAI_API_KEY?: string
  TEAM_DOMAIN: string
  POLICY_AUD: string
  ADMIN_EMAIL: string
}

type Rate = { date: string; mdlPerEur: number; source: 'BNM'; fetchedAt: string }
const rateCache = new Map<string, { value: Rate; expires: number }>()

function todayInMoldova() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Chisinau', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}
function parseBNM(xml: string, requested: string): Rate {
  if (xml.length > 200000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Invalid BNM response')
  const date = xml.match(/<ValCurs\b[^>]*\bDate=["'](\d{2}\.\d{2}\.\d{4})["']/)?.[1]?.split('.').reverse().join('-')
  const euro = [...xml.matchAll(/<Valute\b[^>]*>([\s\S]*?)<\/Valute>/g)].map(match => match[1]).filter(row => /<CharCode>\s*EUR\s*<\/CharCode>/.test(row))
  const read = (row: string, tag: string) => Number(row.match(new RegExp(`<${tag}>\\s*([0-9]+(?:[.,][0-9]+)?)\\s*</${tag}>`))?.[1]?.replace(',', '.'))
  const nominal = euro.length === 1 ? read(euro[0], 'Nominal') : NaN
  const value = euro.length === 1 ? read(euro[0], 'Value') / nominal : NaN
  if (date !== requested || !Number.isFinite(value) || value <= 0) throw new Error('Invalid BNM EUR rate')
  return { date, mdlPerEur: value, source: 'BNM', fetchedAt: new Date().toISOString() }
}
async function exchange(request: Request) {
  const date = new URL(request.url).searchParams.get('date') ?? todayInMoldova()
  if (!validDate(date) || date < '2000-01-01' || date > todayInMoldova()) return Response.json({ error: 'Alege o dată validă.' }, { status: 400 })
  const cached = rateCache.get(date)
  if (cached && cached.expires > Date.now()) return Response.json(cached.value, { headers: { 'Cache-Control': 'public, max-age=3600' } })
  try {
    const upstream = new URL('https://www.bnm.md/ro/official_exchange_rates')
    upstream.searchParams.set('get_xml', '1')
    upstream.searchParams.set('date', date.split('-').reverse().join('.'))
    const response = await fetch(upstream, { headers: { Accept: 'application/xml,text/xml' } })
    if (!response.ok) throw new Error('BNM unavailable')
    const value = parseBNM(await response.text(), date)
    rateCache.set(date, { value, expires: Date.now() + 3600000 })
    return Response.json(value, { headers: { 'Cache-Control': 'public, max-age=3600' } })
  } catch { return Response.json({ error: 'Cursul BNM nu este disponibil acum.' }, { status: 503 }) }
}

const encoder = new TextEncoder()
async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
function randomId(bytes = 24) {
  const value = new Uint8Array(bytes); crypto.getRandomValues(value)
  return [...value].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
function cookieValue(request: Request, name: string) {
  return request.headers.get('Cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1)
}
async function identity(request: Request, env: Env) {
  const session = cookieValue(request, 'pilot_session')
  if (!session) return null
  const row = await env.DB.prepare(`SELECT users.email, users.role FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ? AND sessions.expires_at > datetime('now')`).bind(session).first<{ email: string; role: string }>()
  return row ? { email: row.email, role: row.role } : null
}
async function requestCode(request: Request, env: Env) {
  const body = await request.json().catch(() => null) as { email?: string } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email || email !== env.ADMIN_EMAIL.toLowerCase()) return Response.json({ error: 'Această adresă nu are acces.' }, { status: 403 })
  const recent = await env.DB.prepare(`SELECT created_at FROM auth_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1`).bind(email).first<{ created_at: string }>()
  if (recent && Date.now() - Date.parse(`${recent.created_at}Z`) < 60_000) return Response.json({ error: 'Așteaptă un minut înainte de a cere un cod nou.' }, { status: 429 })
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const id = randomId()
  const expires = new Date(Date.now() + 10 * 60_000).toISOString()
  await env.DB.prepare(`INSERT INTO auth_codes (id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)`).bind(id, email, await hash(`${id}:${code}`), expires).run()
  await env.EMAIL.send({ to: email, from: `login@pilot-ledger.download`, subject: 'Codul tău Pilot Ledger', text: `Codul tău Pilot Ledger este ${code}. Expiră în 10 minute.`, html: `<p>Codul tău Pilot Ledger este:</p><h2>${code}</h2><p>Expiră în 10 minute.</p>` })
  return Response.json({ sent: true })
}
async function verifyCode(request: Request, env: Env) {
  const body = await request.json().catch(() => null) as { email?: string; code?: string } | null
  const email = body?.email?.trim().toLowerCase(); const code = body?.code?.trim()
  if (!email || email !== env.ADMIN_EMAIL.toLowerCase() || !/^\d{6}$/.test(code ?? '')) return Response.json({ error: 'Cod invalid.' }, { status: 400 })
  const row = await env.DB.prepare(`SELECT id, code_hash FROM auth_codes WHERE email = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`).bind(email, new Date().toISOString()).first<{ id: string; code_hash: string }>()
  if (!row || await hash(`${row.id}:${code}`) !== row.code_hash) return Response.json({ error: 'Cod invalid sau expirat.' }, { status: 401 })
  const userId = randomId(16); const sessionId = randomId(); const expires = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString()
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO users (id, email, display_name, role) VALUES (?, ?, ?, 'admin') ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name`).bind(userId, email, 'Dumitru'),
    env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) SELECT ?, id, ? FROM users WHERE email = ?`).bind(sessionId, expires, email),
    env.DB.prepare(`UPDATE auth_codes SET consumed_at = datetime('now') WHERE id = ?`).bind(row.id),
  ])
  return new Response(JSON.stringify({ user: { email, role: 'admin' } }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': `pilot_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` } })
}
async function logout(request: Request, env: Env) {
  const session = cookieValue(request, 'pilot_session'); if (session) await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(session).run()
  return new Response(null, { status: 204, headers: { 'Set-Cookie': 'pilot_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' } })
}
async function parseReceipt(request: Request, env: Env) {
  const user = await identity(request, env); if (!user) return Response.json({ error: 'Autentificare necesară.' }, { status: 401 })
  const form = await request.formData().catch(() => null); const file = form?.get('file')
  if (!(file instanceof File) || (!file.type.startsWith('image/') && file.type !== 'application/pdf')) return Response.json({ error: 'Încarcă o fotografie, un screenshot sau un PDF al bonului.' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: 'Imaginea trebuie să fie mai mică de 5 MB.' }, { status: 413 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (env.OPENAI_API_KEY) {
    let encodedBinary = ''; for (const byte of bytes) encodedBinary += String.fromCharCode(byte)
    const encoded = `data:${file.type || 'application/octet-stream'};base64,${btoa(encodedBinary)}`
    const content = file.type === 'application/pdf'
      ? [{ type: 'input_text', text: 'Extrage datele de pe acest bon fiscal.' }, { type: 'input_file', filename: file.name, file_data: encoded }]
      : [{ type: 'input_text', text: 'Extrage datele de pe acest bon fiscal.' }, { type: 'input_image', image_url: encoded, detail: 'high' }]
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4.1', input: [{ role: 'system', content: [{ type: 'input_text', text: 'Răspunde la întrebarea: „Ce sumă am achitat în acest bon fiscal, cui i-am achitat, când i-am achitat și din ce domeniu este afacerea?”. Analizează fotografia ca un specialist în bonuri fiscale din Moldova și citește fiecare rând vizibil. Pentru amount returnează textul exact al valorii finale de plată de lângă TOTAL, SUMA, TOTAL DE PLATĂ, ACHITAT, ИТОГО sau ОПЛАЧЕНО, inclusiv virgulă și spații; nu folosi subtotalul, TVA-ul, restul sau numărul bonului. Pentru date caută DATA, DATE, ДАТА și convertește în YYYY-MM-DD. title este comerciantul, business_type este domeniul afacerii, iar category este una dintre Alimentație, Transport, Locuință, Business, Sănătate, Divertisment sau Altele. currency este MDL dacă apare lei, MDL sau L; EUR doar dacă apare euro/EUR. Returnează exclusiv JSON și null doar dacă valoarea chiar nu este lizibilă. Nu ghici.' }] }, { role: 'user', content }], text: { format: { type: 'json_schema', name: 'receipt', strict: true, schema: { type: 'object', properties: { title: { type: ['string', 'null'] }, business_type: { type: ['string', 'null'] }, category: { type: ['string', 'null'] }, amount: { type: ['string', 'null'] }, currency: { type: ['string', 'null'], enum: ['MDL', 'EUR', null] }, date: { type: ['string', 'null'] } }, required: ['title', 'business_type', 'category', 'amount', 'currency', 'date'], additionalProperties: false } } } }) })
    const result = await response.json().catch(() => null) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> } | null
    const raw = result?.output_text ?? result?.output?.flatMap(item => item.content ?? []).map(item => item.text ?? '').join('') ?? ''
    if (!response.ok || !raw) return Response.json({ error: 'OpenAI nu a putut analiza bonul. Încearcă o fotografie mai clară.' }, { status: 502 })
    try { const data = JSON.parse(raw) as Record<string, unknown>; const amountText = typeof data.amount === 'string' ? data.amount : ''; const normalized = amountText.replace(/[^0-9,.]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'); const amount = normalized && Number.isFinite(Number(normalized)) ? Number(normalized) : null; return Response.json({ extracted: { title: typeof data.title === 'string' ? data.title : '', businessType: typeof data.business_type === 'string' ? data.business_type : '', category: typeof data.category === 'string' ? data.category : 'Altele', amount, currency: data.currency === 'EUR' ? 'EUR' : 'MDL', date: typeof data.date === 'string' ? data.date : '' } }) } catch { return Response.json({ error: 'Răspunsul OCR nu a putut fi interpretat.' }, { status: 422 }) }
  }
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
  const image = `data:${file.type};base64,${btoa(binary)}`
  const result = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', { image, messages: [
    { role: 'system', content: 'Ești un extractor de date din bonuri moldovenești. Răspunde doar cu JSON valid, fără markdown, cu cheile title, category, amount, currency, date. amount este număr pozitiv, currency este MDL sau EUR, date este YYYY-MM-DD. Dacă un câmp nu este lizibil, folosește null.' },
    { role: 'user', content: 'Extrage datele de pe acest bon fiscal.' },
  ], max_tokens: 300 })
  const raw = result?.response ?? ''; let data: Record<string, unknown> = {}
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim()
    data = JSON.parse(cleaned)
  } catch {
    try { const match = raw.match(/\{[\s\S]*\}/); if (!match) throw new Error('no json'); data = JSON.parse(match[0]) } catch { return Response.json({ error: 'Bonul nu a putut fi citit. Încearcă o fotografie mai clară, cu textul încadrat complet.' }, { status: 422 }) }
  }
  return Response.json({ extracted: { title: typeof data.title === 'string' ? data.title : '', category: typeof data.category === 'string' ? data.category : 'Altele', amount: typeof data.amount === 'number' ? data.amount : null, currency: data.currency === 'EUR' ? 'EUR' : 'MDL', date: typeof data.date === 'string' ? data.date : '' } })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/exchange-rate' && request.method === 'GET') return exchange(request)
    if (url.pathname === '/api/auth/request-code' && request.method === 'POST') return requestCode(request, env)
    if (url.pathname === '/api/auth/verify-code' && request.method === 'POST') return verifyCode(request, env)
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') return logout(request, env)
    if (url.pathname === '/api/receipt/parse' && request.method === 'POST') return parseReceipt(request, env)
    if (url.pathname === '/api/me' && request.method === 'GET') {
      const user = await identity(request, env)
      return user ? Response.json({ user }) : Response.json({ error: 'Autentificare necesară.' }, { status: 401 })
    }
    if (url.pathname.startsWith('/api/')) {
      const user = await identity(request, env)
      if (!user) return Response.json({ error: 'Autentificare necesară.' }, { status: 401 })
      if (url.pathname === '/api/admin/status' && request.method === 'GET') return Response.json({ authenticated: true, role: 'admin', email: user.email })
      return Response.json({ error: 'Ruta API nu este încă activată.' }, { status: 501 })
    }
    return env.ASSETS.fetch(request)
  },
}
