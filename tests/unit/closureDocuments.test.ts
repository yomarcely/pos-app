import { describe, it, expect } from 'vitest'
import { buildClosureZHtml, type ClosureZData } from '@/utils/closureDocuments'

function makeData(overrides: Partial<ClosureZData> = {}): ClosureZData {
  return {
    closure: {
      id: 42,
      closureDate: '2026-04-26',
      ticketCount: 18,
      cancelledCount: 1,
      totalHT: 1234.56,
      totalTVA: 246.91,
      totalTTC: 1481.47,
      paymentMethods: { 'Espèces': 800, 'Carte': 681.47 },
      closureHash: 'abcdef0123456789abcdef0123456789',
      firstTicketNumber: '20260426-E01-R01-000001',
      lastTicketNumber: '20260426-E01-R01-000018',
      lastTicketHash: 'fedcba9876543210fedcba9876543210',
      closedBy: 'admin@boutique.fr',
      createdAt: new Date('2026-04-26T22:00:00Z'),
    },
    register: { id: 7, name: 'Caisse 1' },
    establishment: {
      name: 'Boutique Centre',
      address: '12 rue de la Paix',
      postalCode: '75002',
      city: 'Paris',
      phone: '01 42 12 34 56',
      email: 'contact@boutique.fr',
      siret: '12345678901234',
      naf: '4711F',
      tvaNumber: 'FR12345678901',
    },
    tvaBreakdown: [
      { rate: 5.5, baseHT: 234.56, montantTVA: 12.90 },
      { rate: 20, baseHT: 1000, montantTVA: 200 },
    ],
    ...overrides,
  }
}

describe('buildClosureZHtml', () => {
  it('inclut titre TICKET Z et numéro de clôture', () => {
    const html = buildClosureZHtml(makeData())
    expect(html).toContain('TICKET Z')
    expect(html).toContain('42')
  })

  it('inclut entête établissement complet', () => {
    const html = buildClosureZHtml(makeData())
    expect(html).toContain('Boutique Centre')
    expect(html).toContain('75002 Paris')
    expect(html).toContain('contact@boutique.fr')
  })

  it('inclut métadonnées (tickets, premier/dernier, opérateur)', () => {
    const html = buildClosureZHtml(makeData())
    expect(html).toContain('18') // ticketCount
    expect(html).toContain('20260426-E01-R01-000001')
    expect(html).toContain('20260426-E01-R01-000018')
    expect(html).toContain('admin@boutique.fr')
  })

  it('affiche les 3 cartes totaux HT / TVA / TTC', () => {
    const html = buildClosureZHtml(makeData())
    expect(html).toContain('1234.56 €')
    expect(html).toContain('246.91 €')
    expect(html).toContain('1481.47 €')
  })

  it('table TVA listée par taux croissant avec base HT et montant TVA', () => {
    const html = buildClosureZHtml(makeData())
    expect(html).toContain('5.50 %')
    expect(html).toContain('20.00 %')
    expect(html).toContain('234.56 €')
    expect(html).toContain('12.90 €')
    expect(html).toContain('200.00 €')
  })

  it('table modes de paiement avec montants', () => {
    const html = buildClosureZHtml(makeData())
    expect(html).toContain('Espèces')
    expect(html).toContain('800.00 €')
    expect(html).toContain('Carte')
    expect(html).toContain('681.47 €')
  })

  it('inclut hashes NF525 (clôture + dernier ticket)', () => {
    const html = buildClosureZHtml(makeData())
    expect(html).toContain('abcdef0123456789abcdef0123456789')
    expect(html).toContain('fedcba9876543210fedcba9876543210')
  })

  it('inclut SIRET / NAF / N° TVA dans le footer', () => {
    const html = buildClosureZHtml(makeData())
    expect(html).toContain('SIRET : 12345678901234')
    expect(html).toContain('NAF : 4711F')
    expect(html).toContain('FR12345678901')
  })

  it('format @page A4', () => {
    expect(buildClosureZHtml(makeData())).toContain('@page { size: A4')
  })

  it('aucune ligne TVA si breakdown vide → message "Aucune ligne TVA"', () => {
    const html = buildClosureZHtml(makeData({ tvaBreakdown: [] }))
    expect(html).toContain('Aucune ligne TVA')
  })

  it('aucun mode de paiement → message dédié', () => {
    const html = buildClosureZHtml(makeData({
      closure: { ...makeData().closure, paymentMethods: {} },
    }))
    expect(html).toContain('Aucun paiement')
  })

  it('échappe les caractères HTML pour anti-XSS', () => {
    const html = buildClosureZHtml(makeData({
      closure: { ...makeData().closure, closedBy: '<script>x</script>' },
    }))
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
