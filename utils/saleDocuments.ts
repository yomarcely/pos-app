/**
 * Générateurs HTML pour ticket de caisse (~80mm thermique) et facture A4.
 * Pas de dépendance DOM : pures fonctions, testables sans navigateur.
 */

export interface SaleDocumentItem {
  name: string
  variation?: string | null
  quantity: number
  unitPrice: number // prix unitaire après remise de ligne
  originalPrice: number // prix unitaire avant remise
  discount: number
  discountType: '%' | '€'
  tva: number // taux %
}

export interface SaleDocumentEstablishment {
  name: string
  address?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  siret?: string | null
  naf?: string | null
  tvaNumber?: string | null
}

export interface SaleDocumentCustomer {
  firstName: string | null
  lastName: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  email?: string | null
}

export interface SaleDocumentLoyalty {
  pointsEarned?: number // points gagnés sur cette vente
  pointsConsumed?: number // points consommés (si avantage utilisé)
  pointsTotalAfter?: number // total après cette vente — affiché au client
  generatedVoucher?: {
    code: string
    amount: number
    expiresAt?: Date | string | null
  } | null
}

export interface SaleDocumentData {
  ticketNumber: string
  saleDate: Date | string
  hash: string
  signature?: string
  establishment: SaleDocumentEstablishment
  registerName: string
  sellerName: string
  customer: SaleDocumentCustomer | null
  items: SaleDocumentItem[]
  payments: { mode: string, amount: number }[]
  totals: { totalHT: number, totalTVA: number, totalTTC: number }
  changeDue?: number // rendu monnaie (si > 0)
  loyalty?: SaleDocumentLoyalty | null
}

const EUR = (n: number) => `${n.toFixed(2)} €`

function escape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatAddress(parts: { address?: string | null, postalCode?: string | null, city?: string | null }): string {
  const lines: string[] = []
  if (parts.address) lines.push(escape(parts.address))
  const cp = [parts.postalCode, parts.city].filter(Boolean).join(' ')
  if (cp) lines.push(escape(cp))
  return lines.join('<br>')
}

function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Ticket thermique 80mm — police monospace, layout compact.
 * @page CSS définit la largeur d'impression ; @media print masque le navigateur.
 */
