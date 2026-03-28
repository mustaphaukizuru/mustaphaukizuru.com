import { defineConfig } from 'vite'
import react       from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
  },

  build: {
    // Output directly into Express's public/ folder so it can serve the React app
    outDir: "../api/public",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react-dom'))    return 'react-dom'
          if (id.includes('node_modules/react-router')) return 'router'
          if (id.includes('node_modules/framer-motion')) return 'framer'
          if (id.includes('node_modules/lucide-react'))  return 'lucide'
          if (id.includes('node_modules/react-icons'))   return 'icons'
          if (id.includes('node_modules'))               return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 500,
    assetsInlineLimit: 4096,
    sourcemap: false,
    minify: 'esbuild',
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react'],
  },
})