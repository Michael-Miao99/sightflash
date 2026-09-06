import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 子路径部署（github.io Pages）：BASE_PATH 环境变量注入（见 scripts/deploy-pages.mjs）；
// 缺省 '/' = 本地 dev / 隧道验收，行为不变。
const BASE = process.env.BASE_PATH ? `/${process.env.BASE_PATH.replace(/^\/+|\/+$/g, '')}/` : '/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '五线速读',
        short_name: '五线速读',
        description: '识谱反应训练器：把五线谱练成条件反射',
        lang: 'zh-CN',
        start_url: BASE,
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
