import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { exchangeEndpoint } from './server/bnm.ts'

const bnmPlugin = (): Plugin => ({
  name: 'pilot-ledger-bnm',
  configureServer(server) { server.middlewares.use('/api/exchange-rate', (req, res) => { void exchangeEndpoint(req, res) }) },
  configurePreviewServer(server) { server.middlewares.use('/api/exchange-rate', (req, res) => { void exchangeEndpoint(req, res) }) },
})
export default defineConfig({ plugins: [react(), bnmPlugin()] })
