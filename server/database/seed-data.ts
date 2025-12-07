export const taxRatesSeed = [
  { id: 1, name: 'TVA 20%', rate: 20.00, code: 'T1', description: 'Taux normal', isDefault: true },
  { id: 2, name: 'TVA 10%', rate: 10.00, code: 'T2', description: 'Taux intermédiaire', isDefault: false },
  { id: 3, name: 'TVA 5.5%', rate: 5.50, code: 'T3', description: 'Taux réduit', isDefault: false },
  { id: 4, name: 'TVA 2.1%', rate: 2.10, code: 'T4', description: 'Taux super réduit', isDefault: false },
  { id: 5, name: 'TVA 0%', rate: 0.00, code: 'T0', description: 'Exonéré', isDefault: false },
]

export const categoriesSeed = [
  { id: 1, name: 'E-liquides' },
  { id: 2, name: 'Resistances' },
  { id: 3, name: 'Pods' },
]

export const suppliersSeed = [
  { id: 1, name: 'Grossiste Vape', email: 'contact@grossiste-vape.test', phone: '0102030405' },
  { id: 2, name: 'Fournisseur Local', email: 'hello@fournisseur-local.test', phone: '0607080910' },
]

export const brandsSeed = [
  { id: 1, name: 'GeekVape' },
  { id: 2, name: 'Pulp' },
  { id: 3, name: 'Freeze' },
]

export const variationGroupsSeed = [
  { id: 1, name: 'Resistance' },
  { id: 2, name: 'Couleur' },
  { id: 3, name: 'Nicotine' },
]

export const variationsSeed = [
  { id: 1, groupId: 1, name: '0.15', sortOrder: 1 },
  { id: 2, groupId: 1, name: '0.2', sortOrder: 2 },
  { id: 3, groupId: 2, name: 'Noir', sortOrder: 1 },
  { id: 4, groupId: 2, name: 'Bleu', sortOrder: 2 },
  { id: 5, groupId: 2, name: 'Vert', sortOrder: 3 },
  { id: 6, groupId: 3, name: '0mg', sortOrder: 1 },
  { id: 7, groupId: 3, name: '3mg', sortOrder: 2 },
  { id: 8, groupId: 3, name: '6mg', sortOrder: 3 },
]

export const sellersSeed = [
  { id: 1, name: 'Yohan', code: 'SLR-001' },
  { id: 2, name: 'Jade', code: 'SLR-002' },
  { id: 3, name: 'Diego', code: 'SLR-003' },
]

export const customersSeed = [
  { id: 1, firstName: 'Yohan', lastName: 'Marcel', city: 'Cavaillon', postalCode: '84300' },
  { id: 2, firstName: 'Jade', lastName: 'Fachinetti', city: 'Avignon', postalCode: '84000' },
  { id: 3, firstName: 'Diego', lastName: 'Lupu', city: 'Cavaillon', postalCode: '84300' },
]

export const productsSeed = [
  {
    id: 1,
    name: 'Freeze Fruit du Dragon 50ml',
    barcode: '1234567890123',
    price: 14.9,
    purchasePrice: 8.9,
    tva: 20,
    categoryId: 1,
    supplierId: 1,
    brandId: 3,
    stock: 10,
    image: '/assets/img/freeze-dragon.png',
  },
  {
    id: 2,
    name: 'Booster 50/50',
    price: 1,
    purchasePrice: 0.2,
    tva: 10,
    categoryId: 1,
    supplierId: 2,
    brandId: 2,
    stock: 400,
    image: '/assets/img/booster.png',
  },
  {
    id: 3,
    name: 'GeekVape Serie Z',
    price: 3.5,
    purchasePrice: 1,
    tva: 20,
    categoryId: 2,
    supplierId: 1,
    brandId: 1,
    variationIds: [1, 2],
    stockByVariation: {
      '1': 10,
      '2': 18,
    },
    image: '/assets/img/series-z.png',
  },
  {
    id: 4,
    name: 'GeekVape Serie B',
    price: 3.5,
    purchasePrice: 1,
    tva: 20,
    categoryId: 2,
    supplierId: 1,
    brandId: 1,
    variationIds: [1, 2],
    stockByVariation: {
      '1': 8,
      '2': 4,
    },
    image: '/assets/img/series-z.png',
  },
  {
    id: 5,
    name: 'GeekVape Z nano 2',
    price: 24.9,
    purchasePrice: 12,
    tva: 20,
    categoryId: 3,
    supplierId: 1,
    brandId: 1,
    variationIds: [3, 4, 5],
    stockByVariation: {
      '3': 2,
      '4': 5,
      '5': 1,
    },
    image: '/assets/img/z-nano.png',
  },
  {
    id: 6,
    name: 'Pulp Cerise Glacee 10ml',
    price: 5.9,
    purchasePrice: 2.5,
    tva: 20,
    categoryId: 1,
    supplierId: 2,
    brandId: 2,
    variationIds: [6, 7, 8],
    stockByVariation: {
      '6': 10,
      '7': 0,
      '8': 6,
    },
    image: '/assets/img/pulp-cerise.png',
  },
]
