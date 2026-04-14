import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import pkg from './package.json'

// Bundle analysis — enabled via `npm run visualize` (sets VITE_ANALYZE=true)
const analyzeBundle = process.env.VITE_ANALYZE === 'true'

// Only read certs when they exist (skipped during Docker build)
const certPath = path.resolve(__dirname, '../backend/certs/server.crt')
const keyPath = path.resolve(__dirname, '../backend/certs/server.key')
const certsExist = fs.existsSync(certPath) && fs.existsSync(keyPath)
// Default to the backend's direct HTTP port. Override with VITE_PROXY_TARGET
// if you run the backend over TLS (e.g. https://localhost:443) locally.
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080'

// https://vitejs.dev/config/
export default defineConfig(async () => {
  // Conditionally load the visualizer plugin only when needed
  const visualizerPlugin = analyzeBundle
    ? [(await import('rollup-plugin-visualizer')).visualizer({ open: true, filename: 'stats.html', gzipSize: true })]
    : [];

  return {
  plugins: [react(), ...visualizerPlugin],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;

          // Keep explicit checks narrowly scoped and ordered to avoid overlapping
          // matches that can create circular chunk relationships.
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react-vendor';
          }
          if (id.includes('/node_modules/@mui/icons-material/')) {
            return 'mui-icons';
          }
          if (id.includes('/node_modules/@mui/material/') || id.includes('/node_modules/@emotion/')) {
            return 'mui';
          }
          if (id.includes('/node_modules/react-router-dom/')) {
            return 'router';
          }
          if (id.includes('/node_modules/react-markdown/') || id.includes('/node_modules/remark-gfm/')) {
            return 'markdown';
          }
          if (id.includes('/node_modules/swagger-ui-react/') || id.includes('/node_modules/swagger-ui-dist/')) {
            return 'swagger-ui';
          }
          // Leave other node_modules to Rollup's default chunking to avoid circular chunks
        },
      },
    },
  },
  server: {
    port: 3000,
    host: 'registry.local',
    ...(certsExist ? {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
    } : {}),
    proxy: {
      // Proxy API and static backend assets to the backend.
      // When running Vite locally against the Docker stack, the backend is
      // reachable at http://localhost:8080.  When TLS certs are present the
      // backend serves HTTPS on localhost:443 and proxyTarget should be
      // overridden via VITE_PROXY_TARGET.
      // /api-docs and /api-docs/ are React Router SPA routes and must NOT be
      // proxied — Vite's SPA fallback handles them.
      '/swagger.json': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/swagger.yaml': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      // Use /api/ (with slash) so this prefix only matches /api/v1/...
      // and does NOT accidentally match /api-docs which is a React Router route.
      '/api/': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/v1': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/.well-known': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },

  };
})
