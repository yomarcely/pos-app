import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PendingCartForm from '@/components/caisse/PendingCartForm.vue'

const DialogContentStub = { template: '<div><slot /></div>' }
const TableStub = { template: '<table><slot /></table>' }
const TableSectionStub = { template: '<tbody><slot /></tbody>' }
const TableRowStub = { template: '<tr><slot /></tr>' }
const TableCellStub = { template: '<td><slot /></td>' }
const ButtonStub = { template: '<button @click="$emit(\'click\')"><slot /></button>' }

const cartStoreMock = {
  pendingCart: [] as any[],
  recoverPendingCart: vi.fn()
}
const customerStoreMock = {
  clients: [{ id: 1, name: 'Client' }]
}

vi.mock('@/stores/cart', () => ({
  useCartStore: () => cartStoreMock
}))
vi.mock('@/stores/customer', () => ({
  useCustomerStore: () => customerStoreMock
}))

describe('PendingCartForm', () => {
  beforeEach(() => {
    cartStoreMock.pendingCart = [{
      id: 1,
      clientId: 1,
      items: [{ id: 1, name: 'P1', price: 5, quantity: 2, discount: 0, discountType: '%', variation: '' }]
    }]
    cartStoreMock.recoverPendingCart.mockClear()
  })

  it('sélectionne et récupère un panier en attente', async () => {
    const wrapper = mount(PendingCartForm, {
      global: {
        stubs: {
          DialogContent: DialogContentStub,
          DialogHeader: DialogContentStub,
          DialogTitle: DialogContentStub,
          Button: ButtonStub,
          Table: TableStub,
          TableHead: TableStub,
          TableHeader: TableSectionStub,
          TableRow: TableRowStub,
          TableCell: TableCellStub,
          TableBody: TableSectionStub
        }
      }
    })

    const vm = wrapper.vm as any
    vm.selectedCartId = 1
    await vm.handleRecover()
    expect(cartStoreMock.recoverPendingCart).toHaveBeenCalledWith(1)
  })
})
