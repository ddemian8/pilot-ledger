import { createClient } from '@supabase/supabase-js'
import type { Transaction } from './ledger'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null

export const isSupabaseConfigured = Boolean(supabase)

export async function loadRemoteTransactions() {
  if (!supabase) return [] as Transaction[]
  const { data, error } = await supabase.from('transactions').select('*').eq('deleted', false).order('transaction_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({ id: row.id, title: row.title, category: row.category, mode: row.mode, cents: Number(row.cents), date: row.transaction_date, originalCents: Number(row.original_cents), originalCurrency: row.original_currency, fx: row.fx_rate && row.fx_date ? { mdlPerEur: Number(row.fx_rate), date: row.fx_date, source: 'BNM', fetchedAt: new Date().toISOString() } : undefined })) as Transaction[]
}

export async function saveRemoteTransaction(transaction: Transaction) {
  if (!supabase) return
  const user = await supabase.auth.getUser()
  if (!user.data.user) return
  const { error } = await supabase.from('transactions').upsert({ id: transaction.id, user_id: user.data.user.id, title: transaction.title, category: transaction.category, mode: transaction.mode, cents: transaction.cents, currency: transaction.originalCurrency, original_cents: transaction.originalCents, original_currency: transaction.originalCurrency, fx_rate: transaction.fx?.mdlPerEur ?? null, fx_date: transaction.fx?.date ?? null, transaction_date: transaction.date, deleted: Boolean(transaction.deleted) })
  if (error) throw error
}
