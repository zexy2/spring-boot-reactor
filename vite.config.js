import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.DEPLOY_GITHUB_PAGES === 'true' ? '/spring-boot-reactor/' : '/',
  build: {
    rolldownOptions: {
      onLog(level, log, defaultHandler) {
        const source = String(log.id ?? log.loc?.file ?? '').replaceAll('\\', '/')
        const isFramerMotionClientDirective =
          level === 'warn' &&
          log.code === 'MODULE_LEVEL_DIRECTIVE' &&
          source.includes('/node_modules/framer-motion/')

        if (isFramerMotionClientDirective) return
        defaultHandler(level, log)
      },
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'curriculum',
              test: /src\/data\/curriculum\.js$/,
              priority: 40,
            },
            {
              name: 'motion',
              test: /node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//,
              priority: 20,
            },
            {
              name: 'react',
              test: /node_modules\/(react|react-dom|scheduler)\//,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
