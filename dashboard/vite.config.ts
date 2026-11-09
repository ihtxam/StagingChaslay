import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'node:fs'
import { resolvePanelBuildMeta } from './scripts/resolve-panel-build'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

const { gitSha: buildStamp, datedTag: panelBuildTag } = resolvePanelBuildMeta()

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
    __PANEL_BUILD_TAG__: JSON.stringify(panelBuildTag),
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
