import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|svg|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'icons',
              expiration: { maxEntries: 10 }
            }
          }
        ]
      },
      manifest: {
        name: 'Imposter - Party Game',
        short_name: 'Imposter',
        description: 'Find the ghost among us',
        theme_color: '#222',
        background_color: '#222',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        id: '/',
        categories: ['games', 'entertainment', 'social'],
        prefer_related_applications: false,
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
