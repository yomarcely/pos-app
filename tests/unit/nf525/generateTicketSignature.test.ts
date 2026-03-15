import { describe, it, expect } from 'vitest'
import { generateTicketSignature } from '~/server/utils/nf525'

describe('generateTicketSignature', () => {
  const sampleHash = 'abc123def456789012345678901234567890123456789012345678901234abcd'

  // T1 — Sans privateKey
  it('T1 — sans privateKey, retourne une signature temporaire commençant par TEMP_SIGNATURE_', () => {
    const sig = generateTicketSignature(sampleHash, undefined)
    expect(sig.startsWith('TEMP_SIGNATURE_')).toBe(true)
  })

  it('T1 — la signature temporaire contient les 16 premiers caractères du hash', () => {
    const sig = generateTicketSignature(sampleHash, undefined)
    const expectedSuffix = sampleHash.substring(0, 16)
    expect(sig).toBe(`TEMP_SIGNATURE_${expectedSuffix}`)
  })

  // T2 — Avec privateKey
  it('T2 — avec privateKey, retourne une string hex de 64 caractères', () => {
    const sig = generateTicketSignature(sampleHash, 'my-private-key')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('T2 — avec privateKey, ne commence pas par TEMP_SIGNATURE_', () => {
    const sig = generateTicketSignature(sampleHash, 'my-private-key')
    expect(sig.startsWith('TEMP_SIGNATURE_')).toBe(false)
  })

  // T3 — Déterminisme
  it('T3 — deux appels identiques (sans privateKey) produisent la même signature', () => {
    const sig1 = generateTicketSignature(sampleHash)
    const sig2 = generateTicketSignature(sampleHash)
    expect(sig1).toBe(sig2)
  })

  it('T3 — deux appels identiques (avec privateKey) produisent la même signature', () => {
    const sig1 = generateTicketSignature(sampleHash, 'my-key')
    const sig2 = generateTicketSignature(sampleHash, 'my-key')
    expect(sig1).toBe(sig2)
  })
})
