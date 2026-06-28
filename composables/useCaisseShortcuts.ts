import { toValue, type MaybeRefOrGetter } from 'vue'
import { useEventListener } from '@vueuse/core'

/**
 * Raccourcis clavier de la page caisse — à monter UNIQUEMENT depuis `pages/caisse`.
 *
 * Composable d'orchestration pur : il ne connaît ni les stores ni les composants.
 * L'appelant (la page) lui fournit l'état réactif (isSubmitting / isDayClosed / solde)
 * et les actions à déclencher. Cela le rend trivialement testable (cf. tests) et évite
 * de coupler la gestion clavier aux trois colonnes (ColLeft / ColMiddle / ColRight).
 *
 * Mapping :
 *  - F1            → payCash (solde restant en Espèces)
 *  - F2            → payCard (solde restant en Carte)
 *  - F10 / Ctrl+↵  → validateSale (uniquement si solde nul)
 *  - Suppr         → removeLastItem (dernière ligne du panier)
 *  - Échap         → closeTopOverlay() ; sinon focusProductSearch()
 *  - Ctrl+S        → putOnHold (mise en attente)  [preventDefault]
 *  - /             → focusProductSearch  [preventDefault]
 *
 * Règles :
 *  1. Inactifs quand le focus est dans un input/textarea/select/contenteditable,
 *     SAUF Échap et les F-keys (ne pas perturber la saisie scanner/recherche).
 *  2. Tous désactivés pendant `isSubmitting` ou quand la journée est clôturée (`isDayClosed`).
 *  4. preventDefault sur les F-keys interceptées (F1 = aide navigateur sinon), "/" et Ctrl+S.
 */
export interface CaisseShortcutsOptions {
  /** Vente en cours de soumission → tous les raccourcis sont neutralisés. */
  isSubmitting: MaybeRefOrGetter<boolean>
  /** Journée clôturée → tous les raccourcis sont neutralisés. */
  isDayClosed: MaybeRefOrGetter<boolean>
  /** Solde restant à payer (0 = vente soldée, validation autorisée). */
  getBalance: () => number
  /** F1 — ajoute le solde restant en paiement Espèces. */
  payCash: () => void
  /** F2 — ajoute le solde restant en paiement Carte. */
  payCard: () => void
  /** F10 / Ctrl+Entrée — valide la vente (l'appelant n'est invoqué que si solde nul). */
  validateSale: () => void
  /** Suppr — retire la dernière ligne du panier. */
  removeLastItem: () => void
  /** Ctrl+S — met le ticket courant en attente. */
  putOnHold: () => void
  /** Échap (étape 1) — ferme le dialog/drawer ouvert. Retourne true si une couche a été fermée/détectée. */
  closeTopOverlay: () => boolean
  /** Échap (étape 2) / "/" — place le focus sur le champ de recherche produit. */
  focusProductSearch: () => void
  /** Cible d'écoute du keydown. Défaut : `window`. Surchargé dans les tests. */
  target?: EventTarget | null
}

/** Vrai si la cible de l'événement est une zone de saisie texte. */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable === true
}

/** Solde considéré nul (tolérance centimes pour éviter les artefacts float). */
const BALANCE_EPSILON = 0.005

export function useCaisseShortcuts(options: CaisseShortcutsOptions): void {
  function onKeydown(e: KeyboardEvent): void {
    // Règle 2 : neutralisé pendant la soumission ou journée clôturée.
    if (toValue(options.isSubmitting) || toValue(options.isDayClosed)) return

    const key = e.key
    const isFKey = /^F\d{1,2}$/.test(key)
    const ctrl = e.ctrlKey || e.metaKey

    // Règle 1 : dans un champ de saisie, seules Échap et les F-keys restent actives.
    if (isEditableTarget(e.target) && key !== 'Escape' && !isFKey) return

    const balanceIsZero = () => Math.abs(options.getBalance()) < BALANCE_EPSILON

    switch (true) {
      case key === 'F1':
        e.preventDefault()
        options.payCash()
        break

      case key === 'F2':
        e.preventDefault()
        options.payCard()
        break

      case key === 'F10':
        e.preventDefault()
        if (balanceIsZero()) options.validateSale()
        break

      case key === 'Enter' && ctrl:
        e.preventDefault()
        if (balanceIsZero()) options.validateSale()
        break

      case key === 'Delete':
        e.preventDefault()
        options.removeLastItem()
        break

      case key === 'Escape':
        if (!options.closeTopOverlay()) options.focusProductSearch()
        break

      case (key === 's' || key === 'S') && ctrl:
        e.preventDefault()
        options.putOnHold()
        break

      case key === '/':
        e.preventDefault()
        options.focusProductSearch()
        break
    }
  }

  const target = options.target ?? (typeof window !== 'undefined' ? window : null)
  useEventListener(target, 'keydown', onKeydown)
}
