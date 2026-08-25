/**
 * scripts/og/fonts.mjs · make Sora available to sharp/librsvg.
 *
 * librsvg (what sharp uses to rasterise SVG) ignores @font-face, so text is
 * resolved through fontconfig only. WOFF2 files (web/public/fonts) cannot be
 * read by FreeType, so this module bundles the OFL-licensed static Sora TTFs
 * in scripts/og/fonts/ and writes a fonts.conf that lists that directory in
 * front of the OS font directories. FONTCONFIG_FILE must be set BEFORE sharp
 * is imported, so callers do `await setupFonts()` then `import("sharp")`.
 */
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const BUNDLED_FONT_DIR = path.join(__dirname, "fonts")

const toPosix = (p) => p.replace(/\\/g, "/")

function systemFontDirs() {
  const dirs = []
  if (process.platform === "win32") {
    dirs.push(path.join(process.env.WINDIR || "C:/Windows", "Fonts"))
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, "Microsoft/Windows/Fonts"))
  } else if (process.platform === "darwin") {
    dirs.push("/System/Library/Fonts", "/Library/Fonts", path.join(os.homedir(), "Library/Fonts"))
  } else {
    dirs.push("/usr/share/fonts", "/usr/local/share/fonts", path.join(os.homedir(), ".fonts"), path.join(os.homedir(), ".local/share/fonts"))
  }
  return dirs
}

/** Writes a fonts.conf and points FONTCONFIG_FILE at it (unless already set). */
export async function setupFonts() {
  if (process.env.FONTCONFIG_FILE) return { confPath: process.env.FONTCONFIG_FILE, preset: true }
  const cacheDir = path.join(os.tmpdir(), "mu-og-fontconfig")
  await fs.mkdir(cacheDir, { recursive: true })
  const dirs = [BUNDLED_FONT_DIR, ...systemFontDirs()].map((d) => `  <dir>${toPosix(d)}</dir>`).join("\n")
  const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
${dirs}
  <cachedir>${toPosix(path.join(cacheDir, "cache"))}</cachedir>
  <alias><family>Sora</family><default><family>sans-serif</family></default></alias>
</fontconfig>
`
  const confPath = path.join(cacheDir, "fonts.conf")
  await fs.writeFile(confPath, conf, "utf8")
  process.env.FONTCONFIG_FILE = confPath
  return { confPath, preset: false }
}

/**
 * Renders the same word in "Sora" and in a family that cannot exist, then
 * compares the lit-pixel counts. Identical output means Sora was NOT found
 * and fontconfig substituted a generic sans — callers should warn.
 */
export async function probeSora(sharp) {
  const svg = (family) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="100"><rect width="480" height="100" fill="#000"/>` +
    `<text x="10" y="70" font-family="${family}" font-weight="800" font-size="56" fill="#fff">Sora Wg 123</text></svg>`
  const lit = async (family) => {
    const { data } = await sharp(Buffer.from(svg(family))).raw().toBuffer({ resolveWithObject: true })
    let n = 0
    for (let i = 0; i < data.length; i += 3) if (data[i] > 200) n++
    return n
  }
  const [sora, fallback] = await Promise.all([lit("Sora"), lit("NoSuchFamily__mu_probe")])
  return { ok: sora > 0 && sora !== fallback, soraPixels: sora, fallbackPixels: fallback }
}
