import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

const KiB = 1024
const assetsDir = join(process.cwd(), 'dist', 'assets')

function readBudget(name, fallback) {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback

  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number, received: ${raw}`)
  }

  return value
}

const budgets = {
  js: readBudget('BUNDLE_MAX_JS_GZIP_KIB', 170),
  css: readBudget('BUNDLE_MAX_CSS_GZIP_KIB', 70),
  total: readBudget('BUNDLE_MAX_TOTAL_GZIP_KIB', 720),
}

async function collectAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectAssets(path))
    } else if (entry.isFile() && /\.(?:js|css)$/.test(entry.name)) {
      files.push(path)
    }
  }

  return files
}

let assetFiles
try {
  assetFiles = await collectAssets(assetsDir)
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.error('Bundle budget failed: dist/assets does not exist. Run npm run build first.')
    process.exit(1)
  }
  throw error
}

if (assetFiles.length === 0) {
  console.error('Bundle budget failed: no .js or .css assets found in dist/assets.')
  process.exit(1)
}

const measurements = []
for (const file of assetFiles) {
  const source = await readFile(file)
  const gzipKiB = gzipSync(source).byteLength / KiB
  measurements.push({
    file: relative(process.cwd(), file),
    type: file.endsWith('.css') ? 'css' : 'js',
    gzipKiB,
  })
}

measurements.sort((a, b) => b.gzipKiB - a.gzipKiB)

const violations = measurements.filter((asset) => {
  const limit = asset.type === 'css' ? budgets.css : budgets.js
  return asset.gzipKiB > limit
})
const totalGzipKiB = measurements.reduce((sum, asset) => sum + asset.gzipKiB, 0)

console.log(`Bundle budget: ${measurements.length} JS/CSS assets, ${totalGzipKiB.toFixed(2)} KiB gzip total (limit ${budgets.total} KiB).`)
for (const asset of measurements.slice(0, 8)) {
  const limit = asset.type === 'css' ? budgets.css : budgets.js
  console.log(`- ${asset.file}: ${asset.gzipKiB.toFixed(2)} KiB gzip (limit ${limit} KiB)`)
}

if (totalGzipKiB > budgets.total) {
  violations.push({
    file: 'TOTAL JS/CSS',
    gzipKiB: totalGzipKiB,
    limit: budgets.total,
  })
}

if (violations.length > 0) {
  console.error('Bundle budget exceeded:')
  for (const violation of violations) {
    const limit = violation.limit ?? (violation.type === 'css' ? budgets.css : budgets.js)
    console.error(`- ${violation.file}: ${violation.gzipKiB.toFixed(2)} KiB gzip > ${limit} KiB`)
  }
  process.exit(1)
}

console.log('Bundle budget passed.')
