export type ProductBase = {
  id: number
  name: string
  price: number
  image: string
  barcode?: string
  variationGroupId?: string
}

export type ProductInCart = ProductBase & {
  quantity: number
  discount: number
  discountType: '%' | '€'
  variation: string
}