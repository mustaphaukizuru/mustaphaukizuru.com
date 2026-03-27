import { defineConfig } from 'vite'
import react       from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    // Disable COOP/COEP headers in dev to allow Google OAuth postMessage
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
  },

  build: {
    // Chunk splitting strategy — prevents single massive bundle
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks — third-party libs cached independently
          if (id.includes('node_modules/react-dom'))   return 'react-dom'
          if (id.includes('node_modules/react-router')) return 'router'
          if (id.includes('node_modules/framer-motion')) return 'framer'
          if (id.includes('node_modules/lucide-react'))  return 'lucide'
          if (id.includes('node_modules/react-icons'))   return 'icons'
          // All other node_modules → shared vendor chunk
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
    // Chunk size warning at 500KB (default 1MB is too lenient)
    chunkSizeWarningLimit: 500,
    // Asset file name hashing for cache busting
    assetsInlineLimit: 4096,    // inline assets < 4KB
    sourcemap: false,           // disable in production for security + size
    minify: 'esbuild',          // fastest minifier
  },

  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react'],
  },
})
