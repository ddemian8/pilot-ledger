import { moldovaDate, validOriginal, type OriginalAmount } from './fx'
export type Transaction = { id: string; title: string; category: string; cents: number; date: string; mode: 'expense' | 'income'; deleted?: boolean } & OriginalAmount
export const STORAGE_KEY = 'pilot-ledger.transactions.v1'
export const today = () => moldovaDate()
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T12:00:00`)
  return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === value
}
export function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized) * 100)
  return cents > 0 && Number.isSafeInteger(cents) ? cents : null
}
export const money = (cents: number) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(cents / 100)
export function readTransactions(includeDeleted = false): Transaction[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return []
  const data: unknown = JSON.parse(raw)
  if (!Array.isArray(data) || !data.every((t) => t && typeof t.id === 'string' && typeof t.title === 'string' && t.title.trim() && typeof t.category === 'string' && Number.isSafeInteger(t.cents) && t.cents > 0 && typeof t.date === 'string' && validDate(t.date) && (t.mode === 'expense' || t.mode === 'income') && (t.deleted === undefined || typeof t.deleted === 'boolean') && validOriginal(t))) throw new Error('Invalid stored transactions')
  return includeDeleted ? data : data.filter(t => !t.deleted)
}
export function monthlyTotals(transactions: Transaction[], month: string) {
  return transactions.filter(t => !t.deleted && t.date.startsWith(month)).reduce((total, t) => { total[t.mode] += t.cents; return total }, { income: 0, expense: 0 })
}

// Preserve deleted IDs so approved notifications cannot be counted a second time.
export function changeTransaction(expected: Transaction, replacement: Transaction): Transaction[] {
  const current = readTransactions(true)
  const saved = current.find(t => t.id === expected.id)
  if (!saved || saved.title !== expected.title || saved.category !== expected.category || saved.cents !== expected.cents || saved.date !== expected.date || saved.mode !== expected.mode || Boolean(saved.deleted) !== Boolean(expected.deleted) || saved.originalCurrency !== expected.originalCurrency || saved.originalCents !== expected.originalCents || JSON.stringify(saved.fx) !== JSON.stringify(expected.fx)) {
    throw new Error('Tranzacția a fost modificată în altă fereastră. Reîncarcă pagina înainte de a continua.')
  }
  if (replacement.id !== expected.id || !replacement.title.trim() || !replacement.category.trim() || !Number.isSafeInteger(replacement.cents) || replacement.cents <= 0 || !validDate(replacement.date) || replacement.date > today() || !['expense', 'income'].includes(replacement.mode) || !validOriginal(replacement)) {
    throw new Error('Detaliile tranzacției nu sunt valide.')
  }
  const next = current.map(t => t.id === expected.id ? replacement : t)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
