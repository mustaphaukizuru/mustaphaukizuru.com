/**
 * eslint.server.config.mjs · the gate the backend never had (D0-3)
 *
 * WHY THIS EXISTS
 *
 * `web/` has six lint gates. `src/` had none — not one. The only automated
 * check on the backend was `node --check`, which parses syntax and knows
 * nothing about whether an identifier resolves.
 *
 * So this shipped, in T5-5, and survived four more commits and 1873 passing
 * tests:
 *
 *     const locale = resolveUserLocale({ req, user: req.user })   // never imported
 *
 * Four call sites, zero imports, and four member endpoints answering 500 in
 * production terms — `/member/projects/:id/events`, `/file-requests`,
 * `/time` and the statement PDF. The tests passed because none of them loads
 * that controller and invokes those handlers, and the SPA swallowed the
 * failures (see useProjectPanels), so the client saw empty panels rather
 * than an error. A one-line import would have been caught by `no-undef` in
 * under a second.
 *
 * DELIBERATELY NARROW
 *
 * This is not a style config and must not become one. The backend has 25k
 * lines written against no linter; turning on a recommended preset would
 * produce hundreds of findings, the run would be ignored, and the gate would
 * be worth nothing. What is enabled is the small set that catches code which
 * is WRONG rather than untidy:
 *
 *   no-undef                  the bug above
 *   no-dupe-keys              a second `where:` silently wins
 *   no-dupe-args              same for parameters
 *   no-unreachable            code after a return, usually a bad merge
 *   no-cond-assign            `if (x = 1)`
 *   no-constant-condition     `if (someFn)` instead of `if (someFn())`
 *   no-self-compare           `x === x`
 *   no-unsafe-negation        `!key in obj`
 *   no-dupe-else-if           a branch that can never run
 *   no-sparse-arrays          `[a, , b]`, always a typo
 *   no-func-assign            reassigning a declared function
 *   no-import-assign          same for imports
 *   no-obj-calls              `Math()`
 *   no-unused-vars            args-after-used only: an unused REQUIRE is
 *                             usually a deleted feature's leftover, and an
 *                             unused variable is usually a rename that did
 *                             not finish. Caught args are exempt because
 *                             `catch (e) { }` is a deliberate idiom here.
 *   require-atomic-updates    off — too many false positives on await in
 *                             loops, which this codebase does on purpose.
 *
 * Adding a rule to this list is a decision, and the comment above is the
 * place to record why.
 */
export default [
  {
    files: ["src/**/*.js", "prisma/*.js", "scripts/**/*.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        // CommonJS
        require: "readonly", module: "writable", exports: "writable",
        __dirname: "readonly", __filename: "readonly",
        // Node
        process: "readonly", console: "readonly", Buffer: "readonly",
        global: "readonly", globalThis: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly",
        setInterval: "readonly", clearInterval: "readonly",
        setImmediate: "readonly", clearImmediate: "readonly",
        queueMicrotask: "readonly", structuredClone: "readonly",
        performance: "readonly", crypto: "readonly",
        // Web-standard globals Node has had since 18
        URL: "readonly", URLSearchParams: "readonly",
        TextEncoder: "readonly", TextDecoder: "readonly",
        AbortController: "readonly", AbortSignal: "readonly",
        fetch: "readonly", Headers: "readonly", Request: "readonly",
        Response: "readonly", FormData: "readonly", Blob: "readonly",
        Event: "readonly", EventTarget: "readonly",
        // Jest, for the test/ glob
        jest: "readonly", describe: "readonly", test: "readonly", it: "readonly",
        expect: "readonly", beforeAll: "readonly", afterAll: "readonly",
        beforeEach: "readonly", afterEach: "readonly",
      },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-dupe-else-if": "error",
      "no-unreachable": "error",
      // "except-parens", not "always": `while ((m = re.exec(s)) !== null)` is
      // the correct way to walk a global regex and this codebase uses it.
      // What stays caught is the bare `if (x = 1)`.
      "no-cond-assign": ["error", "except-parens"],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-self-compare": "error",
      "no-unsafe-negation": "error",
      "no-sparse-arrays": "error",
      "no-func-assign": "error",
      "no-import-assign": "error",
      "no-obj-calls": "error",
      "no-unused-vars": ["error", {
        args: "after-used",
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none",
      }],
    },
  },
]
