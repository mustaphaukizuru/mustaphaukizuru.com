import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'bot.js']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { react },
    rules: {
      // `react/jsx-uses-vars` teaches `no-unused-vars` that a binding rendered
      // as JSX (`<motion.div>`, `<Icon/>`) counts as used. Without it the flat
      // config flagged every framer-motion `motion` import and icon-component
      // prop as "unused" — ~15 false positives that buried the real ones.
      // We enable ONLY this rule, not the full react/recommended set, to avoid
      // introducing a flood of unrelated new errors.
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      // Phase 9.3 · ban raw `fetch(` calls outside the centralized API layer.
      // Every customer/admin request must go through `authFetch` (auth) or
      // `apiRequest` (public) from src/lib/api.js so we get a uniform error
      // taxonomy, AppError mapping, /api/v1 path upgrade, FormData / Blob
      // handling, and the auth:session-expired side-effect on 401s.
      //
      // src/lib/api.js itself is the implementation — exempted via the
      // per-file override below.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            'Use authFetch / apiRequest from src/lib/api.js — see Phase 9.3 (PR #21). ' +
            'These centralize auth headers, /api/v1 upgrade, FormData handling, and 401 session-expired flow.',
        },
      ],
    },
  },
  // The API wrapper itself MUST use raw fetch — that's literally the only
  // place where it lives. Per-file rules override the global ban above.
  // Vite config runs under Node - `process` etc. are real globals there.
  {
    files: ['vite.config.js', 'playwright.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/lib/api.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
])
