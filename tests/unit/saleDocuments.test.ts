import { describe, it, expect } from 'vitest'
import {
  buildReceiptHtml,
  buildInvoiceHtml,
  type SaleDocumentData,
} from '@/utils/saleDocuments'

function makeData(overrides: Partial<SaleDocumentData> = {}): SaleDocumentData {
  return {
    ticketNumber: '20260425-E01-R01-000042',
    saleDate: new Date('2026-04-25T14:30:00Z'),
    hash: 'abcdef1234567890fedcba0987654321',
    signature: 'TEMP_SIGNATURE_xyz789',
    establishment: {
      name: 'Boutique Centre',
      address: '12 rue de la Paix',
      postalCode: '75002',
      city: 'Paris',
      country: 'France',
      phone: '01 42 12 34 56',
      email: 'contact@boutique.fr',
      siret: '12345678901234',
      naf: '4711F',
      tvaNumber: 'FR12345678901',
    },
    registerName: 'Caisse 1',
    sellerName: 'Marie Dupont',
    customer: {
      firstName: 'Jean',
      lastName: 'Martin',
      address: '5 avenue Foch',
      postalCode: '69006',
      city: 'Lyon',
      email: 'jean.martin@example.fr',
    },
    items: [
      {
        name: 'T-shirt rouge',
        variation: 'Taille M',
        quantity: 2,
        unitPrice: 18,
        originalPrice: 20,
        discount: 10,
        discountType: '%',
        tva: 20,
      },
      {
        name: 'Sandwich',
        variation: null,
        quantity: 1,
        unitPrice: 5.5,
        originalPrice: 5.5,
        discount: 0,
        discountType: '€',
        tva: 5.5,
      },
    ],
    payments: [{ mode: 'Carte', amount: 41.5 }],
    totals: { totalHT: 35.21, totalTVA: 6.29, totalTTC: 41.5 },
    ...overrides,
  }
}

describe('buildReceiptHtml', () => {
  it('inclut les infos établissement (nom, adresse, téléphone)', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('Boutique Centre')
    expect(html).toContain('12 rue de la Paix')
    expect(html).toContain('75002 Paris')
    expect(html).toContain('01 42 12 34 56')
  })

  it('inclut numéro ticket, date, caisse, vendeur', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('20260425-E01-R01-000042')
    expect(html).toContain('Caisse 1')
    expect(html).toContain('Marie Dupont')
  })

  it('liste les items avec quantité, prix unitaire, total ligne', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('T-shirt rouge')
    expect(html).toContain('Taille M')
    expect(html).toContain('2 × 18.00 €')
    expect(html).toContain('36.00 €')
  })

  it('affiche le détail remise si discount > 0', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('Remise : 10%')
    expect(html).toContain('avant 20.00 €')
  })

  it('omet le bloc remise si discount = 0', () => {
    const html = buildReceiptHtml(makeData({
      items: [{
        name: 'Item simple', variation: null, quantity: 1,
        unitPrice: 10, originalPrice: 10, discount: 0, discountType: '%', tva: 20,
      }],
    }))
    expect(html).not.toContain('Remise :')
  })

  it('inclut totaux HT / TVA / TTC', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('35.21 €')
    expect(html).toContain('6.29 €')
    expect(html).toContain('41.50 €')
  })

  it('liste les paiements', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('Carte')
    expect(html).toContain('41.50 €')
  })

  it('affiche le rendu monnaie si changeDue > 0', () => {
    const html = buildReceiptHtml(makeData({ changeDue: 8.5 }))
    expect(html).toContain('Rendu')
    expect(html).toContain('8.50 €')
  })

  it('omet le rendu si changeDue = 0 ou absent', () => {
    expect(buildReceiptHtml(makeData())).not.toContain('Rendu')
    expect(buildReceiptHtml(makeData({ changeDue: 0 }))).not.toContain('Rendu')
  })

  it('inclut SIRET / NAF / TVA légales', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('12345678901234')
    expect(html).toContain('4711F')
    expect(html).toContain('FR12345678901')
  })

  it('inclut hash NF525 tronqué', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('abcdef1234567890')
  })

  it('inclut le client si présent', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('Jean Martin')
  })

  it('omet la ligne client si null', () => {
    const html = buildReceiptHtml(makeData({ customer: null }))
    expect(html).not.toContain('Client :')
  })

  it('échappe les caractères HTML pour éviter XSS via nom produit', () => {
    const html = buildReceiptHtml(makeData({
      items: [{
        name: '<script>alert(1)</script>', variation: null, quantity: 1,
        unitPrice: 10, originalPrice: 10, discount: 0, discountType: '%', tva: 20,
      }],
    }))
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('format @page 80mm pour ticket thermique', () => {
    const html = buildReceiptHtml(makeData())
    expect(html).toContain('@page { size: 80mm auto')
  })
})

