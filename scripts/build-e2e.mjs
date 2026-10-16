import { build } from 'vite'

// Browser tests exercise the deployed GitHub Pages path, not an old local dist.
process.env.DEPLOY_GITHUB_PAGES = 'true'
process.env.VITE_E2E_TEST_HOOKS = 'true'
await build()
