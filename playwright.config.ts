import { defineConfig, devices } from '@playwright/test'

// Port/URL du serveur Nuxt buildé (node .output/server/index.mjs), pas `nuxt dev` —
// on teste le build de production (cf. e2e/README.md).
const PORT = process.env.PORT || '3000'
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Chemin critique séquentiel (une seule caisse, chaînage NF525) : pas de
  // parallélisation entre fichiers ni de sharding — le seul spec s'exécute seul.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Démarre le serveur buildé s'il ne tourne pas déjà (dev local : réutilise un
  // serveur déjà lancé ; CI : toujours démarré from scratch par ce webServer).
  webServer: {
    command: 'node .output/server/index.mjs',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT,
    },
  },
})
