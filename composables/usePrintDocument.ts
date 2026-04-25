/**
 * Imprime un document HTML via un iframe caché.
 * Plus fiable que window.open() (souvent bloqué par les pop-up blockers).
 *
 * Le iframe est nettoyé après impression (ou après timeout si l'utilisateur annule).
 */
export function usePrintDocument() {
  function printHtml(html: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve()
        return
      }

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.setAttribute('aria-hidden', 'true')

      let cleanedUp = false
      const cleanup = () => {
        if (cleanedUp) return
        cleanedUp = true
        // Délai pour laisser le navigateur finir le job d'impression
        setTimeout(() => {
          iframe.remove()
          resolve()
        }, 500)
      }

      iframe.onload = () => {
        const win = iframe.contentWindow
        if (!win) {
          cleanup()
          return
        }
        // Capture afterprint pour cleanup propre
        win.addEventListener('afterprint', cleanup, { once: true })
        try {
          win.focus()
          win.print()
        }
        catch (error) {
          console.error('Erreur lors du déclenchement de l\'impression :', error)
          cleanup()
        }
        // Filet de sécurité : si afterprint ne fire pas (ex: utilisateur annule sur certains
        // navigateurs), on cleanup après 60s
        setTimeout(cleanup, 60_000)
      }

      document.body.appendChild(iframe)
      // srcdoc est plus simple que document.write pour injecter du HTML complet
      iframe.srcdoc = html
    })
  }

  return { printHtml }
}
