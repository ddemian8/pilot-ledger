interface Env {
  ASSETS: Fetcher
  DB: D1Database
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/exchange-rate' && request.method === 'GET') return exchange(request)
    if (url.pathname.startsWith('/api/')) return Response.json({ error: 'API route unavailable until authentication is configured.' }, { status: 401 })
    return env.ASSETS.fetch(request)
  },
}
