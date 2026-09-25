import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

function resolveBuildStamp(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    if (sha) return sha
  } catch {
    /* outside git or git unavailable */
  }
  return new Date().toISOString().slice(0, 19)
}

const buildStamp = resolveBuildStamp()

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'reborn-build-stamp',
      transformIndexHtml(html) {
        return html.replaceAll('%REBORN_BUILD_STAMP%', buildStamp)
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_STAMP__: JSON.stringify(buildStamp),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['@adyen/adyen-web'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
