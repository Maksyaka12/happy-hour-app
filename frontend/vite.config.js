import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      jsbi: path.resolve(__dirname, 'node_modules', 'jsbi', 'dist', 'jsbi-cjs.js'),
    },
  },
  define: {
    global: 'globalThis',
  },
  appType: 'spa',
  server: {
    historyApiFallback: true,
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})
