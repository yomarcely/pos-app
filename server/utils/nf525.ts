import { createHash } from 'crypto'

/**
 * ==========================================
 * UTILITAIRES NF525 - CERTIFICATION ANTI-FRAUDE
 * ==========================================
 *
 * Conformité NF525 pour INFOCERT :
 * - Chaînage cryptographique des tickets (hash SHA-256)
 * - Horodatage certifié
 * - Inaltérabilité des données
 * - Archivage sécurisé
 */

export interface TicketData {
  ticketNumber: string
  saleDate: Date
  totalTTC: number
  sellerId: number
  establishmentNumber: number
  registerNumber: number
  items: Array<{
    productId: number
    quantity: number
    unitPrice: number
    totalTTC: number
  }>
}

/**
 * Génère le hash SHA-256 d'un ticket
 * Ce hash sert au chaînage cryptographique
 *
 * @param ticketData - Données du ticket
 * @param previousHash - Hash du ticket précédent (pour chaînage)
 * @returns Hash SHA-256 du ticket
 */
export function generateTicketHash(
  ticketData: TicketData,
  previousHash: string | null = null
): string {
  // Construire la chaîne à hasher
  const dataToHash = [
    ticketData.ticketNumber,
    ticketData.saleDate.toISOString(),
    ticketData.totalTTC.toFixed(2),
    ticketData.sellerId,
    ticketData.establishmentNumber,
    ticketData.registerNumber,
    previousHash || 'FIRST_TICKET',
    // Ajouter les items pour plus de sécurité
    ticketData.items
      .map(item => `${item.productId}:${item.quantity}:${item.unitPrice}:${item.totalTTC}`)
      .join('|')
  ].join('::')

  // Générer le hash SHA-256
  return createHash('sha256').update(dataToHash).digest('hex')
}

/**
 * Génère un numéro de ticket unique et séquentiel
 * Format: YYYYMMDD-E{etab}-R{caisse}-NNNNNN (ex: 20250120-E01-R02-000001)
 *
 * @param sequenceNumber - Numéro de séquence du jour
 * @param establishmentNumber - Numéro logique de l'établissement (1, 2, ...)
 * @param registerNumber - Numéro logique de la caisse (1, 2, ...)
 * @returns Numéro de ticket formaté
 */
export function generateTicketNumber(sequenceNumber: number, establishmentNumber: number, registerNumber: number): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  // Numéro de séquence sur 6 chiffres
  const sequence = String(sequenceNumber).padStart(6, '0')

  const etab = String(establishmentNumber).padStart(2, '0')
  const register = String(registerNumber).padStart(2, '0')

  return `${year}${month}${day}-E${etab}-R${register}-${sequence}`
}

/**
 * Vérifie l'intégrité d'un ticket via son hash
 *
 * @param ticketData - Données du ticket
 * @param previousHash - Hash du ticket précédent
 * @param expectedHash - Hash attendu du ticket
 * @returns true si le ticket est valide
 */
export function verifyTicketIntegrity(
  ticketData: TicketData,
  previousHash: string | null,
  expectedHash: string
): boolean {
  const calculatedHash = generateTicketHash(ticketData, previousHash)
  return calculatedHash === expectedHash
}

/**
 * Génère une signature pour certification INFOCERT
 * (À adapter selon les specs INFOCERT)
 *
 * @param ticketHash - Hash du ticket
 * @param privateKey - Clé privée du commerce (fournie par INFOCERT)
 * @returns Signature du ticket
 */
export function generateTicketSignature(
  ticketHash: string,
  privateKey?: string
): string {
  // TODO: Implémenter la signature INFOCERT
  // En attendant la clé INFOCERT, on génère une signature temporaire
  if (!privateKey) {
    return `TEMP_SIGNATURE_${ticketHash.substring(0, 16)}`
  }

  // Signature réelle avec la clé INFOCERT
  // À implémenter selon les specs INFOCERT (probablement RSA ou ECDSA)
  return createHash('sha256')
    .update(`${ticketHash}::${privateKey}`)
    .digest('hex')
}

/**
 * Génère les données d'archive pour un ticket (format NF525)
 *
 * @param sale - Vente complète avec hash et signature
 * @returns Données formatées pour archivage
 */
export interface ArchivedTicket {
  ticketNumber: string
  saleDate: string
  totalTTC: number
  hash: string
  signature: string
  previousHash: string | null
}

export function prepareTicketForArchive(
  ticketNumber: string,
  saleDate: Date,
  totalTTC: number,
  currentHash: string,
  signature: string,
  previousHash: string | null
): ArchivedTicket {
  return {
    ticketNumber,
    saleDate: saleDate.toISOString(),
    totalTTC,
    hash: currentHash,
    signature,
    previousHash,
  }
}

/**
 * Génère le hash d'un fichier d'archive (pour intégrité)
 *
 * @param fileContent - Contenu du fichier d'archive
 * @returns Hash SHA-256 du fichier
 */
export function generateArchiveHash(fileContent: string): string {
  return createHash('sha256').update(fileContent).digest('hex')
}

/**
 * Vérifie la chaîne complète de tickets
 * Utilisé pour l'audit NF525
 *
 * @param tickets - Liste des tickets à vérifier
 * @returns Résultat de la vérification
 */
export interface ChainVerificationResult {
  isValid: boolean
  brokenLinks: Array<{
    ticketNumber: string
    reason: string
  }>
}

export function verifyTicketChain(
  tickets: Array<{
    ticketNumber: string
    saleDate: Date
    totalTTC: number
    sellerId: number
    establishmentNumber: number
    registerNumber: number
    items: any[]
    currentHash: string
    previousHash: string | null
  }>
): ChainVerificationResult {
  const brokenLinks: Array<{ ticketNumber: string; reason: string }> = []

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i]
    const previousTicket = i > 0 ? tickets[i - 1] : null

    // Vérifier que le previousHash correspond au hash du ticket précédent
    if (previousTicket && ticket.previousHash !== previousTicket.currentHash) {
      brokenLinks.push({
        ticketNumber: ticket.ticketNumber,
        reason: `Hash précédent incorrect (attendu: ${previousTicket.currentHash}, trouvé: ${ticket.previousHash})`,
      })
    }

    // Vérifier l'intégrité du hash actuel
    const calculatedHash = generateTicketHash(
      {
        ticketNumber: ticket.ticketNumber,
        saleDate: ticket.saleDate,
        totalTTC: ticket.totalTTC,
        sellerId: ticket.sellerId,
        establishmentNumber: ticket.establishmentNumber,
        registerNumber: ticket.registerNumber,
        items: ticket.items,
      },
      ticket.previousHash
    )

    if (calculatedHash !== ticket.currentHash) {
      brokenLinks.push({
        ticketNumber: ticket.ticketNumber,
        reason: `Hash du ticket incorrect (attendu: ${calculatedHash}, trouvé: ${ticket.currentHash})`,
      })
    }
  }

  return {
    isValid: brokenLinks.length === 0,
    brokenLinks,
  }
}
