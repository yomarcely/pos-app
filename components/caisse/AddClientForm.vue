<script setup lang="ts">
import { ref } from 'vue'
import {
  DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'

const form = ref({
  name: '',
  lastname: '',
  address: '',
  postalcode: '',
  city: '',
  country: '',
  phonenumber: '',
  mail: '',
  fidelity: false,
  authorizesms: false,
  authorizemailing: false,
  discount: 0,
  alert: '',
  information: ''
})

function submitClient() {
  console.log('Nouveau client à enregistrer :', form.value)
  // Ici tu peux appeler un store ou une API
}
</script>

<template>
  <DialogContent class="sm:max-w-[800px]">
    <DialogHeader>
      <DialogTitle>Nouveau client</DialogTitle>
      <DialogDescription>
        Remplissez les informations du client puis cliquez sur "Enregistrer".
      </DialogDescription>
    </DialogHeader>

    <form @submit.prevent="submitClient" class="grid gap-4 py-4">
      <!-- 🔹 Nom & prénom -->
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="lastname" class="text-right">Nom</Label>
        <Input id="lastname" v-model="form.lastname" class="col-span-3" />
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="name" class="text-right">Prénom</Label>
        <Input id="name" v-model="form.name" class="col-span-3" />
      </div>

      <!-- 🔹 Adresse -->
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="address" class="text-right">Adresse</Label>
        <Input id="address" v-model="form.address" class="col-span-3" />
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="postalcode" class="text-right">Code postal</Label>
        <Input id="postalcode" v-model="form.postalcode" class="col-span-3" />
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="city" class="text-right">Ville</Label>
        <Input id="city" v-model="form.city" class="col-span-3" />
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="country" class="text-right">Pays</Label>
        <Input id="country" v-model="form.country" class="col-span-3" />
      </div>

      <!-- 🔹 Contact -->
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="phonenumber" class="text-right">Téléphone</Label>
        <Input id="phonenumber" v-model="form.phonenumber" class="col-span-3" />
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="mail" class="text-right">Email</Label>
        <Input id="mail" v-model="form.mail" class="col-span-3" />
      </div>

      <!-- 🔹 Divers -->
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="discount" class="text-right">Remise (%)</Label>
        <Input id="discount" type="number" min="0" max="100" v-model.number="form.discount" class="col-span-3" />
      </div>

      <!-- 🔹 Options -->
      <div class="flex flex-col gap-2 col-span-4 ml-8">
        <label class="flex items-center gap-2">
          <Checkbox v-model:checked="form.fidelity" /> Fidélité active
        </label>
        <label class="flex items-center gap-2">
          <Checkbox v-model:checked="form.authorizesms" /> Autorise SMS
        </label>
        <label class="flex items-center gap-2">
          <Checkbox v-model:checked="form.authorizemailing" /> Autorise emailing
        </label>
      </div>

      <!-- 🔹 Alertes & infos -->
      <div class="grid grid-cols-4 items-start gap-4">
        <Label for="alert" class="text-right">Alerte</Label>
        <Textarea id="alert" v-model="form.alert" class="col-span-3" />
      </div>
      <div class="grid grid-cols-4 items-start gap-4">
        <Label for="information" class="text-right">Infos</Label>
        <Textarea id="information" v-model="form.information" class="col-span-3" />
      </div>

      <DialogFooter class="mt-2">
        <Button type="submit">Enregistrer</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</template>
