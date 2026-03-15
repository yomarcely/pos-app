import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useSyncGroups } from '@/composables/useSyncGroups'
import { useSyncGroupForm } from '@/composables/useSyncGroupForm'
import { useEditSyncGroup } from '@/composables/useEditSyncGroup'
import { useResync } from '@/composables/useResync'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() })
}))

const fetchMock = vi.fn()

describe('useSyncGroups', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('loadSyncGroups() appelle GET /api/sync-groups', async () => {
    fetchMock.mockResolvedValue({ success: true, syncGroups: [] })
    const { loadSyncGroups } = useSyncGroups()
    await loadSyncGroups()
    expect(fetchMock).toHaveBeenCalledWith('/api/sync-groups')
  })

  it('deleteGroup() appelle DELETE /api/sync-groups/:id/delete', async () => {
    fetchMock.mockResolvedValue({ success: true, syncGroups: [] })
    const { deleteGroup, selectedGroup } = useSyncGroups()
    selectedGroup.value = { id: 5, name: 'Groupe test', establishmentCount: 2, establishments: [], productRules: undefined, customerRules: undefined }
    await deleteGroup()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync-groups/5/delete',
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})

describe('useSyncGroupForm', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('createGroup() appelle POST /api/sync-groups/create', async () => {
    fetchMock.mockResolvedValue({})
    const loadSyncGroups = vi.fn()
    const { createGroup, newGroup } = useSyncGroupForm(loadSyncGroups)
    newGroup.name = 'Mon groupe'
    newGroup.establishmentIds = [1, 2]
    await createGroup()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync-groups/create',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('toggleEstablishmentSelection() modifie correctement newGroup.establishmentIds', () => {
    const loadSyncGroups = vi.fn()
    const { toggleEstablishmentSelection, newGroup } = useSyncGroupForm(loadSyncGroups)
    newGroup.establishmentIds = []
    toggleEstablishmentSelection(1, true)
    expect(newGroup.establishmentIds).toContain(1)
    toggleEstablishmentSelection(1, false)
    expect(newGroup.establishmentIds).not.toContain(1)
  })
})

describe('useResync', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('performResync() appelle POST /api/sync-groups/:id/resync', async () => {
    fetchMock.mockResolvedValue({ message: 'ok' })
    const loadSyncGroups = vi.fn()
    const { performResync, resyncData, resyncDialogOpen } = useResync(loadSyncGroups)
    resyncData.groupId = 7
    resyncData.sourceEstablishmentId = 3
    resyncData.entityType = 'product'
    resyncData.fields = ['name']
    resyncDialogOpen.value = true
    await performResync()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync-groups/7/resync',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
