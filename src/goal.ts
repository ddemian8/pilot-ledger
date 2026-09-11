import { parseAmount } from './ledger'

export type SavingsGoal = { name: string; targetCents: number; savedCents: number }
export const GOAL_KEY = 'pilot-ledger.goal.v1'

export function validGoal(value: unknown): value is SavingsGoal {
  if (!value || typeof value !== 'object') return false
  const g = value as SavingsGoal
  return typeof g.name === 'string' && Boolean(g.name.trim()) && g.name.length <= 120 && Number.isSafeInteger(g.targetCents) && g.targetCents > 0 && g.targetCents <= 99999999999 && Number.isSafeInteger(g.savedCents) && g.savedCents >= 0 && g.savedCents <= 99999999999
}

export function readGoal(): SavingsGoal | null {
  const raw = localStorage.getItem(GOAL_KEY)
  if (raw === null) return null
  const value: unknown = JSON.parse(raw)
  if (!validGoal(value)) throw new Error('Obiectivul salvat nu poate fi citit. Datele au fost păstrate.')
  return value
}

export function parseSavedAmount(value: string): number | null {
  if (/^0{1,9}([.,]0{1,2})?$/.test(value.trim())) return 0
  return parseAmount(value)
}

export function saveGoal(goal: SavingsGoal, expected: SavingsGoal | null): SavingsGoal {
  if (!validGoal(goal)) throw new Error('Completează un nume, o țintă pozitivă și o sumă economisită de minimum 0 EUR.')
  const current = readGoal()
  if (current?.name !== expected?.name || current?.targetCents !== expected?.targetCents || current?.savedCents !== expected?.savedCents) throw new Error('Obiectivul a fost modificat în altă fereastră. Reîncarcă pagina înainte de a continua.')
  const next = { name: goal.name.trim(), targetCents: goal.targetCents, savedCents: goal.savedCents }
  localStorage.setItem(GOAL_KEY, JSON.stringify(next))
  return next
}

export function goalProgress(goal: SavingsGoal | null) {
  const percent = goal ? Math.min(100, goal.savedCents / goal.targetCents * 100) : 0
  return { percent, remainingCents: goal ? Math.max(0, goal.targetCents - goal.savedCents) : 0, reached: Boolean(goal && goal.savedCents >= goal.targetCents) }
}
