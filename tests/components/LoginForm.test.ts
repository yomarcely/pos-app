import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LoginForm from '@/components/login/LoginForm.vue'

// Mock the auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    signIn: vi.fn().mockResolvedValue(undefined)
  })
}))

// Mock useToast
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn()
  })
}))

// Mock Nuxt auto-imports
const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useRoute', () => ({ query: {} }))

describe('LoginForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    navigateToMock.mockClear()
  })

  function mountForm() {
    return mount(LoginForm, {
      global: {
        stubs: {
          Button: { template: '<button v-bind="$attrs" :type="type || \'button\'" @click="$emit(\'click\')"><slot /></button>', props: ['type', 'disabled', 'variant'] },
          Input: {
            props: ['modelValue', 'type', 'placeholder', 'autocomplete', 'required', 'id'],
            template: '<input v-bind="$attrs" :type="type" :placeholder="placeholder" :required="required" :id="id" />'
          },
          Label: { template: '<label><slot /></label>' },
          Separator: { template: '<hr />' }
        }
      }
    })
  }

  it('affiche le formulaire de connexion', () => {
    const wrapper = mountForm()
    expect(wrapper.find('h1').text()).toContain('Connectez-vous')
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('contient les labels appropriés', () => {
    const wrapper = mountForm()
    expect(wrapper.text()).toContain('Email')
    expect(wrapper.text()).toContain('Mot de passe')
  })

  it('affiche le lien "Mot de passe oublié"', () => {
    const wrapper = mountForm()
    expect(wrapper.text()).toContain('Mot de passe oublié')
  })

  it('affiche le bouton de connexion', () => {
    const wrapper = mountForm()
    const submitButton = wrapper.find('button[type="submit"]')
    expect(submitButton.exists()).toBe(true)
    expect(submitButton.text()).toContain('Se connecter')
  })

  it('affiche le bouton de connexion Google', () => {
    const wrapper = mountForm()
    expect(wrapper.text()).toContain('Google')
  })

  it('affiche le lien d\'inscription', () => {
    const wrapper = mountForm()
    expect(wrapper.text()).toContain('Vous n\'avez pas de compte')
    expect(wrapper.text()).toContain('Créer un compte')
  })

  it('les champs email et password sont requis', () => {
    const wrapper = mountForm()
    const emailInput = wrapper.find('input[type="email"]')
    const passwordInput = wrapper.find('input[type="password"]')
    expect(emailInput.attributes('required')).toBeDefined()
    expect(passwordInput.attributes('required')).toBeDefined()
  })

  it('le champ email a un placeholder', () => {
    const wrapper = mountForm()
    const emailInput = wrapper.find('input[type="email"]')
    expect(emailInput.attributes('placeholder')).toBe('m@exemple.com')
  })
})
