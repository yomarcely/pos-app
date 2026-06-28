import { ref, computed, type Ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'

interface ClientMetadata {
  postalCode?: string | null
  city?: string | null
  country?: string | null
  authorizeSms?: boolean
}

interface LoadedClient {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  metadata?: ClientMetadata | null
  isAnonymized?: boolean
  loyaltyProgram?: boolean
  discount?: string | null
  gdprConsent?: boolean
  marketingConsent?: boolean
  notes?: string | null
  alerts?: string | null
}

interface ClientForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
  country: string
  loyaltyProgram: boolean
  discount: number
  gdprConsent: boolean
  marketingConsent: boolean
  authorizeSms: boolean
  notes: string
  alerts: string
}

export function useClientEditor(clientId: Ref<number>) {
  const toast = useToast()

  // Le formulaire est null jusqu'au chargement ; les consommateurs (template,
  // tests) y accèdent toujours après loadClient(), d'où le type non-nullable.
  const form = ref<ClientForm>(null as unknown as ClientForm)
  const loading = ref(false)
  const loadingClient = ref(true)
  const isAnonymized = ref(false)
  const clientStats = ref({ totalRevenue: 0, loyaltyPoints: 0, purchaseCount: 0 })

  const clientName = computed(() => {
    if (!form.value) return 'Client'
    const parts: string[] = []
    if (form.value.firstName) parts.push(form.value.firstName)
    if (form.value.lastName) parts.push(form.value.lastName)
    return parts.length > 0 ? parts.join(' ') : 'Client'
  })

  async function loadClientStats() {
    try {
      const response = await $fetch<{ totalRevenue: number; loyaltyPoints: number; purchaseCount: number }>(`/api/clients/${clientId.value}/stats`)
      clientStats.value = {
        totalRevenue: response.totalRevenue || 0,
        loyaltyPoints: response.loyaltyPoints || 0,
        purchaseCount: response.purchaseCount || 0,
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error)
    }
  }

  async function loadClient() {
    try {
      loadingClient.value = true
      const response = await $fetch<{ client: LoadedClient }>(`/api/clients/${clientId.value}`)
      const client = response.client
      const metadata: ClientMetadata = client.metadata || {}
      isAnonymized.value = !!client.isAnonymized
      form.value = {
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        postalCode: metadata.postalCode || '',
        city: metadata.city || '',
        country: metadata.country || 'France',
        loyaltyProgram: client.loyaltyProgram || false,
        discount: parseFloat(client.discount || '0'),
        gdprConsent: client.gdprConsent || false,
        marketingConsent: client.marketingConsent || false,
        authorizeSms: metadata.authorizeSms || false,
        notes: client.notes || '',
        alerts: client.alerts || '',
      }
      await loadClientStats()
    } catch (error: unknown) {
      console.error('Erreur lors du chargement du client:', error)
      toast.error(extractFetchError(error, 'Erreur lors du chargement du client'))
      navigateTo('/clients')
    } finally {
      loadingClient.value = false
    }
  }

  async function handleSubmit() {
    if (!form.value.gdprConsent) {
      toast.error('Le consentement RGPD est obligatoire')
      return
    }
    try {
      loading.value = true
      await $fetch(`/api/clients/${clientId.value}`, {
        method: 'PUT',
        body: {
          firstName: form.value.firstName?.trim() || null,
          lastName: form.value.lastName?.trim() || null,
          email: form.value.email || null,
          phone: form.value.phone || null,
          address: form.value.address || null,
          postalCode: form.value.postalCode?.trim() || '',
          metadata: {
            postalCode: form.value.postalCode || null,
            city: form.value.city || null,
            country: form.value.country || 'France',
            authorizeSms: form.value.authorizeSms,
          },
          gdprConsent: !!form.value.gdprConsent,
          marketingConsent: !!form.value.marketingConsent,
          loyaltyProgram: !!form.value.loyaltyProgram,
          discount: form.value.discount || 0,
          notes: form.value.notes || null,
          alerts: form.value.alerts || null,
        },
      })
      toast.success('Client modifié avec succès')
      navigateTo('/clients')
    } catch (error: unknown) {
      console.error('Erreur lors de la modification du client:', error)
      toast.error(extractFetchError(error, 'Erreur lors de la modification du client'))
    } finally {
      loading.value = false
    }
  }

  async function anonymizeClient() {
    try {
      loading.value = true
      await $fetch(`/api/clients/${clientId.value}/anonymize`, { method: 'POST' })
      toast.success('Client anonymisé avec succès')
      await loadClient()
    } catch (error: unknown) {
      console.error('Erreur lors de l\'anonymisation:', error)
      toast.error(extractFetchError(error, 'Erreur lors de l\'anonymisation du client'))
    } finally {
      loading.value = false
    }
  }

  return { form, loading, loadingClient, isAnonymized, clientStats, clientName, loadClient, handleSubmit, anonymizeClient }
}
