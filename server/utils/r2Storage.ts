import { createHash, createHmac } from 'crypto'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * Stockage objet Cloudflare R2 (S3-compatible)
 * ==========================================
 *
 * Signature SigV4 « maison » (PutObject uniquement) pour éviter d'embarquer le SDK AWS
 * (~plusieurs Mo) pour un seul appel. R2 est strictement S3-compatible côté signature.
 *
 * Réutilise les mêmes credentials que le workflow de backup
 * (cf .github/workflows/backup.yml + scripts/backup-database.sh) :
 *   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_ENDPOINT
 *
 * ⚠️ Réservé au runtime serveur (jamais importé côté client) : manipule des secrets.
 */

const REGION = 'auto' // R2 ignore la région mais SigV4 en exige une.
const SERVICE = 's3'

interface R2Config {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint: string
}

/**
 * Retourne la config R2 si les 4 variables sont présentes, sinon `null`.
 * `null` = R2 indisponible → l'appelant bascule en `pending_export`.
 */
export function getR2Config(): R2Config | null {
  const r2 = useRuntimeConfig().r2 as Partial<R2Config> | undefined
  if (!r2?.accessKeyId || !r2.secretAccessKey || !r2.bucket || !r2.endpoint) {
    return null
  }
  return {
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
    bucket: r2.bucket,
    endpoint: r2.endpoint.replace(/\/+$/, ''),
  }
}

export function isR2Configured(): boolean {
  return getR2Config() !== null
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

/**
 * Encodage URI conforme S3 pour un chemin d'objet : chaque segment encodé,
 * les `/` préservés, et les caractères non réservés laissés intacts.
 */
function encodeKey(key: string): string {
  return key
    .split('/')
    .map((seg) =>
      encodeURIComponent(seg).replace(
        /[!'()*]/g,
        (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
      ),
    )
    .join('/')
}

export interface UploadArchiveParams {
  /** Clé de l'objet, ex: `archives/{tenantId}/archive-2024-01.json` */
  key: string
  /** Contenu de l'archive (UTF-8). */
  body: string
  /** SHA-256 hex du contenu (= payload hash, réutilisé pour `x-amz-content-sha256`). */
  contentHash: string
  /** Métadonnées objet → headers `x-amz-meta-*` (clés en minuscules). */
  metadata?: Record<string, string>
  contentType?: string
}

/**
 * Upload (PutObject) une archive dans R2 avec son hash SHA-256 en métadonnée d'objet.
 * Lève en cas d'absence de config ou de réponse non-2xx.
 */
export async function uploadArchiveToR2(params: UploadArchiveParams): Promise<{ url: string }> {
  const config = getR2Config()
  if (!config) {
    throw new Error('R2 non configuré (credentials absents)')
  }

  const { key, body, contentHash, contentType = 'application/json' } = params
  const bodyBuffer = Buffer.from(body, 'utf8')

  const url = new URL(`${config.endpoint}/${config.bucket}/${encodeKey(key)}`)
  const host = url.host
  const canonicalUri = url.pathname

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '') // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8)

  // Headers signés (triés, minuscules). Les métadonnées deviennent des x-amz-meta-*.
  const headers: Record<string, string> = {
    'content-type': contentType,
    host,
    'x-amz-content-sha256': contentHash,
    'x-amz-date': amzDate,
  }
  for (const [k, v] of Object.entries(params.metadata ?? {})) {
    headers[`x-amz-meta-${k.toLowerCase()}`] = v
  }

  const sortedHeaderKeys = Object.keys(headers).sort()
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${(headers[k] ?? '').trim()}\n`).join('')
  const signedHeaders = sortedHeaderKeys.join(';')

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '', // pas de query string
    canonicalHeaders,
    signedHeaders,
    contentHash,
  ].join('\n')

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, SERVICE)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: { ...headers, Authorization: authorization },
    body: bodyBuffer,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    logger.error({ status: response.status, key, body: text.slice(0, 500) }, 'Upload R2 échoué')
    throw new Error(`Upload R2 échoué (HTTP ${response.status})`)
  }

  return { url: url.toString() }
}
