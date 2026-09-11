import { useEffect, useRef, useState } from 'react'
import NeonBorder from './NeonBorder'

// Integration settings live here; the supplied Originkit component stays unchanged.
export function GoalNeonBorder() {
  const container = useRef<HTMLDivElement>(null)
  const [rounded, setRounded] = useState(9)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect()
      const shortest = Math.min(width, height)
      if (shortest > 0) setRounded(Math.min(100, 2600 / shortest))
    })
    observer.observe(element)
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', updateMotion)
    return () => { observer.disconnect(); preference.removeEventListener('change', updateMotion) }
  }, [])

  return <div className="goal-neon-border" ref={container} aria-hidden="true">
    <NeonBorder color="#8a72c5" rounded={rounded} thickness={3} borderSize={50} glow={45} movement="continuous" speed={reducedMotion ? 0 : 12} />
  </div>
}
