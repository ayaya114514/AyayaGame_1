import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROUTE,
  analyzeArmy,
  buildSpawnPlan,
  generateTowerBlueprints,
  generateTacticalNodes,
  modifiersFor,
  mutationOffers,
  pointOnRoute,
  routeLength,
  unitCost,
  unitDefinition,
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

  it('adds one unit to every slime batch after the fission mutation', () => {
    const baseline = buildSpawnPlan(queue, 'steady')
    const evolved = buildSpawnPlan(queue, 'steady', ['slime_bloom'])
    expect(evolved).toHaveLength(baseline.length + 1)
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

  it('counters a dense slime rush with splash damage', () => {
    const swarm: ArmyBatch[] = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      kind: 'slime' as const
    }))
    const analysis = analyzeArmy(swarm, undefined, 'rush')
    expect(analysis.mode).toBe('suppress')
    expect(analysis.counter).toContain('分批')
  })

  it('locks down a repeated route with an extra tower', () => {
    const analysis = analyzeArmy([], {
      swiftRatio: 0,
      tankRatio: 0,
      repeatedRoute: true,
      breaches: 0
    })
    expect(analysis.mode).toBe('lockdown')
    expect(generateTowerBlueprints(DEFAULT_ROUTE, 1, analysis, 42)).toHaveLength(4)
    expect(analysis.counter).toContain('路标')
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

describe('evolution system', () => {
  it('applies persistent unit, economy and command modifiers', () => {
    const mutations = ['tank_plating', 'brood_discount', 'emp_overload'] as const
    const modifiers = modifiersFor([...mutations])
    expect(unitDefinition('tank', [...mutations]).hp).toBeGreaterThan(158)
    expect(unitDefinition('tank', [...mutations]).armor).toBeCloseTo(0.38)
    expect(unitCost('swift', [...mutations])).toBe(36)
    expect(modifiers.empDuration).toBe(3)
  })

  it('offers three unique mutations that have not been acquired', () => {
    const offers = mutationOffers(3, ['slime_bloom', 'swift_phase'])
    expect(offers).toHaveLength(3)
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(3)
    expect(offers.map((offer) => offer.id)).not.toContain('slime_bloom')
  })
})

describe('tactical nodes', () => {
  it('generates two reachable and distinct battlefield signals each round', () => {
    const nodes = generateTacticalNodes(2, 99)
    expect(nodes).toHaveLength(2)
    expect(nodes[0]?.kind).not.toBe(nodes[1]?.kind)
    for (const node of nodes) {
      expect(node.position.x).toBeGreaterThan(0.15)
      expect(node.position.x).toBeLessThan(0.85)
      expect(node.position.y).toBeGreaterThanOrEqual(0.2)
      expect(node.position.y).toBeLessThanOrEqual(0.8)
    }
  })
})
