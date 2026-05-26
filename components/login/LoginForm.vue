<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const auth = useAuthStore()
const route = useRoute()

const form = reactive({
  email: '',
  password: '',
})

const loading = ref(false)
const error = ref<string | null>(null)

function translateAuthError(message: string): string {
  const translations: Record<string, string> = {
    'Invalid login credentials': 'Email ou mot de passe incorrect',
    'Email not confirmed': 'Veuillez confirmer votre email',
    'Too many requests': 'Trop de tentatives, réessayez dans quelques minutes',
    'User not found': 'Aucun compte trouvé avec cet email',
    'Email rate limit exceeded': 'Trop de tentatives, réessayez dans quelques minutes',
    'Network request failed': 'Erreur réseau, vérifiez votre connexion',
  }
  return translations[message] ?? 'Une erreur est survenue lors de la connexion'
}

const handleSubmit = async () => {
  loading.value = true
  error.value = null

  try {
    await auth.signIn(form.email, form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await navigateTo(redirect)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Échec de connexion'
    error.value = translateAuthError(message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card>
      <CardHeader class="text-center">
        <CardTitle class="text-xl">
          Bon retour parmi nous
        </CardTitle>
        <CardDescription>
          Connectez-vous à votre compte FymPOS
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit">
          <FieldGroup>
            <div v-if="error" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {{ error }}
            </div>

            <Field>
              <Button variant="outline" type="button" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Se connecter avec Google
              </Button>
            </Field>

            <FieldSeparator class="*:data-[slot=field-separator-content]:bg-card">
              Ou avec votre email
            </FieldSeparator>

            <Field>
              <FieldLabel for="email">
                Email
              </FieldLabel>
              <Input
                id="email"
                v-model="form.email"
                type="email"
                placeholder="m@exemple.com"
                autocomplete="email"
                required
              />
            </Field>

            <Field>
              <div class="flex items-center">
                <FieldLabel for="password">
                  Mot de passe
                </FieldLabel>
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
            </Field>

            <Field>
              <Button type="submit" :disabled="loading">
                {{ loading ? 'Connexion en cours...' : 'Se connecter' }}
              </Button>
              <FieldDescription class="text-center">
                Vous n'avez pas de compte ?
                <NuxtLink to="/signup" class="underline underline-offset-4 hover:text-primary">
                  Créer un compte
                </NuxtLink>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
    <FieldDescription class="px-6 text-center">
      En continuant, vous acceptez nos
      <a href="#" class="underline underline-offset-4 hover:text-primary">Conditions d'utilisation</a>
      et notre
      <a href="#" class="underline underline-offset-4 hover:text-primary">Politique de confidentialité</a>.
    </FieldDescription>
  </div>
</template>
