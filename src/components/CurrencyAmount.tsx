import { useExchange } from '../exchange'
import { formatMDL, shortDate, toMDL, type OriginalAmount } from '../fx'
import { money } from '../ledger'

export function useCurrencyFormat() {
  const { currency, rate, stale } = useExchange()
  return (cents: number, original?: OriginalAmount, prefix = '') => {
    if (currency === 'EUR') return { text: prefix + money(cents), title: 'Sumă în EUR' }
    const exact = original?.originalCurrency === 'MDL' && original.originalCents !== undefined
    const selectedRate = original?.fx ?? rate
    const mdl = exact ? original.originalCents! : selectedRate ? toMDL(cents, selectedRate) : null
    const title = exact ? `Suma originală achitată în MDL${original?.fx ? ` · Curs BNM ${shortDate(original.fx.date)}` : ''}` : selectedRate ? `Echivalent la cursul BNM din ${shortDate(selectedRate.date)}${!original?.fx && stale ? ' · ultimul curs disponibil' : ''}` : 'Cursul BNM este necesar pentru afișarea în MDL.'
    return { text: mdl === null ? 'MDL indisponibil' : `${exact ? '' : '≈ '}${prefix}${formatMDL(mdl)}`, title }
  }
}
export function CurrencyAmount({ cents, original, prefix = '' }: { cents: number; original?: OriginalAmount; prefix?: string }) {
  const format = useCurrencyFormat()
  const amount = format(cents, original, prefix)
  return <span className="currency-amount" title={amount.title}>{amount.text}</span>
}
