export interface Customer {
  id: number
  name: string
  lastname: string
  address?: string
  postalcode: number
  city: string
  country?: string
  phonenumber?: number
  mail?: string
  fidelity?: boolean
  authorizesms?: boolean
  authorizemailing?: boolean
  discount?: number
  alert?: string
  information?: string
}
