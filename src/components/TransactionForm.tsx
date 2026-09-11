import { useState } from 'react'
import { useDatedRate } from '../exchange'
import { convertOriginal, formatMDL, rateLabel, shortDate, type Currency } from '../fx'
import { money, parseAmount, today, validDate, type Transaction } from '../ledger'

export function TransactionForm({ mode: startingMode, initial, prefill, onSave, onClose, allowType = false }: { mode: 'expense' | 'income'; initial?: Transaction; prefill?: Partial<Transaction> & { amount?: number }; onSave: (entry: Transaction) => string; onClose: () => void; allowType?: boolean }) {
  const [mode, setMode] = useState(startingMode)
  const [date, setDate] = useState(initial?.date ?? prefill?.date ?? today())
  const [currency, setCurrency] = useState<Currency>(initial?.originalCurrency ?? prefill?.originalCurrency ?? (initial ? 'EUR' : 'MDL'))
  const [amount, setAmount] = useState(initial ? ((initial.originalCents ?? initial.cents) / 100).toFixed(2) : prefill?.amount ? String(prefill.amount) : '')
  const [error, setError] = useState('')
  const quoted = useDatedRate(date, initial?.date === date ? initial.fx : undefined)
  const categories = mode === 'expense' ? ['Alimentație', 'Transport', 'Locuință', 'Business', 'Sănătate', 'Divertisment', 'Altele'] : ['Salariu', 'Freelance', 'Business', 'Cadou', 'Altele']
  if (initial?.mode === mode && !categories.includes(initial.category)) categories.push(initial.category)
  const parsed = parseAmount(amount)
  const estimate = parsed !== null && quoted.rate ? currency === 'MDL' ? money(Math.round(parsed / quoted.rate.mdlPerEur)) : formatMDL(Math.round(parsed * quoted.rate.mdlPerEur)) : null
  return <form className="entry-form" onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    if (!title || parsed === null || !validDate(date) || date > today()) { setError('Introdu o descriere, o sumă pozitivă cu maximum două zecimale și o dată validă, cel târziu astăzi.'); return }
    try {
      const converted = convertOriginal(parsed, currency, quoted.rate, date)
      setError(onSave({ id: initial?.id ?? crypto.randomUUID(), title, ...converted, date, category: String(data.get('category')), mode }))
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Conversia nu a putut fi efectuată.') }
  }}>
    <label>Descriere<input name="title" defaultValue={initial?.title ?? prefill?.title} autoFocus required maxLength={120} placeholder={mode === 'expense' ? 'Ex. Cumpărături săptămânale' : 'Ex. Salariu'} /></label>
    <div className="form-columns"><label>Sumă originală ({currency})<input name="amount" value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" required placeholder="0" maxLength={12} /></label><label>Monedă<select value={currency} onChange={event => setCurrency(event.target.value as Currency)}><option value="MDL">MDL · Lei moldovenești</option><option value="EUR">EUR · Euro</option></select></label></div>
    <label>Data plății<input name="date" type="date" value={date} onChange={event => setDate(event.target.value)} required max={today()} /></label>
    <div className="conversion-note" role="status">{estimate && <strong>≈ {estimate}</strong>}{quoted.rate ? <span>1 EUR = {rateLabel(quoted.rate)} MDL · BNM {shortDate(quoted.rate.date)}. Cursul se păstrează la salvare.</span> : <span>{quoted.loading ? 'Se încarcă cursul pentru data plății…' : currency === 'MDL' ? 'Salvarea în MDL necesită cursul BNM pentru data plății.' : 'Poți salva în EUR și fără curs. Echivalentul MDL va fi orientativ.'}</span>}{quoted.error && <span>{quoted.error}</span>}{!quoted.loading && !quoted.rate && <button type="button" className="text-button" onClick={quoted.retry}>Reîncearcă încărcarea cursului</button>}</div>
    {(initial || allowType) && <label>Tip<select value={mode} onChange={event => setMode(event.target.value as 'expense' | 'income')}><option value="expense">Cheltuială</option><option value="income">Venit</option></select></label>}
    <label>Categorie<select key={mode} name="category" defaultValue={initial?.mode === mode ? initial.category : prefill?.category}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="cancel-button" onClick={onClose}>Anulează</button><button type="submit" className="save-button" disabled={currency === 'MDL' && !quoted.rate}>{initial ? 'Salvează modificările' : `Salvează ${mode === 'expense' ? 'cheltuiala' : 'venitul'}`}</button></div>
  </form>
}
