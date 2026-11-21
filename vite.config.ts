import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// `base: './'` + hash routing means the app works from any GitHub Pages path
// (e.g. https://<user>.github.io/<repo>/) without knowing the repo name.
export default defineConfig({
  base: './',
  // KaTeX alone is ~270 kB; the whole app is ~170 kB gzipped and cached offline after first load.
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Flashcards',
        short_name: 'Flashcards',
        description: 'A simple spaced-repetition flashcard app with LaTeX support.',
        theme_color: '#161312',
        background_color: '#161312',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // KaTeX fonts and images from deck files must be precached so everything works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,gif,woff2}'],
      },
    }),
  ],
});
