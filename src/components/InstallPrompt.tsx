import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

type DeferredPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pilot-ledger.install-dismissed') === '1')
  const [iosHelp, setIosHelp] = useState(false)
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

  useEffect(() => {
    const onInstall = (event: Event) => { event.preventDefault(); setDeferred(event as DeferredPrompt) }
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => window.removeEventListener('beforeinstallprompt', onInstall)
  }, [])

  if (isStandalone || dismissed || (!deferred && !isIos)) return null
  const install = async () => {
    if (deferred) { await deferred.prompt(); const choice = await deferred.userChoice; if (choice.outcome === 'accepted') setDismissed(true) }
    else setIosHelp(true)
  }
  return <div className="install-prompt" role="dialog" aria-label="Instalează Pilot Ledger"><div className="install-prompt-icon"><Download size={19} /></div><div className="install-prompt-copy"><strong>Instalează Pilot Ledger</strong><span>Accesează aplicația direct de pe ecranul telefonului.</span></div><button className="install-button" onClick={install}>Instalează</button><button className="install-close" aria-label="Închide" onClick={() => { setDismissed(true); localStorage.setItem('pilot-ledger.install-dismissed', '1') }}><X size={16} /></button>{iosHelp && <div className="ios-help">Apasă butonul <strong>Partajare</strong> din Safari, apoi alege <strong>Adaugă la ecranul principal</strong>.</div>}</div>
}
