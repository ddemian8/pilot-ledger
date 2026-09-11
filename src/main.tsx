import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ExchangeProvider } from './exchange'
import './index.css'
import { AuthGate } from './auth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExchangeProvider><AuthGate><App /></AuthGate></ExchangeProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
