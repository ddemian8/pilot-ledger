import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname, sep } from 'node:path'
import { exchangeEndpoint } from './bnm.ts'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/api/exchange-rate') { await exchangeEndpoint(req, res); return }
    if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(405).end(); return }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return }
    const body = await readFile(path)
    res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', url.pathname.startsWith('/assets/') && /-[\w-]{8}\./.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache')
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch { res.writeHead(404).end('Not found') }
})
server.listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? '127.0.0.1', () => console.log('Pilot Ledger server ready'))
