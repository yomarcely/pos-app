import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true, // permet d'utiliser describe/it/expect sans import
    environment: 'jsdom', // simule le DOM (utile pour tester des composants)
    include: ['tests/**/*.test.ts'], // chemin de tes fichiers de test
    coverage: {
      reporter: ['text', 'html'], // affichage couverture console + rapport HTML
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'), // pour que @/ pointe sur src/
    },
  },
})
