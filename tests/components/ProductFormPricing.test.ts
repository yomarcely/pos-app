import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ProductFormPricing from '@/components/produits/form/ProductFormPricing.vue'

// Mock Nuxt useFetch auto-import
vi.stubGlobal('useFetch', vi.fn().mockResolvedValue({
  data: ref([
    { id: 1, name: 'TVA 20%', code: 'TVA20', rate: '20', description: null, isDefault: true },
    { id: 2, name: 'TVA 10%', code: 'TVA10', rate: '10', description: null, isDefault: false }
  ]),
  pending: ref(false)
}))

vi.stubGlobal('navigateTo', vi.fn())

const InputStub = {
  props: ['modelValue', 'id', 'type', 'step', 'min', 'placeholder', 'class'],
  template: `<input v-bind="$attrs" :id="id" :type="type || 'text'" :step="step" :placeholder="placeholder" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const SelectStub = {
  props: ['modelValue'],
  template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><slot /></select>`
}
const SelectItemStub = {
  props: ['value'],
  template: `<option :value="value"><slot /></option>`
}
const ButtonStub = { template: `<button @click="$emit('click')"><slot /></button>` }
const SimpleStub = { template: '<div><slot /></div>' }
const IconStub = { template: '<span />' }

describe('ProductFormPricing', () => {
  beforeEach(() => {
    vi.stubGlobal('useFetch', vi.fn().mockReturnValue({
      data: ref([
        { id: 1, name: 'TVA 20%', code: 'TVA20', rate: '20', description: null, isDefault: true }
      ]),
      pending: ref(false)
    }))
    vi.stubGlobal('navigateTo', vi.fn())
  })

  const categories = [{ id: 1, name: 'Cat' }]
  const form = {
    price: '10',
    purchasePrice: '5',
    tva: '20',
    tvaId: null as number | null,
    categoryId: null as string | null
  }

  async function mountComponent() {
    const wrapper = mount(
      {
        components: { ProductFormPricing },
        template: `<Suspense><ProductFormPricing :form="form" :categories="categories" @update:form="$emit('update:form', $event)" /></Suspense>`,
        props: {
          form: { type: Object, default: () => form },
          categories: { type: Array, default: () => categories }
        },
        emits: ['update:form']
      },
      {
        props: { form, categories },
        global: {
          stubs: {
            Card: SimpleStub,
            CardHeader: SimpleStub,
            CardTitle: SimpleStub,
            CardDescription: SimpleStub,
            CardContent: SimpleStub,
            Label: SimpleStub,
            Input: InputStub,
            Button: ButtonStub,
            Select: SelectStub,
            SelectTrigger: SimpleStub,
            SelectContent: SimpleStub,
            SelectItem: SelectItemStub,
            SelectValue: SimpleStub,
            Plus: IconStub
          }
        }
      }
    )
    // Wait for Suspense to resolve
    await new Promise(resolve => setTimeout(resolve, 10))
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('émet update:form pour prix/achat/tva/catégorie', async () => {
    const wrapper = await mountComponent()
    const purchaseInput = wrapper.find('input#purchasePrice')
    const priceInput = wrapper.find('input#price')
    expect(purchaseInput.exists()).toBe(true)
    expect(priceInput.exists()).toBe(true)

    await priceInput.setValue('15')
    await purchaseInput.setValue('7')

    const emits = (wrapper.emitted()['update:form'] as any[]) || []
    const priceUpdate = emits.find((e: any) => e[0]?.price === '15')
    const purchaseUpdate = emits.find((e: any) => e[0]?.purchasePrice === '7')
    expect(priceUpdate?.[0]?.price).toBe('15')
    expect(purchaseUpdate?.[0]?.purchasePrice).toBe('7')
  })

  it('affiche la marge et le taux', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.text()).toContain('5.00') // marge brute 10-5
    expect(wrapper.text()).toContain('100.00%') // marge / achat
  })
})
