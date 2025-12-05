<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useSupabaseClient } from '@/composables/useSupabaseClient'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

const supabase = useSupabaseClient()
const toast = useToast()
const router = useRouter()

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const loading = ref(false)
const error = ref<string | null>(null)

const passwordsMatch = computed(() => {
  if (!form.confirmPassword) return true
  return form.password === form.confirmPassword
})

const passwordValid = computed(() => {
  return form.password.length >= 8
})

const handleSubmit = async () => {
  error.value = null

  // Validation
  if (!passwordValid.value) {
    error.value = 'Le mot de passe doit contenir au moins 8 caractères'
    toast.error(error.value)
    return
  }

  if (!passwordsMatch.value) {
    error.value = 'Les mots de passe ne correspondent pas'
    toast.error(error.value)
    return
  }

  loading.value = true

  try {
    // Création du compte avec Supabase
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name,
        },
      },
    })

    if (signUpError) {
      throw signUpError
    }

    if (data.user) {
      toast.success('Compte créé avec succès ! Bienvenue !')

      // Redirection vers le dashboard
      await router.push('/dashboard')
    }
  } catch (err: any) {
    const message = err?.message || 'Erreur lors de la création du compte'
    error.value = message
    toast.error(message)
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
          Créez votre compte
        </CardTitle>
        <CardDescription>
          Entrez vos informations ci-dessous pour créer votre compte
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit">
          <FieldGroup>
            <div v-if="error" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {{ error }}
            </div>

            <Field>
              <FieldLabel for="name">
                Nom complet
              </FieldLabel>
              <Input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="Jean Dupont"
                required
              />
            </Field>
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
              <Field class="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel for="password">
                    Mot de passe
                  </FieldLabel>
                  <Input
                    id="password"
                    v-model="form.password"
                    type="password"
                    autocomplete="new-password"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel for="confirm-password">
                    Confirmer le mot de passe
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    v-model="form.confirmPassword"
                    type="password"
                    autocomplete="new-password"
                    :class="!passwordsMatch ? 'border-destructive' : ''"
                    required
                  />
                </Field>
              </Field>
              <FieldDescription :class="!passwordValid && form.password ? 'text-destructive' : ''">
                Doit contenir au moins 8 caractères.
              </FieldDescription>
              <FieldDescription v-if="!passwordsMatch && form.confirmPassword" class="text-destructive">
                Les mots de passe ne correspondent pas.
              </FieldDescription>
            </Field>
            <Field>
              <Button type="submit" :disabled="loading || !passwordsMatch || !passwordValid">
                {{ loading ? 'Création en cours...' : 'Créer mon compte' }}
              </Button>
              <FieldDescription class="text-center">
                Vous avez déjà un compte ? <a href="/login" class="underline underline-offset-4 hover:text-primary">Se connecter</a>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
    <FieldDescription class="px-6 text-center text-muted-foreground">
      En continuant, vous acceptez nos <a href="#" class="underline underline-offset-4 hover:text-primary">Conditions d'utilisation</a>
      et notre <a href="#" class="underline underline-offset-4 hover:text-primary">Politique de confidentialité</a>.
    </FieldDescription>
  </div>
</template>
