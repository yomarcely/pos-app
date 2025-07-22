<script setup lang="ts">
import { ref } from 'vue'
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const form = ref({
  name: '',
  lastname: '',
  zipcode: '',
  city: '',
  phone: ''
})

function submitClient() {
  console.log('Nouveau client à enregistrer :', form.value)
  // Ici tu pourras émettre un event ou appeler ton store/API
}
</script>

<template>
    <DialogContent class="sm:max-w-[450px]">
        <DialogHeader>
            <DialogTitle>Création d’un client</DialogTitle>
            <DialogDescription>
                Remplissez les informations du client puis cliquez sur "Enregistrer".
            </DialogDescription>
        </DialogHeader>

        <form @submit.prevent="submitClient" class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="lastname" class="text-right">Nom</Label>
                <Input id="lastname" v-model="form.lastname" class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="firstname" class="text-right">Prénom</Label>
                <Input id="firstname" v-model="form.name" class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="zipcode" class="text-right">Code postal</Label>
                <Input id="zipcode" v-model="form.zipcode" class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="city" class="text-right">Ville</Label>
                <Input id="city" v-model="form.city" class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="phone" class="text-right">Téléphone</Label>
                <Input id="phone" v-model="form.phone" class="col-span-3" />
            </div>

            <DialogFooter class="mt-2">
                <Button type="submit">Enregistrer</Button>
            </DialogFooter>
        </form>
    </DialogContent>
</template>