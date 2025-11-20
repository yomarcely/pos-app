export interface Customer {
  id: number
  name: string | null
  lastname: string | null
  address?: string
  postalcode?: string
  city?: string
  country?: string
  phonenumber?: string
  mail?: string
  fidelity?: boolean
  authorizesms?: boolean
  authorizemailing?: boolean
  discount?: number
  alert?: string
  information?: string
  points?: number
  createdAt?: Date | string
}
