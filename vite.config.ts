import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // relative base so it works on GitHub Pages sub-paths and from any folder
  base: './',
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    VitePWA({
      // the app decides when to switch to a new version (src/lib/update.ts), never mid-game
      registerType: 'prompt',
      includeAssets: ['img/**/*.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Chip Chip English',
        short_name: 'Chip Chip',
        description: 'Bé học tiếng Anh bằng hình và âm thanh',
        theme_color: '#e6f4ec',
        background_color: '#e6f4ec',
        display: 'fullscreen',
        orientation: 'any',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mp3}', 'voice/manifest.json'],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
} as any);
