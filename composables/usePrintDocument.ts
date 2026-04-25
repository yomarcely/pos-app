/**
 * Imprime un document HTML via un iframe caché hors écran.
 *
 * Plus fiable que `window.open()` (souvent bloqué par les pop-up blockers).
 *
 * IMPORTANT : un iframe à `width:0; height:0` rend une page blanche dans le print engine.
 * On utilise donc une taille réelle positionnée hors viewport (`left: -10000px`).
 *
 * Le iframe est nettoyé après `afterprint` (ou timeout 60s si l'utilisateur annule).
 */
export function usePrintDocument() {
  function printHtml(html: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve()
        return
      }

      const iframe = document.createElement('iframe')
      // Hors écran avec une taille réelle : sinon le print engine récupère un rendu vide
      iframe.style.position = 'fixed'
      iframe.style.left = '-10000px'
      iframe.style.top = '0'
      iframe.style.width = '210mm'
      iframe.style.height = '297mm'
      iframe.style.border = '0'
      iframe.setAttribute('aria-hidden', 'true')

      let cleanedUp = false
      const cleanup = () => {
        if (cleanedUp) return
        cleanedUp = true
        setTimeout(() => {
          iframe.remove()
          resolve()
        }, 500)
      }

      document.body.appendChild(iframe)

      // document.open/write/close est plus fiable que srcdoc pour le moteur d'impression
      // (notamment cross-browser pour @page rules et timing).
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (!doc) {
        cleanup()
        return
      }
      doc.open()
      doc.write(html)
      doc.close()

      // Pas de iframe.onload : il peut fire 2 fois (about:blank initial + doc.close).
      // setTimeout après doc.close laisse au navigateur le temps d'appliquer @page CSS.
      setTimeout(() => {
        const win = iframe.contentWindow
        if (!win) {
          cleanup()
          return
        }
        win.addEventListener('afterprint', cleanup, { once: true })
        try {
          win.focus()
          win.print()
        }
        catch (error) {
          console.error('Erreur lors du déclenchement de l\'impression :', error)
          cleanup()
        }
        // Filet de sécurité si afterprint ne fire pas (annulation sur certains navigateurs)
        setTimeout(cleanup, 60_000)
      }, 200)
    })
  }

  return { printHtml }
}
