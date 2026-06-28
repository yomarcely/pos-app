import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { useCaisseShortcuts, type CaisseShortcutsOptions } from '@/composables/useCaisseShortcuts'

// Le composable est volontairement pur : on lui injecte état + callbacks, on simule
// des keydown sur un conteneur DOM réel et on vérifie le mapping touche → action.

type Mocks = {
  payCash: ReturnType<typeof vi.fn>
  payCard: ReturnType<typeof vi.fn>
  validateSale: ReturnType<typeof vi.fn>
  removeLastItem: ReturnType<typeof vi.fn>
  putOnHold: ReturnType<typeof vi.fn>
  closeTopOverlay: ReturnType<typeof vi.fn>
  focusProductSearch: ReturnType<typeof vi.fn>
}

let scope: EffectScope
let container: HTMLDivElement
let input: HTMLInputElement
let mocks: Mocks

function buildOptions(overrides: Partial<CaisseShortcutsOptions> = {}): CaisseShortcutsOptions {
  return {
    isSubmitting: false,
    isDayClosed: false,
    getBalance: () => 0,
    payCash: mocks.payCash,
    payCard: mocks.payCard,
    validateSale: mocks.validateSale,
    removeLastItem: mocks.removeLastItem,
    putOnHold: mocks.putOnHold,
    closeTopOverlay: mocks.closeTopOverlay,
    focusProductSearch: mocks.focusProductSearch,
    target: container,
    ...overrides,
  }
}

async function mount(overrides: Partial<CaisseShortcutsOptions> = {}) {
  scope = effectScope()
  scope.run(() => useCaisseShortcuts(buildOptions(overrides)))
  // useEventListener attache via watchImmediate({ flush: 'post' }) → dispo au tick suivant
  await nextTick()
}

function press(
  key: string,
  opts: { target?: EventTarget; ctrl?: boolean; meta?: boolean } = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: opts.ctrl ?? false,
    metaKey: opts.meta ?? false,
    bubbles: true,
    cancelable: true,
  })
  ;(opts.target ?? container).dispatchEvent(event)
  return event
}

beforeEach(() => {
  mocks = {
    payCash: vi.fn(),
    payCard: vi.fn(),
    validateSale: vi.fn(),
    removeLastItem: vi.fn(),
    putOnHold: vi.fn(),
    closeTopOverlay: vi.fn(() => false),
    focusProductSearch: vi.fn(),
  }
  container = document.createElement('div')
  input = document.createElement('input')
  container.appendChild(input)
  document.body.appendChild(container)
})

afterEach(() => {
  scope?.stop()
  container.remove()
})

describe('useCaisseShortcuts — mapping touches → actions', () => {
  it('F1 ajoute un paiement Espèces et bloque l\'action navigateur', async () => {
    await mount()
    const e = press('F1')
    expect(mocks.payCash).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('F2 ajoute un paiement Carte', async () => {
    await mount()
    press('F2')
    expect(mocks.payCard).toHaveBeenCalledTimes(1)
  })

  it('F10 valide la vente quand le solde est nul', async () => {
    await mount({ getBalance: () => 0 })
    const e = press('F10')
    expect(mocks.validateSale).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('F10 ne valide pas quand il reste un solde à payer', async () => {
    await mount({ getBalance: () => 4.5 })
    press('F10')
    expect(mocks.validateSale).not.toHaveBeenCalled()
  })

  it('Ctrl+Entrée valide la vente quand le solde est nul', async () => {
    await mount({ getBalance: () => 0 })
    press('Enter', { ctrl: true })
    expect(mocks.validateSale).toHaveBeenCalledTimes(1)
  })

  it('Entrée seul ne valide pas la vente', async () => {
    await mount({ getBalance: () => 0 })
    press('Enter')
    expect(mocks.validateSale).not.toHaveBeenCalled()
  })

  it('Suppr retire la dernière ligne du panier', async () => {
    await mount()
    press('Delete')
    expect(mocks.removeLastItem).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+S met le ticket en attente et bloque la sauvegarde navigateur', async () => {
    await mount()
    const e = press('s', { ctrl: true })
    expect(mocks.putOnHold).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('"/" place le focus sur la recherche produit', async () => {
    await mount()
    const e = press('/')
    expect(mocks.focusProductSearch).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('Échap ferme l\'overlay ouvert sans toucher au focus recherche', async () => {
    mocks.closeTopOverlay.mockReturnValue(true)
    await mount()
    press('Escape')
    expect(mocks.closeTopOverlay).toHaveBeenCalledTimes(1)
    expect(mocks.focusProductSearch).not.toHaveBeenCalled()
  })

  it('Échap focalise la recherche quand aucun overlay n\'est ouvert', async () => {
    mocks.closeTopOverlay.mockReturnValue(false)
    await mount()
    press('Escape')
    expect(mocks.focusProductSearch).toHaveBeenCalledTimes(1)
  })
})

describe('useCaisseShortcuts — inactivité dans un champ de saisie', () => {
  it('ignore "/" et Suppr quand le focus est dans un input', async () => {
    await mount()
    press('/', { target: input })
    press('Delete', { target: input })
    expect(mocks.focusProductSearch).not.toHaveBeenCalled()
    expect(mocks.removeLastItem).not.toHaveBeenCalled()
  })

  it('ignore Ctrl+S quand le focus est dans un input', async () => {
    await mount()
    press('s', { target: input, ctrl: true })
    expect(mocks.putOnHold).not.toHaveBeenCalled()
  })

  it('laisse passer les F-keys même dans un input (saisie scanner non bloquée)', async () => {
    await mount({ getBalance: () => 0 })
    press('F1', { target: input })
    press('F10', { target: input })
    expect(mocks.payCash).toHaveBeenCalledTimes(1)
    expect(mocks.validateSale).toHaveBeenCalledTimes(1)
  })

  it('laisse passer Échap même dans un input', async () => {
    await mount()
    press('Escape', { target: input })
    expect(mocks.closeTopOverlay).toHaveBeenCalledTimes(1)
  })
})

describe('useCaisseShortcuts — inactivité globale', () => {
  it('neutralise tous les raccourcis pendant isSubmitting', async () => {
    await mount({ isSubmitting: true, getBalance: () => 0 })
    press('F1')
    press('F10')
    press('/')
    press('Escape')
    expect(mocks.payCash).not.toHaveBeenCalled()
    expect(mocks.validateSale).not.toHaveBeenCalled()
    expect(mocks.focusProductSearch).not.toHaveBeenCalled()
    expect(mocks.closeTopOverlay).not.toHaveBeenCalled()
  })

  it('neutralise tous les raccourcis quand la journée est clôturée', async () => {
    await mount({ isDayClosed: true, getBalance: () => 0 })
    press('F1')
    press('Delete')
    expect(mocks.payCash).not.toHaveBeenCalled()
    expect(mocks.removeLastItem).not.toHaveBeenCalled()
  })

  it('réagit à un état réactif (ref) de soumission', async () => {
    const isSubmitting = ref(true)
    await mount({ isSubmitting })
    press('F1')
    expect(mocks.payCash).not.toHaveBeenCalled()

    isSubmitting.value = false
    press('F1')
    expect(mocks.payCash).toHaveBeenCalledTimes(1)
  })
})
