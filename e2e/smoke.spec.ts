import { test, expect, type Page } from '@playwright/test'

/**
 * Smoke test du chemin critique complet, de bout en bout, contre un build de
 * production (node .output/server/index.mjs) et une vraie base Postgres migrée
 * + seedée (voir e2e/README.md).
 *
 * login → sélection établissement/caisse → vente (×2) → clôture de journée
 * → vérification de la chaîne NF525.
 *
 * Aucun bypass d'auth (règle absolue CLAUDE.md n°9 — ALLOW_AUTH_BYPASS interdit
 * ici) : la connexion traverse le vrai flux Supabase via le formulaire /login.
 *
 * Prérequis (voir e2e/README.md) : un utilisateur Supabase de test dont
 * `app_metadata.tenant_id` vaut EXACTEMENT le tenant seedé par
 * server/database/seed.ts (tenant "Vape").
 */

// Tenant hardcodé dans server/database/seed.ts (seed du tenant "Vape").
const SEED_TENANT_ID = 'f831a590-f365-4302-8aaf-1a7ac06d357d'
const SEED_ESTABLISHMENT_NAME = 'Vape Shop Centre'
const SEED_REGISTER_NAME = 'Vape Shop Centre - Caisse 1'
const SEED_SELLER_NAME = 'Yohan'
// Produit sans variation (server/database/seed-data.ts) : évite la complexité
// du sélecteur de variation, non nécessaire pour valider le chemin critique.
const SEED_PRODUCT_NAME = 'Câble USB-C - 1m'

// Format contractuel du numéro de ticket NF525 (server/utils/nf525.ts:generateTicketNumber) :
// YYYYMMDD-E{établissement}-R{caisse}-NNNNNN (établissement/caisse sur 2 chiffres, séquence sur 6).
const TICKET_NUMBER_RE = /^\d{8}-E\d{2}-R\d{2}-(\d{6})$/

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variable d'environnement ${name} manquante — voir e2e/README.md pour la configuration requise.`
    )
  }
  return value
}

/** Ajoute le produit seedé au panier via la recherche de la colonne centrale de la caisse. */
async function addSeedProductToCart(page: Page) {
  const searchInput = page.getByPlaceholder('Nom du produit ou code-barres...')
  await searchInput.fill(SEED_PRODUCT_NAME)

  // Le nom du produit n'apparaît nulle part ailleurs sur /caisse avant cet ajout
  // (il n'entre dans le panier qu'après ce clic) : le texte exact suffit à cibler
  // la ligne de suggestion sans dépendre des classes CSS du composant.
  const suggestion = page.getByText(SEED_PRODUCT_NAME, { exact: true })
  await expect(suggestion).toBeVisible()
  await suggestion.click()
}

/** Sélectionne un mode de paiement qui couvre exactement le solde puis valide la vente. */
async function payCashAndValidate(page: Page) {
  await page.getByRole('button', { name: /^Espèces/ }).click()

  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/sales/create') && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /Valider la vente/ }).click(),
  ])

  expect(response.ok(), `POST /api/sales/create a échoué (${response.status()})`).toBe(true)
  const body = await response.json()
  expect(body.success).toBe(true)
  expect(body.sale.ticketNumber).toMatch(TICKET_NUMBER_RE)

  // Le dialog de succès affiche le même numéro de ticket que la réponse API.
  await expect(page.getByText(body.sale.ticketNumber)).toBeVisible()
  await page.getByRole('button', { name: 'Fermer' }).click()

  return body.sale as { ticketNumber: string; registerId: number }
}

