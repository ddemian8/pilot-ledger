import LiquidGlassButton from './LiquidGlassButton'

type Props = { mode: 'expense' | 'income'; onActivate: () => void }

export function GlassAction({ mode, onActivate }: Props) {
  const label = mode === 'expense' ? 'Adaugă\nCheltuială' : 'Adaugă\nVenituri'
  const icon = mode === 'expense' ? '/assets/receipt.png' : '/assets/sales-performance.png'

  // The original component has no onClick prop. Its native button's click bubbles
  // here for pointer, Enter and Space activation without changing the source.
  return <div className={`glass-action glass-action-${mode}`} onClick={event => {
    if (event.target instanceof Element && event.target.closest('button')) onActivate()
  }}>
    <LiquidGlassButton
      label={label}
      font={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 'clamp(13px, 3.38vw, 18.2px)', letterSpacing: '-.02em', whiteSpace: 'pre-line', lineHeight: 1.5, textAlign: 'center' }}
      padding="12px 6px"
      rounded={30}
      colors={{ fill: '#FFFFFF', textColor: '#f7f8f4' }}
      addIcon
      icon={{ side: 'left', size: 24, image: icon, padding: 7, rounded: 30 }}
      gap={12}
      stroke={{ type: 'gradient', angle: 160, width: 2, colorA: 'rgba(255, 255, 255, 0.65)', colorB: 'rgba(255, 255, 255, 0.18)' }}
      style={{ width: '100%', minWidth: 0, height: '100%', minHeight: 0, boxShadow: '0 6px 18px rgba(23,35,30,.1)' }}
    />
  </div>
}
