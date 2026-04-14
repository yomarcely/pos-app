export type ShortcutType = 'product' | 'discount' | 'navigation' | 'client' | 'tab'

export interface ShortcutBase {
  id: string
  label: string
  color: string
  type: ShortcutType
}

export interface ProductShortcut extends ShortcutBase {
  type: 'product'
  productId: number
  productName: string
  variation?: string
  image?: string | null
}

export interface DiscountShortcut extends ShortcutBase {
  type: 'discount'
  percent: number
}

export interface NavigationShortcut extends ShortcutBase {
  type: 'navigation'
  path: string
}

export interface ClientShortcut extends ShortcutBase {
  type: 'client'
  clientId: number
  clientName: string
}

export interface TabShortcut extends ShortcutBase {
  type: 'tab'
  tabId: string
  tabName: string
}

export type Shortcut =
  | ProductShortcut
  | DiscountShortcut
  | NavigationShortcut
  | ClientShortcut
  | TabShortcut

export interface ShortcutCell {
  position: number
  shortcut: Shortcut | null
}

export interface ShortcutTab {
  id: string
  name: string
  cells: ShortcutCell[]
}
