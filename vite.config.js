import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Cachea el shell y las fuentes para uso offline en campo.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Forest Gastos',
        short_name: 'Gastos',
        description: 'Gastos y anticipos — Forest Coffee',
        lang: 'es',
        theme_color: '#1b203d',
        background_color: '#f5f4ee',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
