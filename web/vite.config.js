import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

// SEO07 · Bundle treemap behind ANALYZE=true. Optional dev dep:
//   npm install --save-dev rollup-plugin-visualizer
// Then: ANALYZE=true npm run build  → opens stats.html in dist/.
async function loadVisualizerPlugin() {
  if (process.env.ANALYZE !== "true") return null
  try {
    const mod = await import("rollup-plugin-visualizer")
    return mod.visualizer({ filename: "dist/stats.html", open: false, gzipSize: true, brotliSize: true })
  } catch {
    console.warn("[vite] rollup-plugin-visualizer not installed; ANALYZE=true is a no-op")
    return null
  }
}
const visualizerPlugin = await loadVisualizerPlugin()

const GA_ID = process.env.VITE_GA_MEASUREMENT_ID || ""

// SEO04 · index.html replaces __GA_MEASUREMENT_ID__ at build time so the
// gtag bootstrap can early-return when the var is unset (dev / preview).
function gaIdReplacePlugin() {
  return {
    name: "ga-id-replace",
    transformIndexHtml(html) {
      return html.replace(/__GA_MEASUREMENT_ID__/g, GA_ID)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    gaIdReplacePlugin(),
    ...(visualizerPlugin ? [visualizerPlugin] : []),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,                              // we already ship public/site.webmanifest
      includeAssets: [
        "favicon.ico", "favicon.svg", "favicon-96x96.png",
        "apple-touch-icon.png",
        "web-app-manifest-192x192.png",
        "web-app-manifest-512x512.png",
        "site.webmanifest",
        "robots.txt", "sitemap.xml",
        "fonts/Sora-Variable.woff2",
        "fonts/JetBrainsMono-Variable.woff2",
      ],
      workbox: {
        // PERF · precache only what the shell needs. Raster images (portfolio
        // screenshots, profile photos, certificates) and admin-only route
        // chunks are fetched on demand and cached by the runtime rules
        // below — they must NOT be downloaded by every anonymous visitor.
        // Before this change the precache was 215 entries / 18.8 MB.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: [
          "**/node_modules/**",
          "assets/Admin*",          // admin route chunks — admins only
          "assets/SelfAudit*",
          "assets/pdf*",            // pdfjs + worker, lazy on cert preview
          "images/**",
          "documents/**",
          "og/**",
          "cv/**",
        ],
        // Default 2 MiB precache cap. The previous 3 MiB override was a
        // workaround for the 2.38 MB avatar-master.png; that source PNG
        // (and its 5 colour siblings) have since been compressed via
        // scripts/compress-avatars.mjs from 2000×2000 / ~2.3 MB to
        // 400×400 / ~35 KB PNG (+ 14 KB WebP sibling), so the standard
        // cap is now correct. If any future asset exceeds 2 MiB it
        // should be optimised before raising this ceiling again.
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        runtimeCaching: [
          // ── API: network-first for PUBLIC catalogue reads only ──
          // SECURITY · never cache authenticated responses (/auth/me, orders,
          // dashboard, admin). A shared device going offline after logout
          // must not replay the previous user's data from Cache Storage.
          // The allowlist is public GET catalogue data only; lib/api.js
          // also deletes this cache on logout.
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              url.origin === self.location.origin &&
              /^\/api\/(v1\/)?(products|services|portfolio|blog|bio|recommendations|reviews)(\/|$)/.test(url.pathname) &&
              !request.headers.has("Authorization"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 10 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // ── Images: cache-first, 30 days ──
          {
            urlPattern: /\/images\/.*\.(webp|jpg|jpeg|png|svg|gif|avif)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Fonts: cache-first, 1 year ──
          {
            urlPattern: /\/fonts\/.*\.woff2$/,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── OG / static assets ──
          {
            urlPattern: /\/og\/.*$/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "og-cache" },
          },
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/admin/,
          /^\/images\/products\//,
          /^\/documents\//,
          /^\/cv\//,          // CV PDFs — must be served directly, not by SW
          /\.pdf$/i,          // any .pdf URL anywhere on the site
          /^\/files\//,       // download endpoints
          /^\/fonts\//,       // static font files
          /^\/og\//,          // open-graph images
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },               // SW off in dev to avoid caching confusion
    }),
  ],

  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Dev-only: user uploads (avatars, blog/media covers) are stored under
    // storage/ and served by the Express API on :5000 — not by Vite. Forward
    // those specific /images/* prefixes to the backend so the relative URLs
    // stored in the database resolve from the Vite origin during development.
    // In production the backend serves the SPA and these paths from one
    // origin, so no proxy is needed. Target matches VITE_API_BASE_URL.
    proxy: {
      "/images/media":   { target: "http://localhost:5000", changeOrigin: true },
      "/images/avatars": { target: "http://localhost:5000", changeOrigin: true },
    },
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
    /**
     * HMR explicit config · solves the "WebSocket connection failed" error
     * the dev console was showing. Default Vite HMR auto-detects the host
     * from the page origin, but when the dev server binds to 0.0.0.0 (so
     * it's reachable from other devices on the LAN) some browsers compute
     * the wrong WebSocket host. Pinning the HMR client host to localhost
     * keeps HMR working in the local browser; LAN clients hitting the dev
     * server by IP fall back to full-reload mode, which is the right
     * trade-off for occasional cross-device testing.
     *
     * Do NOT pin `port`/`clientPort` here: a hard-coded port makes any
     * second dev instance (e.g. `--port 5273`) spawn a *dedicated* HMR
     * WebSocket server on 5173 alongside the real one. Windows allows the
     * double-bind, and browsers resolving localhost to ::1 then hit the
     * WebSocket listener and render "426 Upgrade Required" instead of the
     * app. Without an explicit port, the HMR socket rides the dev server's
     * own port — correct on 5173, 5273, or anywhere else.
     */
    hmr: {
      host:     "localhost",
      protocol: "ws",
    },
  },

  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },

  build: {
    // Build directly into root/public so Express can serve the frontend
    outDir: "../public",
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 500,
    // CWV · assets ≤1 KB inline as base64 data URIs; assets >1 KB ship as
    // separate cacheable files. Vite's default 4 KB threshold inlined a
    // surprising amount into the JS bundle (small SVGs, button icons),
    // bloating the per-route bundle on first load AND defeating CDN-level
    // caching when those bytes never change. 1 KB keeps tiny placeholder
    // SVGs inline (where the network round-trip would dominate) without
    // letting medium icons bleed into the JS bundle.
    assetsInlineLimit: 1024,
    rollupOptions: {
      output: {
        /**
         * Manual chunk strategy — keep React + React-DOM + scheduler in a
         * single bundle to avoid the cycle that `react-dom` ↔ `vendor` was
         * producing. Splitting React into its own chunk while leaving the
         * rest in `vendor` made `vendor` import `react` and made `react-dom`
         * import `vendor` for its scheduler internals — Rollup flagged that
         * as a circular chunk warning.
         *
         * Group the React runtime together; route every other framework
         * library into its own well-named chunk; everything else lands in
         * `vendor`. The check order matters — more specific matches first.
         *
         * PERFORMANCE FIX · vendor chunk was 570kB because the catch-all
         * `node_modules → vendor` rule was scooping up:
         *   · pdfjs-dist (~400kB) — only used via dynamic import in
         *     CertificatePreview; should ship as its own lazy chunk so
         *     visitors who never open a cert preview don't pay the cost.
         *   · i18next + react-i18next + language-detector (~150kB combined)
         *     — used everywhere via useTranslation hooks; their own chunk
         *     makes vendor leaner and keeps i18n updates from invalidating
         *     the entire vendor cache.
         *   · lenis · sonner · react-helmet-async — small enough to leave
         *     in `vendor`, but flagged here for future tuning.
         */
        manualChunks(id) {
          // PERF · I18N01 · one chunk per locale. src/i18n/resources.js only
          // ever reaches resources.<lang>.js through import(), so these are
          // pure lazy chunks: a visitor downloads the active language only,
          // and the other one arrives on first language switch. Naming them
          // explicitly keeps the split deterministic (and greppable in the
          // build output) instead of relying on Rollup's default grouping.
          if (/[\\/]src[\\/]i18n[\\/](locales[\\/]en[\\/]|resources\.en\.js)/.test(id)) return "locale-en"
          if (/[\\/]src[\\/]i18n[\\/](locales[\\/]es[\\/]|resources\.es\.js)/.test(id)) return "locale-es"
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-vendor"
          if (id.includes("node_modules/react-router"))               return "router"
          // framer-motion: no manual chunk — LazyMotion (src/components/motion/
          // MotionProvider) async-loads the domMax feature bundle, and pinning the
          // whole package into one chunk would drag it back into the critical path.
          if (id.includes("node_modules/framer-motion"))              return undefined
          // gsap + ScrollTrigger: own chunk, only reached via dynamic import()
          // from components/motion/scroll/useScrollNarrative (Home process,
          // case studies) — admin/dashboard bundles never pull it.
          if (id.includes("node_modules/gsap"))                       return "gsap"
          if (id.includes("node_modules/lucide-react"))               return "lucide"
          // react-icons is deliberately NOT pinned to a shared chunk. It is
          // used by exactly five files, all brand/tech logos on About and the
          // tech-stack strips. Forcing it into one "icons" chunk made every
          // page download it — Lighthouse measured 24 kB with 23 kB unused on
          // /terms. Returning undefined HERE (before the node_modules
          // catch-all below, which would otherwise sweep it into "vendor" —
          // just as global) hands placement back to Rollup, which puts the
          // glyphs in the route chunks that actually render them.
          if (id.includes("node_modules/react-icons"))                return undefined
          // zod is used ONLY by the admin form schemas (lib/validation/**) and
          // hooks/useForm, and every admin page is React.lazy'd. The
          // node_modules catch-all below was pinning it into "vendor", so a
          // visitor reading /terms downloaded and parsed the whole validation
          // library for nothing. Same treatment: let Rollup put it in the
          // admin chunks that import it.
          if (id.includes("node_modules/zod"))                        return undefined
          if (id.includes("node_modules/pdfjs-dist"))                 return "pdfjs"
          if (id.includes("node_modules/i18next") ||
              id.includes("node_modules/react-i18next"))              return "i18n"
          if (id.includes("node_modules"))                            return "vendor"
        },
      },
    },
  },

  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "framer-motion",
      "lucide-react",
    ],
  },
})