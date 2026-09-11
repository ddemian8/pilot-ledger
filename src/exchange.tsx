import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { moldovaDate, validRate, type Currency, type ExchangeRate } from './fx'

const CACHE_KEY = 'pilot-ledger.exchange-rates.v1'
const requests = new Map<string, Promise<ExchangeRate>>()
function readCache(): Record<string, ExchangeRate> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return Object.fromEntries(Object.entries(data).filter(([date, rate]) => validRate(rate) && rate.date === date))
  } catch { return {} }
}
export function cachedRate(date: string): ExchangeRate | null { return readCache()[date] ?? null }
function latestCachedRate(): ExchangeRate | null {
  return Object.values(readCache()).filter(rate => rate.date <= moldovaDate()).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}
export async function fetchRate(date: string): Promise<ExchangeRate> {
  if (requests.has(date)) return requests.get(date)!
  const request = (async () => {
    const response = await fetch(`/api/exchange-rate?date=${encodeURIComponent(date)}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('Cursul BNM nu poate fi actualizat acum.')
    const rate: unknown = await response.json()
    if (!validRate(rate) || rate.date !== date) throw new Error('Cursul BNM primit nu corespunde datei cerute.')
    try {
      const cache = { ...readCache(), [date]: rate }
      const entries = Object.entries(cache).sort(([a], [b]) => b.localeCompare(a)).slice(0, 120)
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
    } catch { /* Rates can still be used for this session when storage is blocked. */ }
    return rate
  })()
  requests.set(date, request)
  try { return await request } finally { requests.delete(date) }
}

type ExchangeContextValue = { currency: Currency; setCurrency: (currency: Currency) => void; rate: ExchangeRate | null; loading: boolean; error: string; stale: boolean; refresh: () => void }
const ExchangeContext = createContext<ExchangeContextValue>({ currency: 'EUR', setCurrency: () => {}, rate: null, loading: false, error: '', stale: true, refresh: () => {} })
export const useExchange = () => useContext(ExchangeContext)
export function ExchangeProvider({ children }: { children: ReactNode }) {
  const [currency, updateCurrency] = useState<Currency>(() => { try { return localStorage.getItem('pilot-ledger.display-currency.v1') === 'MDL' ? 'MDL' : 'EUR' } catch { return 'EUR' } })
  const setCurrency = (next: Currency) => { updateCurrency(next); try { localStorage.setItem('pilot-ledger.display-currency.v1', next) } catch { /* Selection remains available for this session. */ } }
  const [rate, setRate] = useState<ExchangeRate | null>(latestCachedRate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [day, setDay] = useState(moldovaDate)
  const busy = useRef(false)
  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    const requested = moldovaDate()
    setDay(requested)
    try { const next = await fetchRate(requested); setRate(next); setError('') }
    catch { setError('Actualizarea BNM a eșuat. Reîncearcă atunci când ai conexiune.') }
    finally { busy.current = false; setLoading(false) }
  }, [])
  useEffect(() => {
    void refresh()
    let lastDay = moldovaDate()
    const timer = window.setInterval(() => {
      const nextDay = moldovaDate()
      setDay(nextDay)
      if (nextDay !== lastDay) { lastDay = nextDay; void refresh() }
    }, 30000)
    const retry = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 3600000)
    const focus = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('online', focus)
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', focus)
    return () => { clearInterval(timer); clearInterval(retry); window.removeEventListener('online', focus); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus) }
  }, [refresh])
  return <ExchangeContext.Provider value={{ currency, setCurrency, rate, loading, error, stale: !rate || rate.date !== day, refresh: () => { void refresh() } }}>{children}</ExchangeContext.Provider>
}

export function useDatedRate(date: string, fixed?: ExchangeRate) {
  const current = useExchange()
  const [result, setResult] = useState<{ date: string; rate: ExchangeRate | null; loading: boolean; error: string }>({ date: '', rate: null, loading: false, error: '' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (fixed?.date === date || current.rate?.date === date) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > moldovaDate() || date < '2000-01-01') return
    let active = true
    const cached = cachedRate(date)
    setResult({ date, rate: cached, loading: true, error: '' })
    fetchRate(date).then(rate => { if (active) setResult({ date, rate, loading: false, error: '' }) }).catch(() => { if (active) setResult({ date, rate: cached, loading: false, error: cached ? 'Curs salvat pentru această dată.' : 'Cursul pentru data plății nu este disponibil. Reîncearcă.' }) })
    return () => { active = false }
  }, [date, fixed, current.rate, attempt])
  if (fixed?.date === date) return { rate: fixed, loading: false, error: '', retry: () => setAttempt(x => x + 1) }
  if (current.rate?.date === date) return { rate: current.rate, loading: current.loading, error: current.error, retry: current.refresh }
  return { rate: result.date === date ? result.rate : null, loading: result.date === date && result.loading, error: result.date === date ? result.error : '', retry: () => setAttempt(x => x + 1) }
}
