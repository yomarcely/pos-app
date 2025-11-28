import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AddClientForm from '@/components/caisse/AddClientForm.vue'

const DialogContentStub = { template: '<div><slot /></div>' }
const DialogHeaderStub = { template: '<div><slot /></div>' }
const DialogFooterStub = { template: '<div><slot /></div>' }
const DialogTitleStub = { template: '<div><slot /></div>' }
const DialogDescriptionStub = { template: '<div><slot /></div>' }
const InputStub = {
  props: ['modelValue'],
  template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
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

const toastMock = {
  success: vi.fn(),
  error: vi.fn()
}

const customerStoreMock = {
  loaded: true,
  loadCustomers: vi.fn(async () => {})
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: toastMock.success, error: toastMock.error })
}))

vi.mock('@/stores/customer', () => ({
  useCustomerStore: () => customerStoreMock
}))

describe('AddClientForm', () => {
  beforeEach(() => {
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    customerStoreMock.loadCustomers.mockClear()
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('valide les champs obligatoires', async () => {
    const wrapper = mount(AddClientForm, {
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
          Label: LabelStub
        }
      }
    })

    await wrapper.find('form').trigger('submit.prevent')
    expect(toastMock.error).toHaveBeenCalled()
  })

  it('envoie le client et recharge le store', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ success: true, customer: { id: 1, name: 'John' } }))
    const wrapper = mount(AddClientForm, {
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
          Label: LabelStub
        }
      }
    })

    await wrapper.find('input#lastname').setValue('Doe')
    await wrapper.find('input#name').setValue('John')
    await wrapper.find('input#postalcode').setValue('75000')

    await wrapper.find('form').trigger('submit.prevent')
    await new Promise(resolve => setTimeout(resolve))
    expect(customerStoreMock.loadCustomers).toHaveBeenCalled()
    expect(toastMock.success).toHaveBeenCalled()
  })
})
