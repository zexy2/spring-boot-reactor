import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

const sourceFiles = ['src/**/*.{js,jsx}']
const nodeFiles = [
  'e2e/**/*.js',
  'tests/**/*.js',
  'scripts/**/*.{js,mjs}',
  '*.config.js',
]

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'output/**',
      'playwright-report/**',
      'test-results/**',
      'graphify-out/**',
      '.playwright-cli/**',
      '.codex-audit.mjs',
    ],
  },
  js.configs.recommended,
  {
    files: sourceFiles,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Keep the required correctness rules as a hard quality gate. The
      // compiler-oriented React 19 rules (refs, purity, set-state-in-effect,
      // etc.) require architectural migrations and are adopted separately.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: nodeFiles,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
]
