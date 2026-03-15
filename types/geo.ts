export interface Commune {
  nom: string
  code: string
  codesPostaux: string[]
  centre?: {
    type: 'Point'
    coordinates: [number, number]
  }
}
