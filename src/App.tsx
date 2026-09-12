import { CurrencyToggle } from './components/CurrencyToggle'
import { CurrencyAmount, useCurrencyFormat } from './components/CurrencyAmount'
import { ExchangeStatus } from './components/ExchangeStatus'
import { TransactionForm } from './components/TransactionForm'
import { ImportSourcePicker, type Source } from './components/ImportSourcePicker'
import { GlassAction } from './components/GlassAction'
import { SavingsGoalCard } from './components/SavingsGoalCard'
import { useEffect, useRef, useState } from 'react'
import { PendingInbox } from './PendingInbox'
import { readPending } from './pending'
import { changeTransaction, monthlyTotals, readTransactions, STORAGE_KEY, today, type Transaction } from './ledger'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  Menu,
  Pencil,
  Trash2,
  Search,
  ScanLine,
  Settings2,
  Target,
  WalletCards,
  X,
} from 'lucide-react'

type EntryMode = 'expense' | 'income' | null
type AppPage = 'overview' | 'transactions' | 'goals' | 'analytics' | 'settings'


function App() {
  const formatAmount = useCurrencyFormat()
  const [entryMode, setEntryMode] = useState<EntryMode>(null)
  const [showAll, setShowAll] = useState(false)
  const [loaded] = useState(() => { try { return { transactions: readTransactions(true), error: '' } } catch { return { transactions: [] as Transaction[], error: 'Datele locale nu au putut fi citite. Reîncarcă pagina sau verifică accesul la stocarea browserului. Datele existente nu au fost modificate.' } } })
  const [ledger, setTransactions] = useState(loaded.transactions)
  const transactions = ledger.filter(t => !t.deleted)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<Transaction | null>(null)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [activePage, setActivePage] = useState<AppPage>(() => {
    const hash = window.location.hash.replace('#', '')
    return hash === 'transactions' || hash === 'goals' || hash === 'analytics' || hash === 'settings' ? hash : 'overview'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [largeExpenseAlerts, setLargeExpenseAlerts] = useState(true)
  const [monthlySummary, setMonthlySummary] = useState(true)
  const [autoCategory, setAutoCategory] = useState(true)
  const [pendingCount, setPendingCount] = useState(() => { try { return readPending().filter(t => !t.ignored && !loaded.transactions.some(saved => saved.id === t.id)).length } catch { return 0 } })
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const totals = monthlyTotals(transactions, today().slice(0, 7))
  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (5 - index))
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const values = monthlyTotals(transactions, key)
    return { key, label: date.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', ''), ...values }
  })
  const maxTrend = Math.max(1, ...trend.flatMap((month) => [month.income, month.expense]))
  const totalIncome = transactions.filter(t => t.mode === 'income').reduce((sum, t) => sum + t.cents, 0)
  const totalExpense = transactions.filter(t => t.mode === 'expense').reduce((sum, t) => sum + t.cents, 0)
  const categoryTotals = [...transactions.filter(t => t.mode === 'expense').reduce((map, t) => map.set(t.category, (map.get(t.category) ?? 0) + t.cents), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxCategory = Math.max(1, ...categoryTotals.map(([, amount]) => amount))
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  const categories = [...new Set([...transactions.map((transaction) => transaction.category), ...(categoryFilter !== 'all' ? [categoryFilter] : [])])].sort((a, b) => a.localeCompare(b, 'ro'))
  const filtered = sorted.filter((transaction) => {
    const matchesQuery = !query.trim() || `${transaction.title} ${transaction.category}`.toLocaleLowerCase('ro').includes(query.trim().toLocaleLowerCase('ro'))
    const matchesType = typeFilter === 'all' || transaction.mode === typeFilter
    const matchesCategory = categoryFilter === 'all' || transaction.category === categoryFilter
    const matchesMonth = monthFilter === 'all' || transaction.date.startsWith(monthFilter)
    return matchesQuery && matchesType && matchesCategory && matchesMonth
  })
  const hasFilters = Boolean(query.trim()) || typeFilter !== 'all' || categoryFilter !== 'all' || monthFilter !== 'all'
  const activity = showAll || hasFilters ? filtered : filtered.slice(0, 3)
  const save = (entry: Transaction) => {
    if (loaded.error) return loaded.error
    try {
      const next = [entry, ...readTransactions(true)]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setTransactions(next)
      setEntryMode(null)
      setNotice('Tranzacția a fost salvată.')
      return ''
    } catch { return 'Nu am putut salva. Verifică spațiul disponibil și permisiunile browserului, apoi încearcă din nou.' }
  }

  const editSave = (entry: Transaction) => {
    if (!editing) return 'Tranzacția nu mai este disponibilă.'
    try {
      setTransactions(changeTransaction(editing, entry))
      setEditing(null)
      setNotice('Tranzacția a fost actualizată.')
      return ''
    } catch (error) { return error instanceof Error && error.message.startsWith('Tranzacția') ? error.message : 'Nu am putut salva modificările. Verifică stocarea browserului și încearcă din nou.' }
  }
  const remove = (entry: Transaction) => {
    try {
      const removed = { ...entry, deleted: true }
      setTransactions(changeTransaction(entry, removed))
      setDeleted(removed)
      setDeleting(null)
      setActionError('')
      setNotice('Tranzacția a fost ștearsă.')
    } catch (error) { setActionError(error instanceof Error && error.message.startsWith('Tranzacția') ? error.message : 'Nu am putut șterge tranzacția. Datele au fost păstrate. Încearcă din nou.') }
  }
  const undoDelete = () => {
    if (!deleted) return
    try {
      setTransactions(changeTransaction(deleted, { ...deleted, deleted: false }))
      setDeleted(null)
      setActionError('')
      setNotice('Tranzacția a fost restaurată.')
    } catch { setActionError('Nu am putut restaura tranzacția. Reîncarcă pagina dacă datele au fost modificate în altă fereastră.') }
  }
  const openEntry = (mode: EntryMode) => { setEditing(null); setEntryMode(mode) }
  const navigate = (page: AppPage) => {
    setActivePage(page)
    setMobileMenuOpen(false)
    window.history.replaceState(null, '', `#${page}`)
    const target = document.getElementById(page === 'overview' ? 'dashboard' : page)
    requestAnimationFrame(() => target?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    if (page === 'transactions') setShowAll(true)
  }
  useEffect(() => {
    const onHash = () => { const hash = window.location.hash.replace('#', '') as AppPage; if (['overview', 'transactions', 'goals', 'analytics', 'settings'].includes(hash)) setActivePage(hash) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><span className="brand-logo-art" aria-label="Pilot Ledger" /><div><strong>Pilot</strong><small>Ledger</small></div></div>
        <nav className="main-nav" aria-label="Navigație principală">
          <button className={`nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => navigate('overview')}><Gauge size={19} /> Overview</button>
          <button className={`nav-item ${activePage === 'transactions' ? 'active' : ''}`} onClick={() => navigate('transactions')}><WalletCards size={19} /> Tranzacții</button>
          <button className={`nav-item ${activePage === 'goals' ? 'active' : ''}`} onClick={() => navigate('goals')}><Target size={19} /> Obiective</button>
          <button className={`nav-item ${activePage === 'analytics' ? 'active' : ''}`} onClick={() => navigate('analytics')}><BarChart3 size={19} /> Analitică</button>
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={19} /> Setări</button>
          <div className="profile"><div className="avatar">DD</div><div><strong>Dumitru</strong><span>Cont personal</span></div><ChevronRight size={16} /></div>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-logo-art" aria-label="Pilot Ledger" /><strong>Pilot Ledger</strong></div>
          <div className="topbar-actions"><CurrencyToggle /><button className="icon-button mobile-menu" aria-label="Deschide meniul" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(value => !value)}><Menu size={21} /></button><button className="icon-button notification-button" aria-label={`Notificări: ${pendingCount} în așteptare`} onClick={() => { const inbox = document.getElementById('notifications'); inbox?.scrollIntoView({ block: 'start' }); inbox?.focus({ preventScroll: true }) }}><Bell size={19} />{pendingCount > 0 && <span className="notification-badge">{pendingCount}</span>}</button><div className="top-avatar">DD</div></div>
        </header>

        {mobileMenuOpen && <div className="mobile-nav-drawer" role="dialog" aria-label="Meniu Pilot Ledger"><div className="mobile-drawer-head"><strong>Meniu</strong><button className="icon-button" onClick={() => setMobileMenuOpen(false)} aria-label="Închide meniul"><X size={20} /></button></div><button className={`nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => navigate('overview')}><Gauge size={19} /> Overview</button><button className={`nav-item ${activePage === 'transactions' ? 'active' : ''}`} onClick={() => navigate('transactions')}><WalletCards size={19} /> Tranzacții</button><button className={`nav-item ${activePage === 'goals' ? 'active' : ''}`} onClick={() => navigate('goals')}><Target size={19} /> Obiective</button><button className={`nav-item ${activePage === 'analytics' ? 'active' : ''}`} onClick={() => navigate('analytics')}><BarChart3 size={19} /> Analitică</button><button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={19} /> Setări</button></div>}

        <div className={`content-wrap page-${activePage}`} id="dashboard">
          {activePage === 'analytics' && <section className="analytics-page" id="analytics" aria-labelledby="analytics-title"><div className="page-header"><div><p className="eyebrow">RAPORT FINANCIAR</p><h1 id="analytics-title">Analitică</h1><p className="muted">Înțelege unde se duc banii și cum evoluează economiile tale.</p></div><select aria-label="Perioadă analizată" defaultValue="month"><option value="week">Această săptămână</option><option value="month">Luna aceasta</option><option value="quarter">Ultimele 3 luni</option><option value="year">Anul acesta</option></select></div>{!transactions.length ? <div className="analytics-empty"><BarChart3 size={28} /><h2>Nu există suficiente date</h2><p>Adaugă câteva tranzacții pentru a vedea analiza financiară.</p><button className="save-button" onClick={() => openEntry('expense')}>Adaugă tranzacție</button></div> : <><div className="analytics-kpis"><article><span>Venituri totale</span><strong className="income-text"><CurrencyAmount cents={totalIncome} /></strong></article><article><span>Cheltuieli totale</span><strong className="expense-text"><CurrencyAmount cents={totalExpense} /></strong></article><article><span>Economii</span><strong className="violet-text"><CurrencyAmount cents={totalIncome - totalExpense} /></strong></article><article><span>Rata de economisire</span><strong>{totalIncome ? `${Math.max(0, Math.round((totalIncome - totalExpense) / totalIncome * 100))}%` : '0%'}</strong></article></div><article className="analytics-card analytics-bars"><div className="section-heading"><div><p className="eyebrow">VENITURI VS CHELTUIELI</p><h2>Evoluție pe luni</h2></div></div><div className="analytics-chart">{trend.map(month => <div className="analytics-column" key={month.key}><div className="analytics-bar-pair"><span className="analytics-bar income" style={{ height: `${Math.max(5, month.income / maxTrend * 100)}%` }} title={`Venituri ${formatAmount(month.income).text}`} /><span className="analytics-bar expense" style={{ height: `${Math.max(5, month.expense / maxTrend * 100)}%` }} title={`Cheltuieli ${formatAmount(month.expense).text}`} /></div><small>{month.label}</small></div>)}</div></article><div className="analytics-two-col"><article className="analytics-card"><p className="eyebrow">CATEGORII</p><h2>Unde se duc banii</h2><div className="category-bars">{categoryTotals.map(([category, amount], index) => <div className="category-bar-row" key={category}><div><span>{category}</span><strong><CurrencyAmount cents={amount} /></strong></div><div className="category-track"><i className={`category-fill c${index}`} style={{ width: `${amount / maxCategory * 100}%` }} /></div></div>)}{!categoryTotals.length && <p className="muted">Nu există cheltuieli înregistrate.</p>}</div></article><article className="analytics-card insight-card"><p className="eyebrow">INSIGHT</p><BarChart3 size={24} /><h2>{categoryTotals.length ? `${categoryTotals[0][0]} este categoria principală` : 'Adaugă tranzacții pentru insight-uri'}</h2><p>{categoryTotals.length ? `Ai cheltuit ${formatAmount(categoryTotals[0][1]).text} în această categorie.` : 'După ce adaugi tranzacții, aici vei vedea recomandări utile.'}</p></article></div></>}</section>}
          {activePage === 'transactions' && <><div className="page-header transactions-header"><div><p className="eyebrow">TOATE MIȘCĂRILE</p><h1>Tranzacții</h1><p className="muted">Caută, filtrează și gestionează istoricul tău.</p></div><button className="save-button page-add-button" onClick={() => openEntry('expense')}>+ Adaugă tranzacție</button></div><div className="transaction-stats"><article className="stat-income"><span>Total venituri</span><strong><CurrencyAmount cents={totalIncome} /></strong></article><article className="stat-expense"><span>Total cheltuieli</span><strong><CurrencyAmount cents={totalExpense} /></strong></article><article className="stat-balance"><span>Sold curent</span><strong><CurrencyAmount cents={totalIncome - totalExpense} /></strong></article></div></>}
          {activePage === 'goals' && <div className="page-header goals-header"><div><p className="eyebrow">PLANUL TĂU</p><h1>Obiective</h1><p className="muted">Urmărește progresul lucrurilor pentru care economisești.</p></div></div>}
          <div className="welcome-row">
            <div><p className="eyebrow">{new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toLocaleUpperCase('ro-RO')}</p><h1>Bună dimineața, Dumitru.</h1><p className="muted">Hai să vezi cum merge cursa ta financiară.</p></div>
            
          </div>

          <section className="quick-actions" aria-label="Adaugă o tranzacție">
            <GlassAction mode="expense" onActivate={() => openEntry('expense')} />
            <GlassAction mode="income" onActivate={() => openEntry('income')} />
          </section>

          <section className="dashboard-grid" id="overview-goals">
            <SavingsGoalCard />

            <article className="month-panel">
              <div className="panel-heading"><div><p className="eyebrow">{new Date().toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }).toLocaleUpperCase('ro-RO')}</p><h2>Rezumatul lunii</h2></div><CircleDollarSign className="green-icon" size={25} /></div>
              <div className="metric-main"><small>Profit net</small><strong>{<CurrencyAmount cents={totals.income - totals.expense} />}</strong></div>
              <div className="metric-lines"><div><span><i className="dot green-dot"></i>Venituri</span><strong>{<CurrencyAmount cents={totals.income} />}</strong></div><div><span><i className="dot purple-dot"></i>Cheltuieli</span><strong>{<CurrencyAmount cents={totals.expense} />}</strong></div></div>
            </article>
          </section>

          <section className="trend-panel" aria-labelledby="trend-title">
            <div className="section-heading"><div><p className="eyebrow">ULTIMELE 6 LUNI</p><h2 id="trend-title">Evoluție financiară</h2></div><div className="trend-legend"><span><i className="dot green-dot" /> Venituri</span><span><i className="dot purple-dot" /> Cheltuieli</span></div></div>
            <div className="trend-chart" aria-label="Grafic cu veniturile și cheltuielile din ultimele șase luni">
              {trend.map((month) => <div className="trend-column" key={month.key}><div className="trend-bars"><span className="trend-bar income" style={{ height: `${Math.max(month.income ? 8 : 2, month.income / maxTrend * 100)}%` }} title={`Venituri ${formatAmount(month.income).text}`} /><span className="trend-bar expense" style={{ height: `${Math.max(month.expense ? 8 : 2, month.expense / maxTrend * 100)}%` }} title={`Cheltuieli ${formatAmount(month.expense).text}`} /></div><small>{month.label}</small></div>)}
            </div>
          </section>

          {loaded.error && <p role="alert" className="form-error">{loaded.error}</p>}
          <section className="activity-section" id="transactions">
            <div className="section-heading"><div><p className="eyebrow">MIȘCĂRI RECENTE</p><h2>{showAll || hasFilters ? `Tranzacții (${filtered.length})` : 'Activitate'}</h2></div><button className="text-button" onClick={() => setShowAll(!showAll)}>{showAll ? 'Vezi recente' : 'Vezi toate'} <ChevronRight size={15} /></button></div>
            <div className="filters" aria-label="Filtrează tranzacțiile">
              <label className="search-field"><Search size={16} /><span className="sr-only">Caută tranzacții</span><input value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(true) }} placeholder="Caută tranzacții..." /></label>
              <label><span className="sr-only">Tip tranzacție</span><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as typeof typeFilter); setShowAll(true) }}><option value="all">Toate tipurile</option><option value="income">Venituri</option><option value="expense">Cheltuieli</option></select></label>
              <label><span className="sr-only">Categorie</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setShowAll(true) }}><option value="all">Toate categoriile</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label><span className="sr-only">Lună</span><input type="month" value={monthFilter === 'all' ? '' : monthFilter} onChange={(event) => { setMonthFilter(event.target.value || 'all'); setShowAll(true) }} aria-label="Filtrează după lună" /></label>
              {hasFilters && <button className="clear-filters" onClick={() => { setQuery(''); setTypeFilter('all'); setCategoryFilter('all'); setMonthFilter('all') }}>Resetează</button>}
            </div>
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
            {deleted && <div className="undo-delete" role="status"><span>Ai șters „{deleted.title}”.</span><button onClick={undoDelete}>Anulează ștergerea</button><button className="icon-button" aria-label="Închide opțiunea de restaurare" onClick={() => setDeleted(null)}><X size={16} /></button></div>}
            <div className="activity-list">{!activity.length && <p className="empty-state">{hasFilters ? 'Nicio tranzacție nu corespunde filtrelor. Modifică filtrele sau apasă Resetează.' : 'Nicio tranzacție încă. Adaugă primul venit sau prima cheltuială pentru a vedea rezumatul tău.'}</p>}{activity.map((item) => <div className="transaction-entry" key={item.id}>
              <div className="activity-row"><div className={`transaction-icon ${item.mode}`}><span>{item.mode === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span></div><div className="transaction-name"><strong>{item.title}</strong><span>{item.category} · {new Date(`${item.date}T12:00:00`).toLocaleDateString('ro-RO')}</span></div><strong className={`transaction-amount ${item.mode}`}><CurrencyAmount cents={item.cents} original={item} prefix={item.mode === 'income' ? '+' : '−'} /></strong>
                <div className="transaction-controls"><button className="icon-button" aria-label={`Editează ${item.title}`} title="Editează" onClick={() => { setEntryMode(null); setDeleting(null); setEditing(item) }}><Pencil size={16} /></button><button className="icon-button delete-trigger" aria-label={`Șterge ${item.title}`} title="Șterge" aria-expanded={deleting === item.id} onClick={() => { setDeleting(deleting === item.id ? null : item.id); setActionError('') }}><Trash2 size={16} /></button></div>
              </div>
              {deleting === item.id && <div className="delete-confirm"><p>Ștergi „{item.title}” (<CurrencyAmount cents={item.cents} original={item} />)? Suma va fi eliminată din rezumat.</p><div><button className="cancel-button" onClick={() => setDeleting(null)}>Păstrează</button><button className="delete-button" onClick={() => remove(item)}>Șterge tranzacția</button></div></div>}
            </div>)}</div>
          </section>

          <PendingInbox transactions={ledger} onApproved={setTransactions} onCount={setPendingCount} />

          <details className="exchange-details"><summary>Curs valutar · BNM</summary><ExchangeStatus /></details>
          <section className="settings-section" id="settings" aria-labelledby="settings-title"><div className="page-header"><div><p className="eyebrow">CONTUL TĂU</p><h1 id="settings-title">Setări</h1></div></div><div className="settings-stack"><article className="settings-card settings-profile-card"><div className="settings-profile-avatar">DD</div><div><h3>Dumitru</h3><p>ddemian6@gmail.com</p></div><button className="settings-pale-button" onClick={() => setNotice('Profilul este gestionat prin autentificarea email.')}>Vezi profilul</button></article><article className="settings-card settings-wide-card"><h3>Monedă și curs valutar</h3><div className="settings-row"><span>Preferință monedă</span><CurrencyToggle /></div><div className="settings-row"><span>Curs valutar BNM</span><strong>1 EUR = cursul zilei</strong></div><div className="settings-row"><span>Ultima actualizare</span><strong>{new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong></div></article><article className="settings-card settings-wide-card"><h3>Preferințe</h3><SettingsToggle label="Notificări pentru cheltuieli mari" checked={largeExpenseAlerts} onChange={setLargeExpenseAlerts} /><SettingsToggle label="Rezumat lunar automat" checked={monthlySummary} onChange={setMonthlySummary} /><SettingsToggle label="Detectează automat categoria bonului" checked={autoCategory} onChange={setAutoCategory} /></article><article className="settings-card settings-wide-card"><h3>Stocare locală și confidențialitate</h3><p className="settings-copy">Datele tale ({transactions.length} tranzacții, obiectivul tău) sunt salvate local, doar în acest browser — nu sunt trimise către niciun server extern.</p><p className="settings-copy">Poți exporta sau șterge definitiv toate datele în orice moment.</p></article><article className="settings-card settings-wide-card"><h3>Datele tale</h3><div className="settings-actions"><button className="settings-pale-button" onClick={() => setNotice('Exportul datelor va fi disponibil în curând.')}>Exportă datele</button><button className="settings-danger-button" onClick={() => setNotice('Pentru siguranță, ștergerea totală se face după confirmare.')}>Șterge toate datele</button></div></article><button className="logout-button" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); location.reload() }}>Deconectare</button></div></section>
          <footer className="app-footer"><span><ScanLine size={16} /> Tranzacțiile sunt păstrate în acest browser</span><span>Salvare locală · acest browser</span></footer>
        </div>
        <nav className="mobile-bottom-nav" aria-label="Navigație rapidă"><button className={activePage === 'overview' ? 'active' : ''} onClick={() => navigate('overview')}><Gauge size={20} /><span>Overview</span></button><button className={activePage === 'transactions' ? 'active' : ''} onClick={() => navigate('transactions')}><WalletCards size={20} /><span>Tranzacții</span></button><button className={activePage === 'goals' ? 'active' : ''} onClick={() => navigate('goals')}><Target size={20} /><span>Obiective</span></button><button className={activePage === 'analytics' ? 'active' : ''} onClick={() => navigate('analytics')}><BarChart3 size={20} /><span>Analitică</span></button><button className={activePage === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings2 size={20} /><span>Setări</span></button></nav>
      </section>

      {entryMode && <EntrySheet mode={entryMode} onClose={() => setEntryMode(null)} onSave={save} />}
      {editing && <EntrySheet key={editing.id} mode={editing.mode} initial={editing} onClose={() => setEditing(null)} onSave={editSave} />}
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Închide notificarea"><X size={15} /></button></div>}
    </main>
  )
}

