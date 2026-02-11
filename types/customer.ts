export interface Customer {
  id: number
  firstName: string | null
  lastName: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  metadata?: Record<string, any>
  gdprConsent?: boolean
  gdprConsentDate?: Date | string | null
  marketingConsent?: boolean
  loyaltyProgram?: boolean
  discount?: string | number
  notes?: string | null
  alerts?: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
  city?: string | null
  totalRevenue?: number
  loyaltyPoints?: number
}
