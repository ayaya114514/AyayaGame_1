import { describe, expect, it } from 'vitest'
import type { Level } from './engine'
import { LEVELS } from './levels'
import { decodeLevel, encodeLevel, SHARE_PREFIX } from './share'

describe('share links', () => {
  it.each(LEVELS)('$id survives a round trip through the URL hash', (level) => {
    const hash = encodeLevel(level)
    expect(hash.startsWith(SHARE_PREFIX)).toBe(true)
    expect(hash).toMatch(/^#level=[A-Za-z0-9_-]+$/)
    const decoded = decodeLevel(hash)
    expect('level' in decoded).toBe(true)
    const shared = (decoded as { level: Level }).level
    expect(shared.map).toEqual(level.map)
    expect(shared.title).toBe(level.title)
    expect(
      shared.turrets.map(({ position, direction, pattern, relay, arm, plate }) => ({
        position,
        direction,
        pattern,
        relay,
        arm,
        plate
      }))
    ).toEqual(
      level.turrets.map(({ position, direction, pattern, relay, arm, plate }) => ({
        position,
        direction,
        pattern,
        relay,
        arm,
        plate
      }))
    )
  })
  it('rejects malformed, oversized or invalid puzzles without throwing', () => {
    const encode = (data: unknown) =>
      SHARE_PREFIX + Buffer.from(JSON.stringify(data)).toString('base64url')
    for (const hash of [
      '#level=%%%',
      '#level=',
      '#other=abc',
      encode(null),
      encode({ m: ['S.E'], g: [] }),
      encode({ m: Array(11).fill('.'.repeat(11)), g: [] }),
      encode({ m: ['###', '#S#', '###'], g: [] }),
      encode({ m: ['S.E', '...', '...'], g: ['9,9,u,1'] }),
      encode({ m: ['S.E', '...', '...'], g: ['1,1,up,1'] }),
      encode({ m: ['S.E', '...', '...'], g: ['1,1,u,1,a'] })
    ])
      expect(decodeLevel(hash)).toHaveProperty('error')
    expect(decodeLevel(encode({ m: ['S.E', '...', '...'], g: ['1,2,u,10'] }))).toHaveProperty(
      'level'
    )
  })
})
