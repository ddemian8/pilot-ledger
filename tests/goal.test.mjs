import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'
const asModule = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const fxUrl = asModule(stripTypeScriptTypes(readFileSync(new URL('../src/fx.ts', import.meta.url), 'utf8')))
const ledgerUrl = asModule(stripTypeScriptTypes(readFileSync(new URL('../src/ledger.ts', import.meta.url), 'utf8')).replace("'./fx'", JSON.stringify(fxUrl)))
const goalCode = stripTypeScriptTypes(readFileSync(new URL('../src/goal.ts', import.meta.url), 'utf8')).replace("'./ledger'", JSON.stringify(ledgerUrl))
const { GOAL_KEY, readGoal, saveGoal, goalProgress, parseSavedAmount } = await import(asModule(goalCode))
const { STORAGE_KEY } = await import(ledgerUrl)
let storage
beforeEach(() => { storage = new Map(); globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } })
const goal = { name: 'Mașină', targetCents: 800000, savedCents: 0 }
test('create and update persist independently of the transaction ledger', () => {
  storage.set(STORAGE_KEY, 'existing-ledger')
  assert.equal(readGoal(), null)
  saveGoal(goal, null)
  assert.deepEqual(readGoal(), goal)
  saveGoal({ ...goal, savedCents: 324000 }, goal)
  assert.equal(readGoal().savedCents, 324000)
  assert.equal(storage.get(STORAGE_KEY), 'existing-ledger')
})
test('progress supports zero, partial, reached and overfunded goals', () => {
  assert.deepEqual(goalProgress(null), { percent: 0, remainingCents: 0, reached: false })
  assert.deepEqual(goalProgress(goal), { percent: 0, remainingCents: 800000, reached: false })
  assert.deepEqual(goalProgress({ ...goal, savedCents: 324000 }), { percent: 40.5, remainingCents: 476000, reached: false })
  assert.deepEqual(goalProgress({ ...goal, savedCents: 800000 }), { percent: 100, remainingCents: 0, reached: true })
  assert.deepEqual(goalProgress({ ...goal, savedCents: 900000 }), { percent: 100, remainingCents: 0, reached: true })
})
test('saved amounts allow zero and Romanian decimals but reject malformed input', () => {
  for (const value of ['0', '0,00', '0.0']) assert.equal(parseSavedAmount(value), 0)
  assert.equal(parseSavedAmount('32,45'), 3245)
  for (const value of ['', '-1', '0,001', '1e3', 'NaN', '12.345']) assert.equal(parseSavedAmount(value), null)
})
test('invalid goals and corrupted storage cannot overwrite existing data', () => {
  for (const bad of [{ ...goal, targetCents: 0 }, { ...goal, savedCents: -1 }, { ...goal, name: ' ' }, { ...goal, savedCents: 1.5 }]) assert.throws(() => saveGoal(bad, null))
  storage.set(GOAL_KEY, '{broken')
  assert.throws(readGoal)
  assert.throws(() => saveGoal(goal, null))
  assert.equal(storage.get(GOAL_KEY), '{broken')
})
test('stale updates and quota errors preserve the saved goal', () => {
  saveGoal(goal, null)
  const next = { ...goal, savedCents: 5000 }
  saveGoal(next, goal)
  assert.throws(() => saveGoal({ ...goal, savedCents: 8000 }, goal))
  assert.deepEqual(readGoal(), next)
  localStorage.setItem = () => { throw new Error('Quota exceeded') }
  assert.throws(() => saveGoal({ ...next, savedCents: 10000 }, next))
  assert.deepEqual(readGoal(), next)
})
