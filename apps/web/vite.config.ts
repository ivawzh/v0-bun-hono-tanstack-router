import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { getEnv, parseUrl } from './env'

const viteEnv = loadEnv(
  process.env.NODE_ENV || 'development',
  process.cwd(),
)

const env = getEnv(undefined, { viteEnv })
const { port } = parseUrl(env.webUrl)

export default defineConfig({
  server: {
    port,
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({}),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'solo-unicorn',
        short_name: 'solo-unicorn',
        description: 'solo-unicorn - PWA Application',
        theme_color: '#ffe68a',
      },
      pwaAssets: { disabled: false, config: true },
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
