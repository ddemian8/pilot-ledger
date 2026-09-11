import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'
const fxUrl = 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(readFileSync(new URL('../src/fx.ts', import.meta.url), 'utf8'))).toString('base64')
const ledgerCode = stripTypeScriptTypes(readFileSync(new URL('../src/ledger.ts', import.meta.url), 'utf8')).replace("'./fx'", JSON.stringify(fxUrl))
const ledgerUrl = 'data:text/javascript;base64,' + Buffer.from(ledgerCode).toString('base64')
const pendingCode = stripTypeScriptTypes(readFileSync(new URL('../src/pending.ts', import.meta.url), 'utf8')).replace("'./ledger'", JSON.stringify(ledgerUrl)).replace("'./fx'", JSON.stringify(fxUrl))
const { readTransactions, STORAGE_KEY, changeTransaction, monthlyTotals, today, money } = await import(ledgerUrl)
const { readPending, savePending, approvePending, PENDING_KEY } = await import('data:text/javascript;base64,' + Buffer.from(pendingCode).toString('base64'))
let storage
beforeEach(() => { storage = new Map(); globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } })
const entry = { id: 'notification:test', title: 'Test', category: 'Alimentație', cents: 2450, date: '2026-09-11', mode: 'expense', source: 'Demo', ignored: false }
test('pending and edited amounts stay outside ledger until approval; approval is idempotent', () => {
  savePending(entry); assert.deepEqual(readTransactions(), [])
  savePending({ ...entry, cents: 3100, mode: 'income' })
  assert.equal(readPending()[0].cents, 3100)
  assert.deepEqual(readTransactions(), [])
  const approved = approvePending(entry.id)
  assert.equal(approved[0].cents, 3100); assert.equal(approved[0].mode, 'income')
  assert.equal(approvePending(entry.id).length, 1)
  assert.equal(readTransactions().length, 1)
})
test('ignore and restore survive storage reads', () => {
  savePending({ ...entry, ignored: true }); assert.equal(readPending()[0].ignored, true)
  assert.throws(() => approvePending(entry.id)); assert.deepEqual(readTransactions(), [])
  savePending(entry); assert.equal(approvePending(entry.id).length, 1)
})
test('failed approval preserves ledger and pending transaction for retry', () => {
  savePending(entry)
  localStorage.setItem = () => { throw new Error('Quota exceeded') }
  assert.throws(() => approvePending(entry.id)); assert.deepEqual(readTransactions(), [])
  assert.equal(readPending()[0].ignored, false)
  localStorage.setItem = (key, value) => storage.set(key, value)
  assert.equal(approvePending(entry.id).length, 1)
})
test('corrupt stored data is preserved', () => {
  storage.set(PENDING_KEY, '{broken'); assert.throws(readPending); assert.throws(() => savePending(entry)); assert.equal(storage.get(PENDING_KEY), '{broken')
  storage.delete(PENDING_KEY); savePending(entry)
  storage.set(STORAGE_KEY, '{broken'); assert.throws(() => approvePending(entry.id)); assert.equal(storage.get(STORAGE_KEY), '{broken')
})
test('invalid pending records and duplicate IDs are rejected', () => {
  for (const records of [[{ ...entry, cents: -1 }], [{ ...entry, date: '2026-02-30' }], [entry, entry]]) {
    storage.set(PENDING_KEY, JSON.stringify(records)); assert.throws(readPending)
  }
})

test('editing updates totals, preserves IDs and keeps unrelated transactions', () => {
  const date = today()
  const original = { ...entry, date }
  const unrelated = { ...original, id: 'manual:other', cents: 1200 }
  storage.set(STORAGE_KEY, JSON.stringify([original, unrelated]))
  const next = changeTransaction(original, { ...original, cents: 4200, mode: 'income', category: 'Salariu' })
  assert.equal(next[0].id, original.id)
  assert.equal(next[1].cents, 1200)
  assert.deepEqual(monthlyTotals(readTransactions(), date.slice(0, 7)), { income: 4200, expense: 1200 })
})
test('delete and undo update totals and never reapprove a deleted notification', () => {
  const original = { ...entry, date: today() }
  savePending(original)
  approvePending(original.id)
  const saved = readTransactions()[0]
  const removed = { ...saved, deleted: true }
  changeTransaction(saved, removed)
  assert.deepEqual(readTransactions(), [])
  assert.deepEqual(monthlyTotals(readTransactions(true), today().slice(0, 7)), { income: 0, expense: 0 })
  assert.equal(approvePending(original.id)[0].deleted, true)
  assert.deepEqual(readTransactions(), [])
  changeTransaction(removed, { ...removed, deleted: false })
  assert.equal(readTransactions().length, 1)
  assert.equal(monthlyTotals(readTransactions(), today().slice(0, 7)).expense, 2450)
})
test('stale edits and stale undo cannot overwrite changes in another window', () => {
  const original = { ...entry, date: today() }
  storage.set(STORAGE_KEY, JSON.stringify([original]))
  const edited = { ...original, cents: 6000 }
  changeTransaction(original, edited)
  assert.throws(() => changeTransaction(original, { ...original, cents: 7000 }))
  const removed = { ...edited, deleted: true }
  changeTransaction(edited, removed)
  changeTransaction(removed, { ...removed, deleted: false })
  assert.throws(() => changeTransaction(removed, { ...removed, deleted: false }))
  assert.equal(readTransactions()[0].cents, 6000)
})
test('failed edit or deletion leaves the stored ledger intact', () => {
  const original = { ...entry, date: today() }
  storage.set(STORAGE_KEY, JSON.stringify([original]))
  const before = storage.get(STORAGE_KEY)
  localStorage.setItem = () => { throw new Error('Storage blocked') }
  assert.throws(() => changeTransaction(original, { ...original, cents: 5000 }))
  assert.throws(() => changeTransaction(original, { ...original, deleted: true }))
  assert.equal(storage.get(STORAGE_KEY), before)
})

test('MDL edit, deletion and restore preserve original currency and frozen rate', async () => {
  const { convertOriginal } = await import(fxUrl)
  const date = today()
  const fx = { source: 'BNM', mdlPerEur: 20.0545, date, fetchedAt: new Date().toISOString() }
  const original = { ...entry, ...convertOriginal(100000, 'MDL', fx, date), date }
  savePending(original)
  approvePending(original.id)
  const before = readTransactions()[0]
  const edited = { ...before, title: 'Bon în MDL' }
  changeTransaction(before, edited)
  const removed = { ...edited, deleted: true }
  changeTransaction(edited, removed)
  changeTransaction(removed, { ...removed, deleted: false })
  assert.equal(readTransactions()[0].originalCents, 100000)
  assert.equal(readTransactions()[0].originalCurrency, 'MDL')
  assert.deepEqual(readTransactions()[0].fx, fx)
})

test('EUR display rounds without changing saved cents', () => {
  assert.match(money(12349), /123/)
  assert.match(money(12350), /124/)
  assert.doesNotMatch(money(12300), /,00/)
  storage.set(STORAGE_KEY, JSON.stringify([{ ...entry, cents: 12349 }]))
  money(readTransactions()[0].cents)
  assert.equal(readTransactions()[0].cents, 12349)
})
