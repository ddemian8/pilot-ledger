import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ExchangeProvider } from './exchange'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExchangeProvider><App /></ExchangeProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
