import { ref, type Ref } from 'vue'

export function usePostalCodeLookup(form: Ref<any>) {
  const loadingPostalCode = ref(false)
  const postalCodeError = ref('')
  const availableCities = ref<Array<{ nom: string; code: string }>>([])

  let postalCodeTimeout: ReturnType<typeof setTimeout>

  function selectCity(cityName: string) {
    if (!form.value) return
    form.value.city = cityName
    availableCities.value = []
  }

  async function handlePostalCodeChange(e?: Event) {
    if (!form.value) return
    // Lire depuis l'événement natif plutôt que form.postalCode : useVModel (passive: true)
    // met à jour le parent de façon asynchrone, donc form.postalCode a un chiffre de retard.
    const postalCode = e
      ? (e.target as HTMLInputElement).value.trim()
      : form.value.postalCode.trim()
    postalCodeError.value = ''
    availableCities.value = []
    clearTimeout(postalCodeTimeout)
    if (!/^\d{5}$/.test(postalCode)) return

    postalCodeTimeout = setTimeout(async () => {
      try {
        loadingPostalCode.value = true
        const response = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom,code,codesPostaux,centre&format=json&geometry=centre`)
        if (!response.ok) throw new Error('Code postal non trouvé')
        const data = await response.json()
        if (data && data.length > 0) {
          availableCities.value = data
          form.value.city = data[0].nom
          if (data.length === 1) availableCities.value = []
        } else {
          postalCodeError.value = 'Code postal non trouvé'
        }
      } catch (error) {
        console.error('Erreur lors de la recherche du code postal:', error)
        postalCodeError.value = 'Impossible de trouver la ville'
      } finally {
        loadingPostalCode.value = false
      }
    }, 500)
  }

  return { loadingPostalCode, postalCodeError, availableCities, handlePostalCodeChange, selectCity }
}
