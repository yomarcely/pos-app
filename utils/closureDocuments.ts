/**
 * Générateur HTML — Ticket Z (récapitulatif de clôture journalière NF525).
 *
 * Format A4 imprimable. Structure :
 * - Entête établissement (nom, adresse, SIRET/NAF/TVA)
 * - Métadonnées clôture (date, caisse, premier/dernier ticket, opérateur)
 * - Totaux globaux HT / TVA / TTC
 * - Détail TVA par taux
 * - Modes de paiement
 * - Hashes NF525 (clôture + dernier ticket)
 *
 * Pure : aucune dépendance DOM, testable sans navigateur.
 */

export interface ClosureZEstablishment {
  name: string
  address?: string | null
  postalCode?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  siret?: string | null
  naf?: string | null
  tvaNumber?: string | null
}

export interface ClosureZRegister {
  id: number
  name: string
}

export interface ClosureZTvaLine {
  rate: number // % (ex: 20)
  baseHT: number
  montantTVA: number
}

export interface ClosureZData {
  closure: {
    id: number
    closureDate: string // YYYY-MM-DD
    ticketCount: number
    cancelledCount: number
    totalHT: number
    totalTVA: number
    totalTTC: number
    paymentMethods: Record<string, number>
    closureHash: string
    firstTicketNumber: string | null
    lastTicketNumber: string | null
    lastTicketHash: string | null
    closedBy: string | null
    createdAt: Date | string
  }
  register: ClosureZRegister | null
  establishment: ClosureZEstablishment | null
  tvaBreakdown: ClosureZTvaLine[]
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

function formatDateOnly(yyyymmdd: string): string {
  // closureDate stocké en VARCHAR YYYY-MM-DD
  const d = new Date(yyyymmdd)
  if (Number.isNaN(d.getTime())) return yyyymmdd
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function buildClosureZHtml(data: ClosureZData): string {
  const { closure, register, establishment, tvaBreakdown } = data

  const tvaRows = tvaBreakdown.length > 0
    ? tvaBreakdown.map(t => `
        <tr>
          <td>${t.rate.toFixed(2)} %</td>
          <td class="right">${EUR(t.baseHT)}</td>
          <td class="right">${EUR(t.montantTVA)}</td>
          <td class="right bold">${EUR(t.baseHT + t.montantTVA)}</td>
        </tr>`).join('')
    : '<tr><td colspan="4" class="muted center">Aucune ligne TVA</td></tr>'

  const paymentRows = Object.entries(closure.paymentMethods || {})
    .filter(([, amount]) => amount !== 0)
    .map(([mode, amount]) => `<tr><td>${escape(mode)}</td><td class="right">${EUR(Number(amount))}</td></tr>`)
    .join('') || '<tr><td colspan="2" class="muted center">Aucun paiement</td></tr>'

  const legalLine = [
    establishment?.siret ? `SIRET : ${escape(establishment.siret)}` : '',
    establishment?.naf ? `NAF : ${escape(establishment.naf)}` : '',
    establishment?.tvaNumber ? `N° TVA : ${escape(establishment.tvaNumber)}` : '',
  ].filter(Boolean).join(' — ')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Ticket Z — ${escape(closure.closureDate)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  @media print { body { margin: 0; } }
  body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 12px; color: #111; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  h2 { margin: 18px 0 6px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .muted { color: #666; }
  .bold { font-weight: bold; }
  .right { text-align: right; }
  .center { text-align: center; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
  .header .left, .header .right { width: 48%; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; background: #f3f4f6; padding: 8px; font-size: 10px; text-transform: uppercase; color: #444; }
  th.right { text-align: right; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .totals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 8px; }
  .totals-grid .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
  .totals-grid .card .label { font-size: 10px; text-transform: uppercase; color: #666; }
  .totals-grid .card .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
  .totals-grid .ttc { background: #1f2937; color: white; }
  .totals-grid .ttc .label { color: #9ca3af; }
  .footer { margin-top: 28px; font-size: 10px; color: #555; border-top: 1px solid #ddd; padding-top: 12px; }
  .meta-table td { border: none; padding: 3px 8px 3px 0; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #dcfce7; color: #166534; }
</style>
</head>
<body>
  <div class="header">
    <div class="left">
      ${establishment ? `
        <h1>${escape(establishment.name)}</h1>
        ${formatAddress(establishment)}
        ${establishment.phone ? `<div>Tél : ${escape(establishment.phone)}</div>` : ''}
        ${establishment.email ? `<div>${escape(establishment.email)}</div>` : ''}
      ` : ''}
    </div>
    <div class="right">
      <h1 style="text-align:right">TICKET Z</h1>
      <div class="right"><span class="muted">Date :</span> <span class="bold">${escape(formatDateOnly(closure.closureDate))}</span></div>
      <div class="right"><span class="muted">N° clôture :</span> ${escape(closure.id)}</div>
      ${register ? `<div class="right"><span class="muted">Caisse :</span> ${escape(register.name)}</div>` : ''}
    </div>
  </div>

  <h2>Récapitulatif de la journée</h2>
  <table class="meta-table">
    <tr><td class="muted">Tickets validés</td><td class="bold">${closure.ticketCount}</td><td class="muted">Premier ticket</td><td class="bold">${escape(closure.firstTicketNumber || '—')}</td></tr>
    <tr><td class="muted">Tickets annulés</td><td>${closure.cancelledCount}</td><td class="muted">Dernier ticket</td><td class="bold">${escape(closure.lastTicketNumber || '—')}</td></tr>
    ${closure.closedBy ? `<tr><td class="muted">Clôturé par</td><td colspan="3">${escape(closure.closedBy)}</td></tr>` : ''}
    <tr><td class="muted">Horodatage clôture</td><td colspan="3">${escape(formatDate(closure.createdAt))}</td></tr>
  </table>

  <div class="totals-grid">
    <div class="card">
      <div class="label">Total HT</div>
      <div class="value">${EUR(closure.totalHT)}</div>
    </div>
    <div class="card">
      <div class="label">Total TVA</div>
      <div class="value">${EUR(closure.totalTVA)}</div>
    </div>
    <div class="card ttc">
      <div class="label">Total TTC</div>
      <div class="value">${EUR(closure.totalTTC)}</div>
    </div>
  </div>

  <h2>Détail TVA</h2>
  <table>
    <thead>
      <tr>
        <th>Taux</th>
        <th class="right">Base HT</th>
        <th class="right">Montant TVA</th>
        <th class="right">Total TTC</th>
      </tr>
    </thead>
    <tbody>${tvaRows}</tbody>
  </table>

  <h2>Modes de paiement</h2>
  <table>
    <thead><tr><th>Mode</th><th class="right">Montant</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>

  <div class="footer">
    <div><span class="badge">NF525</span></div>
    <div style="margin-top:8px">Hash de clôture : <span style="font-family:monospace">${escape(closure.closureHash)}</span></div>
    ${closure.lastTicketHash ? `<div>Hash dernier ticket : <span style="font-family:monospace">${escape(closure.lastTicketHash)}</span></div>` : ''}
    ${legalLine ? `<div style="margin-top:8px">${legalLine}</div>` : ''}
    <div class="muted" style="margin-top:8px">
      Document généré pour archivage NF525 — conservation 6 ans obligatoire.
    </div>
  </div>
</body>
</html>`
}
