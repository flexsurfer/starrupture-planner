import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const root = new URL('../', import.meta.url)
const env = loadEnv('deploy', fileURLToPath(root), 'CLOUDFLARE_WEB_ANALYTICS_TOKEN')
const token = env.CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim()

if (!token || !/^[a-f0-9]{32}$/i.test(token)) {
  throw new Error('Set CLOUDFLARE_WEB_ANALYTICS_TOKEN in .env.deploy.local or your environment to your 32-character Cloudflare Web Analytics token before deploying.')
}

const indexPath = new URL('dist/index.html', root)
const html = readFileSync(indexPath, 'utf8')
if (!html.includes('</body>')) {
  throw new Error('Cannot inject Cloudflare Web Analytics: dist/index.html is missing </body>.')
}

const beacon = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token })}'></script>`
writeFileSync(indexPath, html.replace('</body>', `${beacon}\n  </body>`))
