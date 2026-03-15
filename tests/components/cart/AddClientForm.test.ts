import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AddClientForm from '@/components/caisse/AddClientForm.vue'

const DialogContentStub = { template: '<div><slot /></div>' }
const DialogHeaderStub = { template: '<div><slot /></div>' }
const DialogFooterStub = { template: '<div><slot /></div>' }
const DialogTitleStub = { template: '<div><slot /></div>' }
const DialogDescriptionStub = { template: '<div><slot /></div>' }
const InputStub = {
  props: ['modelValue', 'id', 'type', 'placeholder'],
  template: `<input v-bind="$attrs" :id="id" :type="type || 'text'" :placeholder="placeholder" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const TextareaStub = {
  props: ['modelValue'],
  template: `<textarea v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)"></textarea>`
}
const ButtonStub = { template: '<button @click="$emit(\'click\')" type="submit"><slot /></button>' }
const SwitchStub = {
  props: ['checked'],
  template: `<input type="checkbox" :checked="checked" @change="$emit('update:checked', $event.target.checked)" />`
}
const LabelStub = { template: '<label><slot /></label>' }
const SimpleStub = { template: '<div><slot /></div>' }

const toastMock = {
  success: vi.fn(),
  error: vi.fn()
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: toastMock.success, error: toastMock.error })
}))

vi.mock('@/stores/customer', () => ({
  useCustomerStore: () => ({
    loaded: true,
    loadCustomers: vi.fn(async () => {})
  })
}))

vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedEstablishmentId: { value: null },
    initialize: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/composables/useGeoApi', () => ({
  useGeoApi: () => ({
    fetchCommunesByPostalCode: vi.fn().mockResolvedValue([])
  })
}))

describe('AddClientForm', () => {
  beforeEach(() => {
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mountComponent() {
    return mount(AddClientForm, {
      global: {
        stubs: {
          DialogContent: DialogContentStub,
          DialogHeader: DialogHeaderStub,
          DialogTitle: DialogTitleStub,
          DialogDescription: DialogDescriptionStub,
          DialogFooter: DialogFooterStub,
          Input: InputStub,
          Textarea: TextareaStub,
          Button: ButtonStub,
          Switch: SwitchStub,
          Label: LabelStub,
          ScrollArea: SimpleStub,
          Separator: SimpleStub,
          Badge: SimpleStub,
          MapPin: { template: '<span />' },
          Loader2: { template: '<span />' }
        }
      }
    })
  }

  it('valide les champs obligatoires (gdprConsent requis)', async () => {
    vi.stubGlobal('$fetch', vi.fn())
    const wrapper = mountComponent()

    await wrapper.find('form').trigger('submit.prevent')
    expect(toastMock.error).toHaveBeenCalled()
  })

  it('envoie le client avec succès et affiche le toast', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ id: 1, firstName: 'John', lastName: 'Doe' }))
    const wrapper = mountComponent()

    // Remplir les champs
    const firstNameInput = wrapper.find('input#firstName')
    const lastNameInput = wrapper.find('input#lastName')
    if (firstNameInput.exists()) await firstNameInput.setValue('John')
    if (lastNameInput.exists()) await lastNameInput.setValue('Doe')

    // Cocher gdprConsent (requis pour soumettre)
    const vm = wrapper.vm as any
    vm.form.gdprConsent = true

    await wrapper.find('form').trigger('submit.prevent')
    await new Promise(resolve => setTimeout(resolve))
    expect(toastMock.success).toHaveBeenCalled()
  })
})