describe('buildInvoiceHtml', () => {
  it('inclut le titre FACTURE et le numéro', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('FACTURE')
    expect(html).toContain('20260425-E01-R01-000042')
  })

  it('inclut entête boutique complet', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('Boutique Centre')
    expect(html).toContain('contact@boutique.fr')
  })

  it('inclut bloc client avec adresse complète', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('Facturer à')
    expect(html).toContain('Jean Martin')
    expect(html).toContain('5 avenue Foch')
    expect(html).toContain('69006 Lyon')
    expect(html).toContain('jean.martin@example.fr')
  })

  it('omet le bloc client si null', () => {
    const html = buildInvoiceHtml(makeData({ customer: null }))
    expect(html).not.toContain('Facturer à')
  })

  it('table items avec colonnes Désignation / Qté / PU / Remise / TVA / HT / TTC', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('Désignation')
    expect(html).toContain('PU TTC')
    expect(html).toContain('Total HT')
    expect(html).toContain('Total TTC')
  })

  it('regroupe les TVA par taux dans le détail', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('Détail TVA')
    expect(html).toContain('20.00 %')
    expect(html).toContain('5.50 %')
  })

  it('un seul taux TVA → une seule ligne dans détail', () => {
    const html = buildInvoiceHtml(makeData({
      items: [{ name: 'X', variation: null, quantity: 1, unitPrice: 10, originalPrice: 10, discount: 0, discountType: '%', tva: 20 }],
    }))
    // Une seule occurrence "20.00 %" dans la table TVA
    const matches = html.match(/20\.00 %/g) || []
    expect(matches.length).toBe(1)
  })

  it('affiche les paiements en table', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('Paiements')
    expect(html).toContain('Carte')
  })

  it('totaux finaux en bas', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('41.50 €')
  })

  it('inclut SIRET / NAF / TVA dans le footer', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('SIRET : 12345678901234')
    expect(html).toContain('4711F')
    expect(html).toContain('FR12345678901')
  })

  it('inclut hash NF525 (32 chars) dans le footer', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('abcdef1234567890fedcba0987654321')
  })

  it('format @page A4', () => {
    const html = buildInvoiceHtml(makeData())
    expect(html).toContain('@page { size: A4')
  })

  it('échappe les caractères HTML', () => {
    const html = buildInvoiceHtml(makeData({
      customer: {
        firstName: 'John',
        lastName: '<img onerror=alert(1)>',
        address: null,
      },
    }))
    expect(html).not.toContain('<img onerror=alert(1)>')
    expect(html).toContain('&lt;img')
  })

  it('item sans remise → cellule remise affiche "—"', () => {
    const html = buildInvoiceHtml(makeData({
      items: [{ name: 'X', variation: null, quantity: 1, unitPrice: 10, originalPrice: 10, discount: 0, discountType: '%', tva: 20 }],
    }))
    expect(html).toContain('—')
  })
})

describe('Rendu fidélité — ticket', () => {
  it('aucun bloc fidélité si loyalty absent ou sans activité', () => {
    expect(buildReceiptHtml(makeData())).not.toContain('FIDÉLITÉ')
    expect(buildReceiptHtml(makeData({ loyalty: null }))).not.toContain('FIDÉLITÉ')
    expect(buildReceiptHtml(makeData({
      loyalty: { pointsEarned: 0, pointsConsumed: 0, generatedVoucher: null },
    }))).not.toContain('FIDÉLITÉ')
  })

  it('affiche les points gagnés', () => {
    const html = buildReceiptHtml(makeData({
      loyalty: { pointsEarned: 25, pointsConsumed: 0, pointsTotalAfter: 75 },
    }))
    expect(html).toContain('FIDÉLITÉ')
    expect(html).toContain('Points gagnés')
    expect(html).toContain('+25')
    expect(html).toContain('75 pts')
  })

  it('affiche les points utilisés et le solde', () => {
    const html = buildReceiptHtml(makeData({
      loyalty: { pointsEarned: 10, pointsConsumed: 100, pointsTotalAfter: 0 },
    }))
    expect(html).toContain('-100')
    expect(html).toContain('+10')
    expect(html).toContain('0 pts')
  })

  it('affiche le bon d\'achat généré avec code et expiration', () => {
    const html = buildReceiptHtml(makeData({
      loyalty: {
        pointsEarned: 0,
        pointsConsumed: 100,
        generatedVoucher: {
          code: 'ABCD1234',
          amount: 10,
          expiresAt: new Date('2026-08-25T00:00:00Z'),
        },
      },
    }))
    expect(html).toContain('ABCD1234')
    expect(html).toContain('10.00 €')
    expect(html).toContain('Valable')
  })
})

describe('Rendu fidélité — facture A4', () => {
  it('aucun bloc fidélité si pas d\'activité', () => {
    expect(buildInvoiceHtml(makeData())).not.toContain('Programme de fidélité')
  })

  it('affiche le bloc complet avec voucher', () => {
    const html = buildInvoiceHtml(makeData({
      loyalty: {
        pointsEarned: 50,
        pointsConsumed: 100,
        pointsTotalAfter: 0,
        generatedVoucher: {
          code: 'XY99AB12',
          amount: 5,
          expiresAt: new Date('2026-12-31'),
        },
      },
    }))
    expect(html).toContain('Programme de fidélité')
    expect(html).toContain('+50')
    expect(html).toContain('-100')
    expect(html).toContain('XY99AB12')
    expect(html).toContain('5.00 €')
  })

  it('échappe le code voucher si malicieux', () => {
    const html = buildInvoiceHtml(makeData({
      loyalty: {
        pointsEarned: 0,
        pointsConsumed: 100,
        generatedVoucher: {
          code: '<script>x</script>',
          amount: 10,
          expiresAt: null,
        },
      },
    }))
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
