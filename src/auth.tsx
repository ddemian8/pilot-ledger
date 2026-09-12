import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

const ADMIN_EMAIL = 'ddemian6@gmail.com'

export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  useEffect(() => {
    if (location.hostname.endsWith('.workers.dev')) { location.replace(`https://pilot-ledger.download${location.pathname}${location.search}`); return }
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => setAuthenticated(Boolean(data.session))).finally(() => setReady(true))
      const listener = supabase.auth.onAuthStateChange((_event, session) => setAuthenticated(Boolean(session)))
      return () => listener.data.subscription.unsubscribe()
    }
    fetch('/api/me', { cache: 'no-store' }).then(response => setAuthenticated(response.ok)).catch(() => {}).finally(() => setReady(true))
  }, [])
  if (!ready) return <div className="auth-shell"><div className="auth-card"><strong>Pilot Ledger</strong><p>Se verifică sesiunea…</p></div></div>
  if (authenticated) return <>{children}</>
  const request = async () => {
    setBusy(true); setError('')
    if (supabase) {
      const address = email.trim().toLowerCase()
      if (!/^\S+@\S+\.\S+$/.test(address)) { setBusy(false); setError('Introdu o adresă de email validă.'); return }
      const response = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin } })
      setBusy(false); if (response.error) setError(response.error.message); else setCodeSent(true); return
    }
    const response = await fetch('/api/auth/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ADMIN_EMAIL }) })
    const data = await response.json().catch(() => ({})); setBusy(false)
    if (!response.ok) setError(data.error ?? 'Nu am putut trimite codul.')
    else setCodeSent(true)
  }
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    if (supabase) {
      const response = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' })
      setBusy(false); if (response.error) setError(response.error.message); else setAuthenticated(true); return
    }
    const response = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ADMIN_EMAIL, code }) })
    const data = await response.json().catch(() => ({})); setBusy(false)
    if (!response.ok) setError(data.error ?? 'Cod invalid.')
    else setAuthenticated(true)
  }
  return <div className="auth-shell"><div className="auth-card"><div className="auth-logo">✦</div><p className="eyebrow">PILOT LEDGER</p><h1>Conectează-te prin email</h1><p className="muted">Îți trimitem un cod de acces pe email.</p>{!codeSent ? <><label className="auth-label" htmlFor="auth-email">Email</label><input id="auth-email" className="auth-input auth-email-input" type="email" autoComplete="email" value={supabase ? email : ADMIN_EMAIL} onChange={event => setEmail(event.target.value)} disabled={!supabase} placeholder="nume@exemplu.com" /><button className="auth-primary" onClick={request} disabled={busy}>{busy ? 'Se trimite…' : 'Trimite codul pe email'}</button></> : <form onSubmit={verify}><label className="auth-label" htmlFor="auth-code">Cod de 6 cifre</label><input id="auth-code" className="auth-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} autoFocus /><button className="auth-primary" disabled={busy || code.length !== 6}>{busy ? 'Se verifică…' : 'Conectare'}</button><button type="button" className="auth-link" onClick={() => { setCodeSent(false); setError('') }}>Retrimite codul</button></form>}{error && <p className="form-error" role="alert">{error}</p>}</div></div>
}
