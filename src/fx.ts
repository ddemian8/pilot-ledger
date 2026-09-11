export type Currency = 'EUR' | 'MDL'
export type ExchangeRate = { date: string; mdlPerEur: number; source: 'BNM'; fetchedAt: string }
export type OriginalAmount = { originalCurrency?: Currency; originalCents?: number; fx?: ExchangeRate }
export function moldovaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Chisinau', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-')
}
export function isISODate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}
export function validRate(value: unknown): value is ExchangeRate {
  if (!value || typeof value !== 'object') return false
  const rate = value as ExchangeRate
  return rate.source === 'BNM' && typeof rate.date === 'string' && isISODate(rate.date) && typeof rate.mdlPerEur === 'number' && Number.isFinite(rate.mdlPerEur) && rate.mdlPerEur > 0 && rate.mdlPerEur < 1000 && typeof rate.fetchedAt === 'string' && Number.isFinite(Date.parse(rate.fetchedAt))
}
export const formatMDL = (cents: number) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'MDL', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(cents / 100)
export const rateLabel = (rate: ExchangeRate) => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(rate.mdlPerEur)
export const shortDate = (date: string) => date.split('-').reverse().join('.')
export const toMDL = (eurCents: number, rate: ExchangeRate) => Math.round(eurCents * rate.mdlPerEur)
export function convertOriginal(amount: number, currency: Currency, rate: ExchangeRate | null, date: string): { cents: number } & OriginalAmount {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !['EUR', 'MDL'].includes(currency)) throw new Error('Suma sau moneda nu este validă.')
  if (rate && (!validRate(rate) || rate.date !== date)) throw new Error('Cursul nu corespunde datei tranzacției.')
  if (currency === 'MDL' && !rate) throw new Error('Este necesar cursul BNM din data plății pentru a salva în MDL.')
  const cents = currency === 'MDL' ? Math.round(amount / rate!.mdlPerEur) : amount
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Suma convertită trebuie să fie de minimum 0,01 EUR.')
  return { cents, originalCurrency: currency, originalCents: amount, ...(rate ? { fx: rate } : {}) }
}
export function validOriginal(value: OriginalAmount & { cents: number; date: string }): boolean {
  if (value.originalCurrency === undefined && value.originalCents === undefined && value.fx === undefined) return true
  if (!['EUR', 'MDL'].includes(value.originalCurrency ?? '') || !Number.isSafeInteger(value.originalCents) || value.originalCents! <= 0) return false
  if (value.fx && (!validRate(value.fx) || value.fx.date !== value.date)) return false
  if (value.originalCurrency === 'EUR') return value.originalCents === value.cents
  return Boolean(value.fx && Math.round(value.originalCents! / value.fx.mdlPerEur) === value.cents)
}
