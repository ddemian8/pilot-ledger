import { CurrencyAmount } from './components/CurrencyAmount'
import { TransactionForm } from './components/TransactionForm'
import { useState } from 'react'
import { Bell, Check, Pencil, X } from 'lucide-react'
import { today, type Transaction } from './ledger'
import { approvePending, readPending, savePending, type PendingTransaction } from './pending'

export function PendingInbox({ transactions, onApproved, onCount }: { transactions: Transaction[]; onApproved: (items: Transaction[]) => void; onCount: (count: number) => void }) {
  const [loaded] = useState(() => { try { return { items: readPending(), error: '' } } catch { return { items: [] as PendingTransaction[], error: 'Notificările salvate nu pot fi citite. Datele au fost păstrate. Reîncarcă pagina pentru a încerca din nou.' } } })
  const [items, setItems] = useState(loaded.items)
  const [error, setError] = useState(loaded.error)
  const [editing, setEditing] = useState<string | null>(null)
  const [showIgnored, setShowIgnored] = useState(false)
  const [status, setStatus] = useState('')
  const remaining = items.filter(t => !transactions.some(saved => saved.id === t.id))
  const pending = remaining.filter(t => !t.ignored)
  const ignored = remaining.filter(t => t.ignored)
  function perform(action: () => void) {
    try { action(); setError('') } catch { setError('Nu am putut salva modificarea. Verifică accesul la stocarea browserului și încearcă din nou.') }
  }
  function update(entry: PendingTransaction) {
    const next = savePending(entry)
    setItems(next)
    onCount(next.filter(t => !t.ignored && !transactions.some(saved => saved.id === t.id)).length)
  }
  return <section className="pending-section" id="notifications" aria-labelledby="pending-heading" tabIndex={-1}>
    <div className="section-heading pending-heading"><div><p className="eyebrow">VERIFICĂ ÎNAINTE DE SALVARE</p><h2 id="pending-heading">Tranzacții în așteptare <span className="pending-count">{pending.length}</span></h2></div><Bell size={20} aria-hidden="true" /></div>
    <p className="pending-copy">Aprobă doar tranzacțiile pe care le recunoști. Soldul se actualizează după aprobare.</p>
    <details className="notification-demo"><summary>Testează fluxul cu un exemplu</summary><p>Conectarea la notificările bancare nu este încă disponibilă. Exemplul de mai jos este fictiv; dacă îl aprobi, intră în istoricul tău.</p><button className="cancel-button" disabled={Boolean(loaded.error)} onClick={() => perform(() => { const entry: PendingTransaction = { id: `notification:${crypto.randomUUID()}`, title: 'Exemplu: cumpărături', cents: 2450, date: today(), category: 'Alimentație', mode: 'expense', source: 'Notificare demonstrativă', ignored: false }; update(entry); setShowIgnored(false); setStatus('Exemplul a fost adăugat pentru verificare.') })}>Adaugă exemplu demonstrativ</button></details>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="pending-tabs" aria-label="Filtre notificări"><button aria-pressed={!showIgnored} onClick={() => { setShowIgnored(false); setEditing(null) }}>În așteptare ({pending.length})</button><button aria-pressed={showIgnored} onClick={() => { setShowIgnored(true); setEditing(null) }}>Ignorate ({ignored.length})</button></div>
    <div className="pending-list">{(showIgnored ? ignored : pending).length === 0 ? <p className="empty-state">{showIgnored ? 'Nu ai notificări ignorate.' : 'Nicio tranzacție de verificat. Aici vei putea revizui notificările bancare primite.'}</p> : (showIgnored ? ignored : pending).map(entry => <article className="pending-row" key={entry.id}>
      <div className="pending-summary"><div className="transaction-name"><strong>{entry.title}</strong><span>{entry.source} · {entry.date.split('-').reverse().join('.')} · {entry.category}</span></div><strong className={`transaction-amount ${entry.mode}`}><CurrencyAmount cents={entry.cents} original={entry} prefix={entry.mode === 'expense' ? '−' : '+'} /></strong></div>
      {editing === entry.id ? <div className="pending-edit"><TransactionForm mode={entry.mode} initial={entry} onClose={() => setEditing(null)} onSave={updated => {
        try { update({ ...updated, source: entry.source, ignored: entry.ignored }); setEditing(null); setStatus('Detaliile au fost salvate. Tranzacția așteaptă aprobarea.'); return '' }
        catch { return 'Nu am putut salva modificarea. Verifică stocarea browserului și încearcă din nou.' }
      }} /></div> : <div className="pending-actions">{showIgnored ? <button className="cancel-button" onClick={() => perform(() => { update({ ...entry, ignored: false }); setStatus('Tranzacția a revenit în lista de verificare.') })}>Readu în așteptare</button> : <><button className="save-button" onClick={() => perform(() => { const next = approvePending(entry.id); onApproved(next); onCount(pending.filter(t => !next.some(saved => saved.id === t.id)).length); setStatus('Tranzacția a fost aprobată și adăugată în istoric.') })}><Check size={15} /> Aprobă</button><button className="cancel-button" onClick={() => setEditing(entry.id)}><Pencil size={14} /> Editează</button><button className="ignore-button" onClick={() => perform(() => { update({ ...entry, ignored: true }); setStatus('Tranzacția a fost ignorată. O poți readuce din fila Ignorate.') })}><X size={15} /> Ignoră</button></>}</div>}
    </article>)}</div>
    <p className="pending-status" role="status">{status}</p>
  </section>
}
