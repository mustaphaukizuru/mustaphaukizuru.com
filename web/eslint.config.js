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
      globals: { ...globals.browser, __APP_VERSION__: "readonly", __APP_COMMIT__: "readonly" },
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
  // Vitest specs and the build scripts also run under Node, so `process`,
  // `console` and friends are real there. Some specs read the source tree to
  // assert a rule holds everywhere (src/i18n/i18nEnabled.test.js checks that
  // nobody reads VITE_I18N_ENABLED directly again), which needs cwd.
  {
    files: ['src/**/*.test.{js,jsx}', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/lib/api.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // T2-1 · the public tree must not import the raw router primitives.
  //
  // The site routes language by URL prefix and LanguageWrapper sets i18n's
  // language from that prefix on every navigation, so an unprefixed
  // `to="/services"` clicked from /es does not merely navigate — it switches
  // the whole interface back to English. About 150 links shipped that way,
  // which is why the Spanish translation reached almost nobody. The codemod
  // fixed the existing ones; this rule stops the next one.
  {
    // src/hooks and src/context are in the list too: a hook that calls the
    // raw useNavigate re-opens the hole from anywhere that calls the hook,
    // which is harder to spot than a Link in a page.
    files: [
      'src/pages/**/*.{js,jsx}',
      'src/components/**/*.{js,jsx}',
      'src/layout/**/*.{js,jsx}',
      'src/hooks/**/*.{js,jsx}',
      'src/context/**/*.{js,jsx}',
    ],
    ignores: [
      // The operator trees are NOT mirrored under /es, so a prefixed
      // operator link points at a route that does not exist.
      'src/pages/Admin*.jsx',
      'src/pages/Dashboard*.jsx',
      'src/components/admin/**',
      'src/layout/AdminLayout.jsx',
      'src/layout/DashboardLayout.jsx',
      // These own the primitives, or cross languages on purpose.
      'src/components/LocalizedLink.jsx',
      'src/components/LanguageWrapper.jsx',
      'src/components/LanguageSwitcher.jsx',
      '**/*.test.{js,jsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'react-router-dom',
          importNames: ['Link', 'NavLink', 'useNavigate'],
          message:
            'Use LocalizedLink / LocalizedNavLink from src/components/LocalizedLink, or ' +
            'useLocalizedNavigate from src/hooks/useLocalizedNavigate. A raw Link drops a ' +
            'Spanish reader back into English, because the language is read off the URL prefix. ' +
            'Everything else from react-router-dom (useLocation, Outlet, useParams…) is fine.',
        }],
      }],
    },
  },
])
