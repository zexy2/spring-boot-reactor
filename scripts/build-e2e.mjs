import { build } from 'vite'

// Browser tests exercise the deployed GitHub Pages path, not an old local dist.
process.env.DEPLOY_GITHUB_PAGES = 'true'
await build()
