<script setup lang="ts">
import { ref } from 'vue'
import {
  DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/composables/useToast'
import { useCustomerStore } from '@/stores/customer'

const { success, error: showError } = useToast()
const customerStore = useCustomerStore()

const emit = defineEmits<{
  success: [customer: any]
}>()

const form = ref({
  name: '',
  lastname: '',
  address: '',
  postalcode: '',
  city: '',
  country: 'France',
  phonenumber: '',
  mail: '',
  fidelity: false,
  authorizesms: false,
  authorizemailing: false,
  discount: 0,
  alert: '',
  information: ''
})

const loading = ref(false)

async function submitClient() {
  // Validation
  if (!form.value.name || !form.value.lastname || !form.value.postalcode) {
    showError('Erreur', 'Le nom, le prénom et le code postal sont obligatoires')
    return
  }

  loading.value = true

  try {
    const response = await $fetch('/api/customers/create', {
      method: 'POST',
      body: form.value,
    })

    if (response.success) {
      success('Client créé', `${form.value.name} ${form.value.lastname} a été ajouté avec succès`)

      // Recharger la liste des clients dans le store
      customerStore.loaded = false
      await customerStore.loadCustomers()

      // Émettre l'événement de succès avec le client créé
      emit('success', response.customer)

      // Réinitialiser le formulaire
      form.value = {
        name: '',
        lastname: '',
        address: '',
        postalcode: '',
        city: '',
        country: 'France',
        phonenumber: '',
        mail: '',
        fidelity: false,
        authorizesms: false,
        authorizemailing: false,
        discount: 0,
        alert: '',
        information: ''
      }
    }
  } catch (err: any) {
    console.error('Erreur lors de la création du client:', err)
    showError('Erreur', err.data?.message || 'Impossible de créer le client')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <DialogContent class="w-full max-w-4xl">
    <DialogHeader>
      <DialogTitle>Nouveau client</DialogTitle>
      <DialogDescription>
        Remplissez les informations du client puis cliquez sur "Enregistrer".
      </DialogDescription>
    </DialogHeader>

    <form @submit.prevent="submitClient" class="grid grid-cols-2 gap-6 py-4">
      <!-- Colonne 1 -->
      <div class="space-y-4">
        <div>
          <Label for="lastname">Nom <span class="text-red-500">*</span></Label>
          <Input id="lastname" v-model="form.lastname" required />
        </div>
        <div>
          <Label for="name">Prénom <span class="text-red-500">*</span></Label>
          <Input id="name" v-model="form.name" required />
        </div>
        <div>
          <Label for="address">Adresse</Label>
          <Input id="address" v-model="form.address" />
        </div>
        <div class="flex gap-2">
          <div class="flex-1">
            <Label for="postalcode">Code postal <span class="text-red-500">*</span></Label>
            <Input id="postalcode" v-model="form.postalcode" required />
          </div>
          <div class="flex-1">
            <Label for="city">Ville</Label>
            <Input id="city" v-model="form.city" />
          </div>
        </div>
        <div>
          <Label for="country">Pays</Label>
          <Input id="country" v-model="form.country" />
        </div>
        <div>
          <Label for="phonenumber">Téléphone</Label>
          <Input id="phonenumber" v-model="form.phonenumber" />
        </div>
        <div class="col-span-2">
          <Label for="mail">Email</Label>
          <Input id="mail" v-model="form.mail" />
        </div>

      </div>

      <!-- Colonne 2 -->
      <div class="space-y-4">
        <div>
          <Label for="discount">Remise automatique (%)</Label>
          <Input id="discount" type="number" min="0" v-model.number="form.discount" />
        </div>

        <div class="flex items-center gap-4">
          <Switch id="fidelity" v-model:checked="form.fidelity" />
          <Label for="fidelity">Fidélité active</Label>
        </div>
        <div class="flex items-center gap-4">
          <Switch id="authorizesms" v-model:checked="form.authorizesms" />
          <Label for="authorizesms">Autorise SMS</Label>
        </div>
        <div class="flex items-center gap-4">
          <Switch id="authorizemailing" v-model:checked="form.authorizemailing" />
          <Label for="authorizemailing">Autorise emailings</Label>
        </div>
        <div>
          <Label for="alert">Alerte</Label>
          <Textarea id="alert" rows="2" v-model="form.alert" />
        </div>
        <div>
          <Label for="information">Informations complémentaires</Label>
          <Textarea id="information" rows="3" v-model="form.information" />
        </div>
      </div>

      <!-- Bouton -->
      <div class="col-span-2 flex justify-end pt-2">
        <DialogFooter>
          <Button type="submit">Enregistrer</Button>
        </DialogFooter>
      </div>
    </form>
  </DialogContent>
</template>
