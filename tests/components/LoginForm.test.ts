import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginForm from '@/components/login/LoginForm.vue'

describe('LoginForm', () => {
  it('affiche le formulaire de connexion', () => {
    const wrapper = mount(LoginForm)

    expect(wrapper.find('h1').text()).toBe('Login to your account')
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('contient les labels appropriés', () => {
    const wrapper = mount(LoginForm)

    expect(wrapper.text()).toContain('Email')
    expect(wrapper.text()).toContain('Password')
  })

  it('affiche le lien "Forgot your password"', () => {
    const wrapper = mount(LoginForm)

    expect(wrapper.text()).toContain('Forgot your password?')
  })

  it('affiche le bouton de connexion', () => {
    const wrapper = mount(LoginForm)

    const loginButton = wrapper.find('button[type="submit"]')
    expect(loginButton.exists()).toBe(true)
    expect(loginButton.text()).toBe('Login')
  })

  it('affiche le bouton de connexion GitHub', () => {
    const wrapper = mount(LoginForm)

    expect(wrapper.text()).toContain('Login with GitHub')
  })

  it('affiche le lien d\'inscription', () => {
    const wrapper = mount(LoginForm)

    expect(wrapper.text()).toContain('Don\'t have an account?')
    expect(wrapper.text()).toContain('Sign up')
  })

  it('les champs email et password sont requis', () => {
    const wrapper = mount(LoginForm)

    const emailInput = wrapper.find('input[type="email"]')
    const passwordInput = wrapper.find('input[type="password"]')

    expect(emailInput.attributes('required')).toBeDefined()
    expect(passwordInput.attributes('required')).toBeDefined()
  })

  it('le champ email a un placeholder', () => {
    const wrapper = mount(LoginForm)

    const emailInput = wrapper.find('input[type="email"]')
    expect(emailInput.attributes('placeholder')).toBe('m@example.com')
  })
})