export function buildReceiptHtml(data: SaleDocumentData): string {
  const customerLine = data.customer
    ? `<div class="row">Client : ${escape(`${data.customer.firstName ?? ''} ${data.customer.lastName ?? ''}`.trim() || '-')}</div>`
    : ''

  const itemsHtml = data.items.map((item) => {
    const variation = item.variation ? ` (${escape(item.variation)})` : ''
    const lineTotal = item.unitPrice * item.quantity
    const discountInfo = item.discount > 0
      ? `<div class="muted small">  Remise : ${escape(item.discount)}${escape(item.discountType)} (avant ${EUR(item.originalPrice)})</div>`
      : ''
    return `
<div class="item">
  <div>${escape(item.name)}${variation}</div>
  <div class="row"><span>${item.quantity} × ${EUR(item.unitPrice)}</span><span>${EUR(lineTotal)}</span></div>
  ${discountInfo}
</div>`
  }).join('')

  const paymentsHtml = data.payments
    .map(p => `<div class="row"><span>${escape(p.mode)}</span><span>${EUR(p.amount)}</span></div>`)
    .join('')

  const changeHtml = data.changeDue && data.changeDue > 0
    ? `<div class="row bold"><span>Rendu</span><span>${EUR(data.changeDue)}</span></div>`
    : ''

  const legalHtml = [
    data.establishment.siret ? `SIRET : ${escape(data.establishment.siret)}` : '',
    data.establishment.naf ? `NAF : ${escape(data.establishment.naf)}` : '',
    data.establishment.tvaNumber ? `TVA : ${escape(data.establishment.tvaNumber)}` : '',
  ].filter(Boolean).join('<br>')

  // Bloc fidélité : visible uniquement s'il y a de l'activité (gain, conso, ou voucher)
  const loyalty = data.loyalty
  const hasLoyaltyContent = loyalty
    && ((loyalty.pointsEarned ?? 0) > 0
      || (loyalty.pointsConsumed ?? 0) > 0
      || loyalty.generatedVoucher)
  const loyaltyHtml = hasLoyaltyContent && loyalty
    ? `<hr>
<div class="loyalty">
  <div class="center bold">★ FIDÉLITÉ ★</div>
  ${(loyalty.pointsEarned ?? 0) > 0 ? `<div class="row"><span>Points gagnés</span><span>+${loyalty.pointsEarned}</span></div>` : ''}
  ${(loyalty.pointsConsumed ?? 0) > 0 ? `<div class="row"><span>Points utilisés</span><span>-${loyalty.pointsConsumed}</span></div>` : ''}
  ${typeof loyalty.pointsTotalAfter === 'number' ? `<div class="row bold"><span>Total après vente</span><span>${loyalty.pointsTotalAfter} pts</span></div>` : ''}
  ${loyalty.generatedVoucher
    ? `<div style="margin-top:6px">
  <div class="center small">Bon d'achat généré</div>
  <div class="center bold" style="font-size:14px;letter-spacing:2px">${escape(loyalty.generatedVoucher.code)}</div>
  <div class="center">Montant : ${EUR(loyalty.generatedVoucher.amount)}</div>
  ${loyalty.generatedVoucher.expiresAt ? `<div class="center small">Valable jusqu'au ${escape(formatDate(loyalty.generatedVoucher.expiresAt))}</div>` : ''}
</div>`
    : ''}
</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Ticket ${escape(data.ticketNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  @media print { body { margin: 0; } }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; color: #000; }
  h1 { font-size: 13px; text-align: center; margin: 4px 0; }
  .center { text-align: center; }
  .muted { color: #555; }
  .small { font-size: 10px; }
  .bold { font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; }
  .item { margin: 2px 0; }
  .totals .row { margin: 1px 0; }
  .totals .ttc { font-size: 13px; font-weight: bold; margin-top: 2px; }
</style>
</head>
<body>
  <h1>${escape(data.establishment.name)}</h1>
  <div class="center small">
    ${formatAddress(data.establishment)}
    ${data.establishment.phone ? `<br>Tél : ${escape(data.establishment.phone)}` : ''}
  </div>
  <hr>
  <div class="row"><span>Ticket :</span><span>${escape(data.ticketNumber)}</span></div>
  <div class="row"><span>Date :</span><span>${escape(formatDate(data.saleDate))}</span></div>
  <div class="row"><span>Caisse :</span><span>${escape(data.registerName)}</span></div>
  <div class="row"><span>Vendeur :</span><span>${escape(data.sellerName)}</span></div>
  ${customerLine}
  <hr>
  ${itemsHtml}
  <hr>
  <div class="totals">
    <div class="row"><span>Total HT</span><span>${EUR(data.totals.totalHT)}</span></div>
    <div class="row"><span>TVA</span><span>${EUR(data.totals.totalTVA)}</span></div>
    <div class="row ttc"><span>Total TTC</span><span>${EUR(data.totals.totalTTC)}</span></div>
  </div>
  <hr>
  ${paymentsHtml}
  ${changeHtml}
  ${loyaltyHtml}
  <hr>
  ${legalHtml ? `<div class="center small">${legalHtml}</div><hr>` : ''}
  <div class="center small muted">
    NF525 hash : ${escape(data.hash.substring(0, 16))}…<br>
    ${data.signature ? `Signature : ${escape(data.signature.substring(0, 16))}…<br>` : ''}
  </div>
  <div class="center" style="margin-top:6px">Merci de votre visite !</div>
</body>
</html>`
}

/**
 * Facture A4 — entête boutique gauche, infos client droite, table items, totaux par taux TVA.
 */
