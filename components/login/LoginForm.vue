<script setup lang="ts">
import { reactive, ref } from 'vue'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const route = useRoute()

const form = reactive({
  email: '',
  password: '',
})

const loading = ref(false)
const error = ref<string | null>(null)

const handleSubmit = async () => {
  loading.value = true
  error.value = null

  try {
    await auth.signIn(form.email, form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await navigateTo(redirect)
  } catch (err: any) {
    const message = err?.message || 'Échec de connexion'
    error.value = message
    toast.error(message)
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <form :class="cn('flex flex-col gap-6')" @submit.prevent="handleSubmit">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-bold">
        Connexion
      </h1>
      <p class="text-balance text-sm text-muted-foreground">
        Identifiez-vous pour accéder à votre caisse et vos données.
      </p>
    </div>

    <div v-if="error" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {{ error }}
    </div>

    <div class="grid gap-6">
      <div class="grid gap-2">
        <Label for="email">Email</Label>
        <Input
          id="email"
          v-model="form.email"
          type="email"
          placeholder="m@example.com"
          autocomplete="email"
          required
        />
      </div>
      <div class="grid gap-2">
        <div class="flex items-center">
          <Label for="password">Mot de passe</Label>
          <a
            href="#"
            class="ml-auto text-sm underline-offset-4 hover:underline"
          >
            Mot de passe oublié ?
          </a>
        </div>
        <Input
          id="password"
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>
      <Button type="submit" class="w-full" :disabled="loading">
        {{ loading ? 'Connexion en cours...' : 'Se connecter' }}
      </Button>
    </div>
  </form>
</template>
