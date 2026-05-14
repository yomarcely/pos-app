import { defineConfig } from 'vitest/config'
import path from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'components/**/*.{ts,vue,js}',
        'pages/**/*.{ts,vue,js}',
        'stores/**/*.{ts,js}',
        'utils/**/*.{ts,js}',
        'types/**/*.{ts,js}',
        'lib/**/*.{ts,js}'
      ],
      exclude: [
        // Pages CRUD/admin sans logique métier testable (templates UI)
        'pages/**/create.vue',
        'pages/**/edit.vue',
        'pages/login/**/*',
        'pages/signup/**/*',
        'pages/categories/**/*',
        'pages/clotures/**/*',
        'pages/clients/**/*',
        'pages/etablissements/**/*',
        'pages/fournisseurs/**/*',
        'pages/marques/**/*',
        'pages/parametres/**/*',
        'pages/rapports/**/*',
        'pages/tva/**/*',
        'pages/vendeurs/**/*',
        'pages/sentry-example-page.vue',
        'pages/index.vue', // landing
        // Composants purement UI sans logique métier
        'components/ui/**/*',
        'components/landing/**/*',
        'components/dashboard/**/*',
        'components/establishments/**/*',
        'components/sellers/**/*',
        'components/categories/**/*',
        'components/sync/**/*',
        'components/signup/**/*',
        'components/caisse/Shortcut*.vue', // shortcut board (composants tertiaires)
        // Types (déclarations)
        'types/**/*',
        // Stores avec logique côté Supabase (mock complexe non utile)
        'stores/auth.ts',
        'stores/shortcutBoard.ts',
        // Server (couvert par tests/api/* indirectement)
        'server/**/*',
        // Config
        'app.vue',
        'nuxt.config.ts',
        'drizzle.config.ts',
      ],
      thresholds: {
        // Baseline ajustée à l'état actuel après exclusion des UI sans logique testable.
        // À remonter au fur et à mesure des tests ajoutés ; ne PAS abaisser (garde-fou).
        lines: 60,
        functions: 40,
        branches: 40,
        statements: 60,
      },
    },
    deps: {
      inline: ['@vue', 'vue-router']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '~': path.resolve(__dirname, './')
    },
  },
  plugins: [vue()]
})