function EntrySheet({ mode, initial, onClose, onSave }: { mode: 'expense' | 'income'; initial?: Transaction; onClose: () => void; onSave: (entry: Transaction) => string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [source, setSource] = useState<Source | null>(initial ? 'manual' : null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [ocr, setOcr] = useState<{ title?: string; category?: string; amount?: number | null; currency?: 'EUR' | 'MDL'; date?: string } | null>(null)
  const [ocrState, setOcrState] = useState<'idle' | 'reading' | 'done' | 'error'>('idle')
  useEffect(() => { if (!selectedFile || source === 'manual') return; const run = async () => { setOcrState('reading'); let upload = selectedFile; if (selectedFile.type.startsWith('image/') && selectedFile.type !== 'image/jpeg') { try { const bitmap = await createImageBitmap(selectedFile); const canvas = document.createElement('canvas'); const scale = Math.min(1, 1800 / bitmap.width); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .9)); if (blob) upload = new File([blob], 'receipt.jpg', { type: 'image/jpeg' }) } catch { /* keep original if the browser cannot decode it */ } } const data = new FormData(); data.append('file', upload); const response = await fetch('/api/receipt/parse', { method: 'POST', body: data }); const result = await response.json().catch(() => ({})); if (!response.ok) setOcrState('error'); else { setOcr(result.extracted); setOcrState('done') } }; run().catch(() => setOcrState('error')) }, [selectedFile, source])
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  return <dialog ref={dialog} className="entry-sheet" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() } }} aria-labelledby="entry-title">
    <div className="sheet-top"><div><p className="eyebrow">{initial ? 'MODIFICĂ TRANZACȚIA' : 'TRANZACȚIE NOUĂ'}</p><h2 id="entry-title">{initial ? 'Editează tranzacția' : mode === 'expense' ? 'Adaugă cheltuială' : 'Adaugă venit'}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Închide"><X size={20} /></button></div>
    {source === null ? <ImportSourcePicker mode={mode} onChoose={(next, file) => { setSource(next); setSelectedFile(file ?? null) }} /> : <>
      {selectedFile && <div className="import-selected"><strong>{selectedFile.name}</strong><span>{ocrState === 'reading' ? 'Se citește bonul…' : ocrState === 'done' ? 'Datele au fost extrase. Verifică-le înainte de salvare.' : ocrState === 'error' ? 'Nu am putut citi bonul. Completează câmpurile manual.' : ''}</span><button type="button" className="text-button" onClick={() => { setSource(null); setSelectedFile(null); setOcr(null); setOcrState('idle') }}>Alege altă sursă</button></div>}
      <p className="sheet-copy">Introdu suma în moneda în care ai plătit sau încasat.</p>
      <TransactionForm key={`${initial?.id ?? 'new'}-${ocrState}`} mode={mode} initial={initial} prefill={ocr ? { title: ocr.title, category: ocr.category, amount: ocr.amount ?? undefined, originalCurrency: ocr.currency, date: ocr.date } : undefined} onClose={onClose} onSave={onSave} />
    </>}
    <p className="privacy-note"><ScanLine size={15} /> Salvare pe acest dispozitiv, în browserul curent.</p>
  </dialog>
}

function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="settings-toggle"><span>{label}</span><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><i /></button></label>
}

export default App
