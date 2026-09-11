import { CurrencyAmount, useCurrencyFormat } from './CurrencyAmount'
import { useEffect, useRef, useState } from 'react'
import { Flag, Pencil, Target, Trophy } from 'lucide-react'
import { parseAmount } from '../ledger'
import { goalProgress, parseSavedAmount, readGoal, saveGoal, type SavingsGoal } from '../goal'
import { GoalNeonBorder } from './GoalNeonBorder'

export function SavingsGoalCard() {
  const formatAmount = useCurrencyFormat()
  const [loaded] = useState(() => {
    try { return { goal: readGoal(), error: '' } }
    catch { return { goal: null, error: 'Obiectivul salvat nu poate fi citit. Datele au fost păstrate. Reîncarcă pagina pentru a încerca din nou.' } }
  })
  const [goal, setGoal] = useState<SavingsGoal | null>(loaded.goal)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const editButton = useRef<HTMLButtonElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const progress = goalProgress(goal)
  const percentLabel = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(progress.reached ? 100 : Math.min(99.9, progress.percent))
  useEffect(() => { if (editing) nameInput.current?.focus() }, [editing])
  function closeEditor() { setEditing(false); setError(''); editButton.current?.focus() }

  return <article className="goal-panel savings-goal" id="goals" aria-labelledby="goal-heading">
    <GoalNeonBorder />
    <div className="panel-heading"><div><p className="eyebrow violet-text">OBIECTIVUL TĂU</p><h2 id="goal-heading">{goal?.name ?? 'Pentru ce economisești?'}</h2></div><Target size={20} className="violet-text" aria-hidden="true" /></div>
    {loaded.error ? <p className="form-error" role="alert">{loaded.error}</p> : <>
      {goal ? <div className="goal-numbers"><div><strong><CurrencyAmount cents={goal.savedCents} /></strong><small>economisit până acum</small></div><div className="goal-target"><small>Țintă</small><strong><CurrencyAmount cents={goal.targetCents} /></strong></div></div> : <p className="goal-intro">O mașină, o vacanță sau un fond de rezervă. Alege ținta și urmărește cât ai pus deoparte.</p>}
      <div className="race-track"><div className="track-line" role="progressbar" aria-label="Progresul obiectivului de economisire" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(progress.percent.toFixed(2))} aria-valuetext={goal ? `${formatAmount(goal.savedCents).text} din ${formatAmount(goal.targetCents).text}` : 'Niciun obiectiv configurat'}>
        <span className="track-progress" style={{ width: `${progress.percent}%` }} />
        <span className="start-dot" /><span className="finish-flag"><Flag size={15} /></span>
        <div className="race-car" style={{ left: `clamp(0px, calc(${progress.percent}% - 35px), calc(100% - 70px))` }}><img src="/assets/f1-car.png" alt="" /></div>
      </div><div className="track-labels"><span>Start</span><strong>{percentLabel}% parcurs</strong><span>Țintă</span></div></div>
      <div className="goal-footer"><span>{progress.reached ? <><Trophy size={16} /> Ai atins obiectivul!</> : goal ? <>Mai ai <CurrencyAmount cents={progress.remainingCents} /> până la țintă</> : 'Fiecare sumă pusă deoparte contează'}</span><button ref={editButton} aria-expanded={editing} aria-controls="goal-editor" onClick={() => { setEditing(!editing); setError(''); setNotice('') }}><Pencil size={14} />{goal ? 'Actualizează obiectivul' : 'Configurează obiectivul'}</button></div>
      {editing && <form id="goal-editor" className="entry-form goal-editor" onSubmit={event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const name = String(data.get('name') ?? '').trim()
        const targetCents = parseAmount(String(data.get('target') ?? ''))
        const savedCents = parseSavedAmount(String(data.get('saved') ?? ''))
        if (!name || targetCents === null || savedCents === null) { setError('Completează numele, o țintă mai mare decât 0 și suma economisită, cu maximum două zecimale.'); return }
        try {
          setGoal(saveGoal({ name, targetCents, savedCents }, goal))
          closeEditor()
          setNotice('Obiectivul a fost salvat.')
        } catch (failure) { setError(failure instanceof Error && failure.message.startsWith('Obiectivul') ? failure.message : 'Nu am putut salva obiectivul. Verifică stocarea browserului și încearcă din nou.') }
      }}>
        <label>Numele obiectivului<input ref={nameInput} name="name" required maxLength={120} defaultValue={goal?.name ?? ''} placeholder="Ex. Fond pentru mașină" /></label>
        <label>Suma țintă (EUR)<input name="target" inputMode="decimal" required maxLength={12} defaultValue={goal ? (goal.targetCents / 100).toFixed(2) : ''} placeholder="Ex. 8000" /></label>
        <label>Economisit până acum (EUR)<input name="saved" inputMode="decimal" required maxLength={12} defaultValue={goal ? (goal.savedCents / 100).toFixed(2) : '0'} aria-describedby="goal-savings-help" /></label>
        <p className="goal-help" id="goal-savings-help">Introdu suma pusă efectiv deoparte. O actualizezi manual; aceasta nu modifică veniturile sau cheltuielile din istoric.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="cancel-button" onClick={closeEditor}>Anulează</button><button type="submit" className="save-button">Salvează obiectivul</button></div>
      </form>}
      <p className="goal-status" role="status">{notice}</p>
    </>}
  </article>
}
