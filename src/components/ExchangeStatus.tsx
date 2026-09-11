import { RefreshCw } from 'lucide-react'
import { useExchange } from '../exchange'
import { rateLabel, shortDate } from '../fx'
export function ExchangeStatus() {
  const { rate, loading, error, stale, refresh } = useExchange()
  return <aside className="exchange-status" aria-label="Curs EUR MDL"><div role="status"><strong>{rate ? `1 EUR = ${rateLabel(rate)} MDL` : loading ? 'Se încarcă cursul BNM…' : 'Curs BNM indisponibil'}</strong><span>{rate ? `${stale ? 'Ultimul curs disponibil' : 'Curs oficial BNM'} · ${shortDate(rate.date)}` : 'Conversiile MDL necesită un curs verificat.'}</span>{error && <span className="exchange-warning">{error}</span>}</div><button type="button" disabled={loading} onClick={refresh} aria-label="Actualizează cursul BNM"><RefreshCw size={15} /></button><p>Echivalente orientative la cursul <a href="https://www.bnm.md/ro/content/ratele-de-schimb" target="_blank" rel="noreferrer">BNM</a>. Cursul băncii la plată poate diferi.</p></aside>
}
