import type { IncomingMessage, ServerResponse } from 'node:http'
import { isISODate, moldovaDate, validRate, type ExchangeRate } from '../src/fx.ts'

export function parseBNM(xml: string, requestedDate: string, now = new Date()): ExchangeRate {
  if (xml.length > 200000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Răspuns BNM invalid.')
  const date = xml.match(/<ValCurs\b[^>]*\bDate=["'](\d{2}\.\d{2}\.\d{4})["']/)?.[1]?.split('.').reverse().join('-')
  const euro = [...xml.matchAll(/<Valute\b[^>]*>([\s\S]*?)<\/Valute>/g)].map(m => m[1]).filter(row => /<CharCode>\s*EUR\s*<\/CharCode>/.test(row))
  if (euro.length !== 1) throw new Error('Cursul EUR lipsește din răspunsul BNM.')
  const number = (tag: string) => {
    const raw = euro[0].match(new RegExp(`<${tag}>\\s*([0-9]+(?:[.,][0-9]+)?)\\s*</${tag}>`))?.[1]
    return raw ? Number(raw.replace(',', '.')) : NaN
  }
  const nominal = number('Nominal')
  const rate = { date, mdlPerEur: number('Value') / nominal, source: 'BNM', fetchedAt: now.toISOString() }
  if (nominal <= 0 || !validRate(rate) || rate.date !== requestedDate) throw new Error('BNM nu a furnizat un curs valid pentru data cerută.')
  return rate
}

const cache = new Map<string, { rate: ExchangeRate; expires: number }>()
const inflight = new Map<string, Promise<ExchangeRate>>()
export async function getBNMRate(date: string): Promise<ExchangeRate> {
  if (!isISODate(date) || date < '2000-01-01' || date > moldovaDate()) throw new Error('Data cursului nu este validă.')
  const saved = cache.get(date)
  if (saved && saved.expires > Date.now()) return saved.rate
  if (inflight.has(date)) return inflight.get(date)!
  const request = (async () => {
    const url = new URL('https://www.bnm.md/ro/official_exchange_rates')
    url.searchParams.set('get_xml', '1')
    url.searchParams.set('date', date.split('-').reverse().join('.'))
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/xml,text/xml' } })
    if (!response.ok) throw new Error('Serviciul BNM nu este disponibil.')
    const rate = parseBNM(await response.text(), date)
    if (cache.size >= 120) cache.delete(cache.keys().next().value!)
    cache.set(date, { rate, expires: Date.now() + 3600000 })
    return rate
  })()
  inflight.set(date, request)
  try { return await request } finally { inflight.delete(date) }
}
export async function exchangeEndpoint(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(JSON.stringify({ error: 'Metodă nepermisă.' })); return }
  const date = new URL(req.url ?? '/', 'http://localhost').searchParams.get('date') ?? moldovaDate()
  if (!isISODate(date) || date < '2000-01-01' || date > moldovaDate()) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Alege o dată validă între 01.01.2000 și astăzi.' })); return }
  try { res.end(JSON.stringify(await getBNMRate(date))) }
  catch { res.statusCode = 503; res.end(JSON.stringify({ error: 'Cursul BNM pentru data cerută nu poate fi preluat acum. Încearcă din nou.' })) }
}
