import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const dist = resolve('dist')
const canonical = 'https://zexy2.github.io/spring-boot-reactor/'
const expectedFiles = [
  'icon.svg',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest',
  'robots.txt',
  'sitemap.xml',
  'social-card.png',
]

const fail = (message) => {
  throw new Error(`Web metadata check failed: ${message}`)
}

const html = await readFile(resolve(dist, 'index.html'), 'utf8')
const requiredHtml = [
  `rel="canonical" href="${canonical}"`,
  'rel="manifest" href="/spring-boot-reactor/manifest.webmanifest"',
  `property="og:url" content="${canonical}"`,
  `property="og:image" content="${canonical}social-card.png"`,
  'name="twitter:card" content="summary_large_image"',
  `name="twitter:image" content="${canonical}social-card.png"`,
]

for (const fragment of requiredHtml) {
  if (!html.includes(fragment)) fail(`index.html is missing ${fragment}`)
}

for (const file of expectedFiles) {
  const info = await stat(resolve(dist, file)).catch(() => null)
  if (!info?.isFile() || info.size === 0) fail(`${file} is missing or empty`)
}

const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.webmanifest'), 'utf8'))
if (manifest.name !== 'Java Backend Öğrenme Atölyesi') fail('manifest name is unexpected')
if (manifest.start_url !== './' || manifest.scope !== './') fail('manifest start_url/scope must stay relative for GitHub Pages')
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) fail('manifest icons are incomplete')

const png = await readFile(resolve(dist, 'social-card.png'))
if (png.length < 24 || png.toString('ascii', 1, 4) !== 'PNG') fail('social-card.png is not a PNG')
const width = png.readUInt32BE(16)
const height = png.readUInt32BE(20)
if (width !== 1200 || height !== 630) fail(`social-card.png must be 1200x630, got ${width}x${height}`)

const robots = await readFile(resolve(dist, 'robots.txt'), 'utf8')
if (!robots.includes(`${canonical}sitemap.xml`)) fail('robots.txt does not reference the production sitemap')

const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8')
if (!sitemap.includes(`<loc>${canonical}</loc>`)) fail('sitemap.xml does not contain the canonical URL')

console.log(`Web metadata verified: ${expectedFiles.length} public assets + canonical/social metadata.`)