export function buildInvoiceHtml(data: SaleDocumentData): string {
  // Regroupement TVA par taux (nécessaire pour la facture conforme)
  const tvaBuckets = new Map<number, { ht: number, tva: number }>()
  for (const item of data.items) {
    const lineTtc = item.unitPrice * item.quantity
    const lineHt = lineTtc / (1 + item.tva / 100)
    const lineTva = lineTtc - lineHt
    const bucket = tvaBuckets.get(item.tva) ?? { ht: 0, tva: 0 }
    bucket.ht += lineHt
    bucket.tva += lineTva
    tvaBuckets.set(item.tva, bucket)
  }

  const tvaRows = Array.from(tvaBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, { ht, tva }]) => `
      <tr>
        <td>${rate.toFixed(2)} %</td>
        <td class="right">${EUR(ht)}</td>
        <td class="right">${EUR(tva)}</td>
      </tr>`)
    .join('')

  const itemsHtml = data.items.map((item) => {
    const variation = item.variation ? ` <span class="muted">(${escape(item.variation)})</span>` : ''
    const lineTtc = item.unitPrice * item.quantity
    const lineHt = lineTtc / (1 + item.tva / 100)
    const discountCell = item.discount > 0
      ? `${escape(item.discount)}${escape(item.discountType)}`
      : '—'
    return `
      <tr>
        <td>${escape(item.name)}${variation}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${EUR(item.originalPrice)}</td>
        <td class="right">${discountCell}</td>
        <td class="right">${item.tva.toFixed(1)}%</td>
        <td class="right">${EUR(lineHt)}</td>
        <td class="right">${EUR(lineTtc)}</td>
      </tr>`
  }).join('')

  const paymentsHtml = data.payments
    .map(p => `<tr><td>${escape(p.mode)}</td><td class="right">${EUR(p.amount)}</td></tr>`)
    .join('')

  const customerBlock = data.customer
    ? `
      <div class="block">
        <div class="block-title">Facturer à</div>
        <div class="bold">${escape(`${data.customer.firstName ?? ''} ${data.customer.lastName ?? ''}`.trim() || '-')}</div>
        ${formatAddress(data.customer)}
        ${data.customer.email ? `<div>${escape(data.customer.email)}</div>` : ''}
      </div>`
    : ''

  // Bloc fidélité dédié sur la facture (visible si activité)
  const invoiceLoyalty = data.loyalty
  const hasInvoiceLoyalty = invoiceLoyalty
    && ((invoiceLoyalty.pointsEarned ?? 0) > 0
      || (invoiceLoyalty.pointsConsumed ?? 0) > 0
      || invoiceLoyalty.generatedVoucher)
  const loyaltyBlock = hasInvoiceLoyalty && invoiceLoyalty
    ? `
      <div class="block" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:12px;margin-top:18px">
        <div class="block-title" style="color:#b45309">Programme de fidélité</div>
        <table style="width:100%">
          ${(invoiceLoyalty.pointsEarned ?? 0) > 0 ? `<tr><td>Points gagnés sur cette vente</td><td class="right bold">+${invoiceLoyalty.pointsEarned}</td></tr>` : ''}
          ${(invoiceLoyalty.pointsConsumed ?? 0) > 0 ? `<tr><td>Points utilisés pour l'avantage</td><td class="right bold">-${invoiceLoyalty.pointsConsumed}</td></tr>` : ''}
          ${typeof invoiceLoyalty.pointsTotalAfter === 'number' ? `<tr><td>Solde après vente</td><td class="right bold">${invoiceLoyalty.pointsTotalAfter} pts</td></tr>` : ''}
        </table>
        ${invoiceLoyalty.generatedVoucher
          ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #fcd34d">
        <div class="muted">Bon d'achat généré :</div>
        <div style="font-family:monospace;font-size:18px;font-weight:bold;letter-spacing:3px;margin:4px 0">${escape(invoiceLoyalty.generatedVoucher.code)}</div>
        <div>Montant : <span class="bold">${EUR(invoiceLoyalty.generatedVoucher.amount)}</span>${invoiceLoyalty.generatedVoucher.expiresAt ? ` — Valable jusqu'au ${escape(formatDate(invoiceLoyalty.generatedVoucher.expiresAt))}` : ''}</div>
      </div>`
          : ''}
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Facture ${escape(data.ticketNumber)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  @media print { body { margin: 0; } }
  body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; color: #111; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .muted { color: #666; }
  .bold { font-weight: bold; }
  .right { text-align: right; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .header .left, .header .right { width: 48%; }
  .block { margin-bottom: 18px; }
  .block-title { text-transform: uppercase; font-size: 10px; color: #666; letter-spacing: 0.5px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; background: #f3f4f6; padding: 8px; font-size: 10px; text-transform: uppercase; color: #444; }
  th.right { text-align: right; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .totals { margin-top: 18px; width: 50%; margin-left: auto; }
  .totals tr td { padding: 4px 8px; border: none; }
  .totals .ttc td { font-size: 14px; font-weight: bold; border-top: 2px solid #111; padding-top: 8px; }
  .footer { margin-top: 32px; font-size: 10px; color: #555; border-top: 1px solid #ddd; padding-top: 12px; }
  .grid-2 { display: flex; gap: 24px; margin-top: 12px; }
  .grid-2 > div { flex: 1; }
</style>
</head>
<body>
  <div class="header">
    <div class="left">
      <h1>${escape(data.establishment.name)}</h1>
      ${formatAddress(data.establishment)}
      ${data.establishment.phone ? `<div>Tél : ${escape(data.establishment.phone)}</div>` : ''}
      ${data.establishment.email ? `<div>${escape(data.establishment.email)}</div>` : ''}
    </div>
    <div class="right">
      <h1 style="text-align:right">FACTURE</h1>
      <div class="right"><span class="muted">N° :</span> <span class="bold">${escape(data.ticketNumber)}</span></div>
      <div class="right"><span class="muted">Date :</span> ${escape(formatDate(data.saleDate))}</div>
      <div class="right"><span class="muted">Vendeur :</span> ${escape(data.sellerName)}</div>
    </div>
  </div>

  ${customerBlock}

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th class="right">Qté</th>
        <th class="right">PU TTC</th>
        <th class="right">Remise</th>
        <th class="right">TVA</th>
        <th class="right">Total HT</th>
        <th class="right">Total TTC</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="grid-2">
    <div>
      <div class="block-title" style="margin-top:18px">Détail TVA</div>
      <table>
        <thead>
          <tr><th>Taux</th><th class="right">Base HT</th><th class="right">Montant TVA</th></tr>
        </thead>
        <tbody>${tvaRows}</tbody>
      </table>
    </div>
    <div>
      <div class="block-title" style="margin-top:18px">Paiements</div>
      <table>
        <thead><tr><th>Mode</th><th class="right">Montant</th></tr></thead>
        <tbody>${paymentsHtml}</tbody>
      </table>
    </div>
  </div>

  <table class="totals">
    <tr><td>Total HT</td><td class="right">${EUR(data.totals.totalHT)}</td></tr>
    <tr><td>TVA</td><td class="right">${EUR(data.totals.totalTVA)}</td></tr>
    <tr class="ttc"><td>Total TTC</td><td class="right">${EUR(data.totals.totalTTC)}</td></tr>
  </table>

  ${loyaltyBlock}

  <div class="footer">
    <div>
      ${data.establishment.siret ? `SIRET : ${escape(data.establishment.siret)}` : ''}
      ${data.establishment.naf ? ` — NAF : ${escape(data.establishment.naf)}` : ''}
      ${data.establishment.tvaNumber ? ` — TVA : ${escape(data.establishment.tvaNumber)}` : ''}
    </div>
    <div class="muted" style="margin-top:6px">
      Conforme NF525 — Hash : ${escape(data.hash.substring(0, 32))}
      ${data.signature ? ` — Signature : ${escape(data.signature.substring(0, 16))}…` : ''}
    </div>
  </div>
</body>
</html>`
}