test('chemin critique : login → vente → clôture → vérification NF525', async ({ page }) => {
  const email = requiredEnv('E2E_USER_EMAIL')
  const password = requiredEnv('E2E_USER_PASSWORD')

  let tenantId: string | null = null

  await test.step('a. Connexion', async () => {
    await page.goto('/login')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(password)

    // Capture la réponse Supabase pour vérifier tôt (message clair) que le
    // compte de test est bien rattaché au tenant seedé — sinon toute la suite
    // échouerait plus loin avec des erreurs "aucun établissement" opaques.
    const [authResponse] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/auth/v1/token') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Se connecter' }).click(),
    ])
    const authBody = await authResponse.json()
    tenantId = authBody?.user?.app_metadata?.tenant_id ?? authBody?.user?.app_metadata?.tenantId ?? null

    expect(
      tenantId,
      `L'utilisateur de test n'a pas de tenant_id dans app_metadata (attendu : ${SEED_TENANT_ID}) — voir e2e/README.md.`
    ).toBe(SEED_TENANT_ID)

    await page.waitForURL('**/dashboard', { timeout: 20_000 })
  })

  await test.step('b. Sélection établissement et caisse', async () => {
    await page.goto('/caisse')
    const header = page.locator('header')

    // Header.vue : 1er [data-slot="select-trigger"] = vendeur, 2e = établissement
    // (EstablishmentSelect). data-slot est déjà posé par les composants shadcn
    // existants (components/ui/select, components/ui/dropdown-menu) — pas d'ajout
    // de code applicatif pour ce test.
    const establishmentTrigger = header.locator('[data-slot="select-trigger"]').nth(1)
    await expect(establishmentTrigger).toContainText(SEED_ESTABLISHMENT_NAME, { timeout: 15_000 })
    await establishmentTrigger.click()
    await page.locator('[data-slot="select-item"]', { hasText: SEED_ESTABLISHMENT_NAME }).first().click()
    await expect(establishmentTrigger).toContainText(SEED_ESTABLISHMENT_NAME)

    const registerTrigger = header.locator('[data-slot="dropdown-menu-trigger"]')
    await registerTrigger.click()
    await page.locator('[data-slot="dropdown-menu-item"]', { hasText: SEED_REGISTER_NAME }).first().click()
    await expect(registerTrigger).toContainText(SEED_REGISTER_NAME)
  })

  const ticketNumbers: string[] = []

  await test.step('c. Première vente (produit + vendeur + paiement espèces)', async () => {
    const header = page.locator('header')
    const sellerTrigger = header.locator('[data-slot="select-trigger"]').nth(0)
    await sellerTrigger.click()
    await page.locator('[data-slot="select-item"]', { hasText: SEED_SELLER_NAME }).first().click()
    await expect(sellerTrigger).toContainText(SEED_SELLER_NAME)

    await addSeedProductToCart(page)
    const sale = await payCashAndValidate(page)
    ticketNumbers.push(sale.ticketNumber)
  })

  let registerId = 0

  await test.step('d. Deuxième vente (le séquentiel doit s\'incrémenter)', async () => {
    await addSeedProductToCart(page)
    const sale = await payCashAndValidate(page)
    ticketNumbers.push(sale.ticketNumber)
    registerId = sale.registerId

    const [, seq1] = ticketNumbers[0]!.match(TICKET_NUMBER_RE)!
    const [, seq2] = ticketNumbers[1]!.match(TICKET_NUMBER_RE)!
    expect(Number(seq2)).toBe(Number(seq1) + 1)
  })

  await test.step('e. Clôture de journée', async () => {
    await page.goto('/synthese')

    // Auto-accepte l'alert() de confirmation affiché par la page après clôture réussie.
    page.once('dialog', dialog => dialog.accept())

    const closeButton = page.getByRole('button', { name: /Clôturer la journée/ })
    await expect(closeButton).toBeEnabled({ timeout: 15_000 })
    await closeButton.click()

    const [closeResponse] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/sales/close-day') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Confirmer la clôture' }).click(),
    ])

    expect(closeResponse.ok(), `POST /api/sales/close-day a échoué (${closeResponse.status()})`).toBe(true)
    const closeBody = await closeResponse.json()
    expect(closeBody.success).toBe(true)
    expect(closeBody.closure.closureHash).toBeTruthy()
  })

  await test.step('f. Vérification de la chaîne NF525 (GET /api/sales/verify-chain)', async () => {
    // Appel via un APIRequestContext Playwright authentifié (pas de clic UI :
    // verify-chain est un endpoint d'audit sans écran dédié). Les headers sont
    // ceux exigés par server/utils/tenant.ts + assertAuth (voir CLAUDE.md
    // « Convention auth serveur »).
    const token = await getAccessToken(page)
    const response = await page.request.get(`/api/sales/verify-chain?registerId=${registerId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': String(tenantId),
      },
    })

    expect(response.ok(), `GET /api/sales/verify-chain a échoué (${response.status()})`).toBe(true)
    const body = await response.json()
    expect(body.isValid).toBe(true)
    expect(body.ticketCount).toBeGreaterThanOrEqual(2)
    expect(body.brokenLinks).toEqual([])
  })
})

/**
 * Récupère l'access token de la session Supabase active dans le navigateur.
 * supabase-js v2 persiste la session en localStorage sous la clé standard
 * `sb-<project-ref>-auth-token` — convention stable de la lib, pas un détail
 * interne de cette app (composables/useSupabaseClient.ts n'a pas de storageKey
 * custom, cf. plugins/00.supabase.ts).
 */
async function getAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}')
      return parsed?.access_token ?? parsed?.currentSession?.access_token ?? null
    } catch {
      return null
    }
  })
  if (!token) {
    throw new Error('Impossible de récupérer le token de session Supabase depuis le navigateur.')
  }
  return token
}
