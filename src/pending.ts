import { validOriginal } from './fx'
import { readTransactions, STORAGE_KEY, validDate, type Transaction } from './ledger'

export type PendingTransaction = Transaction & { source: string; ignored: boolean }
export const PENDING_KEY = 'pilot-ledger.pending.v1'

export function readPending(): PendingTransaction[] {
  const raw = localStorage.getItem(PENDING_KEY)
  if (raw === null) return []
  const data: unknown = JSON.parse(raw)
  if (!Array.isArray(data) || !data.every(t => t && typeof t.id === 'string' && t.id.startsWith('notification:') && typeof t.title === 'string' && t.title.trim() && typeof t.category === 'string' && t.category.trim() && Number.isSafeInteger(t.cents) && t.cents > 0 && typeof t.date === 'string' && validDate(t.date) && (t.mode === 'income' || t.mode === 'expense') && typeof t.source === 'string' && typeof t.ignored === 'boolean' && validOriginal(t)) || new Set(data.map(t => t.id)).size !== data.length) throw new Error('Invalid pending data')
  return data
}

export function savePending(entry: PendingTransaction): PendingTransaction[] {
  const current = readPending()
  const next = current.some(t => t.id === entry.id) ? current.map(t => t.id === entry.id ? entry : t) : [...current, entry]
  localStorage.setItem(PENDING_KEY, JSON.stringify(next))
  return next
}

// Keep the notification ID in the ledger: approval is idempotent, with one atomic write.
export function approvePending(id: string): Transaction[] {
  const current = readTransactions(true)
  if (current.some(t => t.id === id)) return current
  const entry = readPending().find(t => t.id === id && !t.ignored)
  if (!entry) throw new Error('Pending transaction unavailable')
  const { source: _source, ignored: _ignored, ...transaction } = entry
  const next = [transaction, ...current]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
