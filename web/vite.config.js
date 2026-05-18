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
        globPatterns: ["**/*.{js,css,html,png,svg,webp,woff2}"],
        // Default 2 MiB precache cap. The previous 3 MiB override was a
        // workaround for the 2.38 MB avatar-master.png; that source PNG
        // (and its 5 colour siblings) have since been compressed via
        // scripts/compress-avatars.mjs from 2000×2000 / ~2.3 MB to
        // 400×400 / ~35 KB PNG (+ 14 KB WebP sibling), so the standard
        // cap is now correct. If any future asset exceeds 2 MiB it
        // should be optimised before raising this ceiling again.
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        runtimeCaching: [
          // ── API: network-first, fall back to short-lived cache for offline reads ──
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
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
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
    /**
     * HMR explicit config · solves the "WebSocket connection failed" error
     * the dev console was showing. Default Vite HMR auto-detects the host
     * from the page origin, but when the dev server binds to 0.0.0.0 (so
     * it's reachable from other devices on the LAN) some browsers compute
     * the wrong WebSocket host. Pinning the HMR client to localhost:5173
     * keeps HMR working in the local browser; LAN clients hitting the dev
     * server by IP fall back to full-reload mode, which is the right
     * trade-off for occasional cross-device testing.
     */
    hmr: {
      host:       "localhost",
      port:       5173,
      clientPort: 5173,
      protocol:   "ws",
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
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-vendor"
          if (id.includes("node_modules/react-router"))               return "router"
          if (id.includes("node_modules/framer-motion"))              return "framer"
          if (id.includes("node_modules/lucide-react"))               return "lucide"
          if (id.includes("node_modules/react-icons"))                return "icons"
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