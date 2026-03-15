import { describe, it, expect } from 'vitest'
import { generateArchiveHash } from '~/server/utils/nf525'

describe('generateArchiveHash', () => {
  // T1 — Format de sortie
  it('T1 — retourne une string hex de 64 caractères', () => {
    const hash = generateArchiveHash('some archive content')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  // T2 — Déterminisme
  it('T2 — deux appels avec le même contenu retournent le même hash', () => {
    const content = 'archive data 2025-01-20'
    const hash1 = generateArchiveHash(content)
    const hash2 = generateArchiveHash(content)
    expect(hash1).toBe(hash2)
  })

  // T3 — Unicité
  it('T3 — deux contenus différents produisent des hashes différents', () => {
    const hashA = generateArchiveHash('content A')
    const hashB = generateArchiveHash('content B')
    expect(hashA).not.toBe(hashB)
  })
})
