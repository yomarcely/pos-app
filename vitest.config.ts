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
        'pages/**/create.vue',
        'pages/**/edit.vue',
        'pages/login/**/*',
        'pages/categories/**/*',
        'pages/clotures/**/*',
        'components/ui/**/*',
        'server/**/*',
        'app.vue',
        'nuxt.config.ts',
        'drizzle.config.ts'
      ],
      thresholds: {
        lines: 60,
        functions: 45,
        branches: 40,
        statements: 60
      }
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
