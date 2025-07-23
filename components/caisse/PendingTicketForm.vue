<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const pendingTickets = [
  {
    id: 1,
    date: '22/07/2025',
    client: '',
    qProduct: 8,
    totalAmount: '250.00',
  },
  {
    id: 2,
    date: '22/07/2025',
    client: '',
    qProduct: 8,
    totalAmount: '250.00',
  },
  {
    id: 3,
    date: '22/07/2025',
    client: '',
    qProduct: 8,
    totalAmount: '250.00',
  },
  {
    id: 4,
    date: '22/07/2025',
    client: '',
    qProduct: 8,
    totalAmount: '250.00',
  },
  {
    id: 5,
    date: '22/07/2025',
    client: '',
    qProduct: 8,
    totalAmount: '250.00',
  },
  {
    id: 6,
    date: '22/07/2025',
    client: '',
    qProduct: 8,
    totalAmount: '250.00',
  },
  {
    id: 7,
    date: '22/07/2025',
    client: '',
    qProduct: 8,
    totalAmount: '250.00',
  },
]
</script>

<template>
    <DialogContent class="sm:max-w-[450px]">
        <DialogHeader>
            <DialogTitle>Tickets en attente</DialogTitle>
        </DialogHeader>

        <form @submit.prevent="" class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="lastname" class="text-right">Nom</Label>
                <Input id="lastname" class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="firstname" class="text-right">Prénom</Label>
                <Input id="firstname"  class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="zipcode" class="text-right">Code postal</Label>
                <Input id="zipcode" class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="city" class="text-right">Ville</Label>
                <Input id="city" class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="phone" class="text-right">Téléphone</Label>
                <Input id="phone" class="col-span-3" />
            </div>

            <DialogFooter class="mt-2">
                <Button type="submit">Enregistrer</Button>
            </DialogFooter>
        </form>
    </DialogContent>
</template>