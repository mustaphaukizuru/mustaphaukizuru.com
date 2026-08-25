/**
 * test/helpers/ensureIndexHtml.js — Jest globalSetup / globalTeardown.
 *
 * The SPA-fallback and OG-injection tests exercise real request handling,
 * which reads `public/index.html`. That file is BUILD OUTPUT and is git-
 * ignored (the server rebuilds it on deploy), so a fresh checkout does not
 * have one — CI failed on seven tests that pass locally purely because a
 * developer's working copy happens to contain a previous build.
 *
 * So: if a real build is present, use it untouched. If not, write a minimal
 * stand-in with the handful of tags the middleware actually manipulates
 * (a <head> to inject meta into, a #root for the SPA), and delete it again
 * afterwards so the tests leave no trace.
 */
const fs = require("fs")
const path = require("path")

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public")
const INDEX = path.join(PUBLIC_DIR, "index.html")
const MARKER = path.join(PUBLIC_DIR, ".index-html-was-generated-by-tests")

const STUB = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mustapha Ukizuru</title>
    <meta name="description" content="Test stand-in for the built SPA shell." />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

module.exports = async function ensureIndexHtml() {
  if (fs.existsSync(INDEX)) return // real build output — leave it alone
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })
  fs.writeFileSync(INDEX, STUB)
  fs.writeFileSync(MARKER, "")
}

module.exports.teardown = async function removeGeneratedIndexHtml() {
  if (!fs.existsSync(MARKER)) return // we did not create it; do not remove it
  try { fs.unlinkSync(INDEX) } catch { /* already gone */ }
  try { fs.unlinkSync(MARKER) } catch { /* already gone */ }
}

module.exports.INDEX_PATH = INDEX
