import { useExchange } from '../exchange'
import { shortDate } from '../fx'
export function CurrencyToggle() {
  const { currency, setCurrency, stale, rate, error, loading } = useExchange()
  return <div className="currency-switch"><div className="currency-toggle" role="group" aria-label="Moneda de afișare">{(['EUR', 'MDL'] as const).map(option => <button key={option} type="button" aria-pressed={currency === option} onClick={() => setCurrency(option)}>{option}</button>)}</div>{currency === 'MDL' && (stale || error) && <small role="status">{rate ? `Curs salvat: ${shortDate(rate.date)}` : loading ? 'Se încarcă cursul…' : 'Curs MDL indisponibil'}</small>}</div>
}
