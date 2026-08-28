import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROUTE,
  analyzeArmy,
  buildSpawnPlan,
  generateTowerBlueprints,
  pointOnRoute,
  routeLength,
  type ArmyBatch
} from './engine'

describe('route helpers', () => {
  it('measures and samples a multi-segment route', () => {
    expect(routeLength(DEFAULT_ROUTE)).toBeGreaterThan(1.3)
    const start = pointOnRoute(DEFAULT_ROUTE, 0)
    const end = pointOnRoute(DEFAULT_ROUTE, 1)
    expect(start).toEqual(DEFAULT_ROUTE[0])
    expect(end).toEqual(DEFAULT_ROUTE.at(-1))
  })
})

describe('army scheduling', () => {
  const queue: ArmyBatch[] = [
    { id: 1, kind: 'slime' },
    { id: 2, kind: 'swift' },
    { id: 3, kind: 'tank' }
  ]

  it('expands purchased batches into individual units', () => {
    const plan = buildSpawnPlan(queue, 'steady')
    expect(plan).toHaveLength(6)
    expect(plan.map((entry) => entry.kind)).toEqual([
      'slime',
      'slime',
      'slime',
      'swift',
      'swift',
      'tank'
    ])
  })

  it('gives split deployment more total separation than rush', () => {
    const rush = buildSpawnPlan(queue, 'rush')
    const split = buildSpawnPlan(queue, 'split')
    expect(split.at(-1)?.at).toBeGreaterThan(rush.at(-1)?.at ?? 0)
  })
})

describe('adaptive defense', () => {
  it('switches to frost-heavy interception against fast units', () => {
    const swiftArmy: ArmyBatch[] = [
      { id: 1, kind: 'swift' },
      { id: 2, kind: 'swift' },
      { id: 3, kind: 'swift' },
      { id: 4, kind: 'slime' }
    ]
    const analysis = analyzeArmy(swiftArmy)
    expect(analysis.mode).toBe('intercept')
    expect(analysis.mix.frost).toBeGreaterThan(analysis.mix.pulse)
  })

  it('switches to cannon-heavy defense against tanks', () => {
    const tankArmy: ArmyBatch[] = [
      { id: 1, kind: 'tank' },
      { id: 2, kind: 'tank' },
      { id: 3, kind: 'slime' }
    ]
    const analysis = analyzeArmy(tankArmy)
    expect(analysis.mode).toBe('pierce')
    expect(analysis.mix.cannon).toBeGreaterThan(0.5)
  })

  it('places more towers in later rounds without leaving the battlefield', () => {
    const analysis = analyzeArmy([])
    const early = generateTowerBlueprints(DEFAULT_ROUTE, 1, analysis, 42)
    const late = generateTowerBlueprints(DEFAULT_ROUTE, 5, analysis, 42)
    expect(early).toHaveLength(3)
    expect(late).toHaveLength(5)
    for (const tower of late) {
      expect(tower.position.x).toBeGreaterThanOrEqual(0.08)
      expect(tower.position.x).toBeLessThanOrEqual(0.92)
      expect(tower.position.y).toBeGreaterThanOrEqual(0.12)
      expect(tower.position.y).toBeLessThanOrEqual(0.88)
    }
  })
})
