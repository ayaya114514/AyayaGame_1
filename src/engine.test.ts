import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROUTE,
  TOWER_DEFS,
  analyzeArmy,
  boardExposureLimit,
  buildSpawnPlan,
  coreDamageFor,
  evaluateRoutePlan,
  exposureLimitForRound,
  generateTowerBlueprints,
  generateTacticalNodes,
  linkedNodeIds,
  modifiersFor,
  pointOnRoute,
  routeExposure,
  routeLength,
  routeSignature,
  routeSimilarity,
  routeTouchesNode,
  selectAdaptiveMutation,
  towerBurstAfterShot,
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

  it('detects whether a route actually crosses a tactical node', () => {
    const onRoute = { id: 1, kind: 'haste' as const, position: { x: 0.5, y: 0.69 }, radius: 0.06 }
    const offRoute = { id: 2, kind: 'jammer' as const, position: { x: 0.5, y: 0.08 }, radius: 0.06 }
    expect(routeTouchesNode(DEFAULT_ROUTE, onRoute)).toBe(true)
    expect(routeTouchesNode(DEFAULT_ROUTE, offRoute)).toBe(false)
    expect(linkedNodeIds(DEFAULT_ROUTE, [onRoute, offRoute])).toEqual([1])
  })

  it('treats a copied route as repeated and a changed route as novel', () => {
    const copy = DEFAULT_ROUTE.map((point) => ({ ...point }))
    const changed = DEFAULT_ROUTE.map((point, index) => ({
      ...point,
      y: index > 0 && index < DEFAULT_ROUTE.length - 1 ? 1 - point.y : point.y
    }))
    expect(routeSimilarity(DEFAULT_ROUTE, copy)).toBe(1)
    expect(routeSimilarity(changed, copy)).toBeLessThan(0.5)
    expect(routeSimilarity(DEFAULT_ROUTE, null)).toBe(0)
  })

  it('requires two relays to remove the complete core shield', () => {
    expect(coreDamageFor(3, 0)).toBe(0)
    expect(coreDamageFor(3, 1)).toBe(1.5)
    expect(coreDamageFor(3, 2)).toBe(3)
  })

  it('accepts a short route that crosses any two of three relays', () => {
    const nodes = generateTacticalNodes(1)
    const valid = DEFAULT_ROUTE.map((point) => ({ ...point }))
    if (nodes[0]) valid[1] = { ...nodes[0].position }
    if (nodes[2]) valid[3] = { ...nodes[2].position }
    if (nodes[0] && nodes[2]) {
      valid[2] = {
        x: (nodes[0].position.x + nodes[2].position.x) / 2,
        y: (nodes[0].position.y + nodes[2].position.y) / 2
      }
    }

    expect(evaluateRoutePlan(DEFAULT_ROUTE, nodes, 1.28, 2).ready).toBe(false)
    const status = evaluateRoutePlan(valid, nodes, 1.28, 2)
    expect(status.linked).toBeGreaterThanOrEqual(2)
    expect(status.required).toBe(2)
    expect(status.available).toBe(3)
    expect(status.length).toBeLessThanOrEqual(1.28)
    expect(status.ready).toBe(true)
  })

  it('keeps two relay choices solvable in every campaign round', () => {
    for (let round = 1; round <= 4; round += 1) {
      const nodes = generateTacticalNodes(round)
      const first = nodes[0]
      const second = nodes[2]
      expect(first).toBeDefined()
      expect(second).toBeDefined()
      if (!first || !second) continue
      const route = [
        { ...DEFAULT_ROUTE[0]! },
        { ...first.position },
        {
          x: (first.position.x + second.position.x) / 2,
          y: (first.position.y + second.position.y) / 2
        },
        { ...second.position },
        { ...DEFAULT_ROUTE.at(-1)! }
      ]
      expect(evaluateRoutePlan(route, nodes, 1.28, 2).ready).toBe(true)
    }
  })

  it('measures how much of a route sits inside tower range', () => {
    const route = [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 }
    ]
    const towers = [{ position: { x: 0.5, y: 0.5 }, range: 0.1 }]
    expect(routeExposure(route, [])).toBe(0)
    expect(routeExposure(route, towers, 100)).toBeGreaterThan(0.18)
    expect(routeExposure(route, towers, 100)).toBeLessThan(0.23)
  })

  it('keeps a low-exposure two-relay route available in every round', () => {
    const defenseSeed = routeSignature(DEFAULT_ROUTE)
      .split('-')
      .reduce((sum, value) => sum * 17 + Number(value), 19)
    for (let round = 1; round <= 4; round += 1) {
      const nodes = generateTacticalNodes(round)
      const towers = generateTowerBlueprints(DEFAULT_ROUTE, round, analyzeArmy([]), defenseSeed)
      const routes = [0, 1, 2].flatMap((freeIndex) =>
        Array.from({ length: 17 }, (_, step) => {
          const waypoints = nodes.map((node) => ({ ...node.position }))
          waypoints[freeIndex] = {
            x: [0.25, 0.5, 0.75][freeIndex] ?? 0.5,
            y: 0.1 + step * 0.05
          }
          return [{ ...DEFAULT_ROUTE[0]! }, ...waypoints, { ...DEFAULT_ROUTE.at(-1)! }]
        })
      )
      expect(
        routes.some(
          (route) =>
            evaluateRoutePlan(route, nodes, 1.28, 2).ready &&
            routeExposure(route, towers) <= exposureLimitForRound(round)
        )
      ).toBe(true)
    }
  })

  it('stays solvable against representative learned defenses', () => {
    const defenseRoutes = [
      [0.5, 0.5, 0.5],
      [0.28, 0.34, 0.4],
      [0.72, 0.66, 0.6],
      [0.35, 0.55, 0.42]
    ].map((ys) => [
      { ...DEFAULT_ROUTE[0]! },
      ...ys.map((y, index) => ({ x: [0.25, 0.5, 0.75][index] ?? 0.5, y })),
      { ...DEFAULT_ROUTE.at(-1)! }
    ])
    const defenses = [
      analyzeArmy([]),
      analyzeArmy(Array.from({ length: 4 }, (_, id) => ({ id, kind: 'swift' as const }))),
      analyzeArmy(Array.from({ length: 3 }, (_, id) => ({ id, kind: 'tank' as const }))),
      analyzeArmy(Array.from({ length: 4 }, (_, id) => ({ id, kind: 'slime' as const })))
    ]

    for (let round = 1; round <= 4; round += 1) {
      const nodes = generateTacticalNodes(round)
      const routes = [0, 1, 2].flatMap((freeIndex) =>
        Array.from({ length: 17 }, (_, step) => {
          const waypoints = nodes.map((node) => ({ ...node.position }))
          waypoints[freeIndex] = {
            x: [0.25, 0.5, 0.75][freeIndex] ?? 0.5,
            y: 0.1 + step * 0.05
          }
          return [{ ...DEFAULT_ROUTE[0]! }, ...waypoints, { ...DEFAULT_ROUTE.at(-1)! }]
        })
      )

      for (const [routeIndex, defenseRoute] of defenseRoutes.entries()) {
        const seed = routeSignature(defenseRoute)
          .split('-')
          .reduce((sum, value) => sum * 17 + Number(value), 19)
        for (const [defenseIndex, defense] of defenses.entries()) {
          const towers = generateTowerBlueprints(defenseRoute, round, defense, seed)
          const legalExposures = routes
            .filter((route) => evaluateRoutePlan(route, nodes, 1.28, 2).ready)
            .map((route) => routeExposure(route, towers))
          const minimumExposure = Math.min(...legalExposures)
          const limit = boardExposureLimit(round, nodes, towers, 1.28, 2)
          expect(
            minimumExposure,
            `round ${round}, route ${routeIndex}, defense ${defenseIndex}`
          ).toBeLessThanOrEqual(limit)
          expect(
            limit,
            `cap round ${round}, route ${routeIndex}, defense ${defenseIndex}`
          ).toBeLessThanOrEqual(0.74)
        }
      }
    }
  })

  it('tightens the fire budget each round without dropping below 52%', () => {
    expect([1, 2, 3, 4].map(exposureLimitForRound)).toEqual([0.58, 0.56, 0.54, 0.52])
    expect(exposureLimitForRound(99)).toBe(0.52)
  })
})

describe('army scheduling', () => {
  const queue: ArmyBatch[] = [
    { id: 1, kind: 'slime' },
    { id: 2, kind: 'swift' },
    { id: 3, kind: 'tank' }
  ]

  it('expands purchased batches into individual units', () => {
    const plan = buildSpawnPlan(queue)
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

  it('preserves batch order in the fixed readable cadence', () => {
    const plan = buildSpawnPlan(queue)
    expect(plan.map((entry) => entry.batchId)).toEqual([1, 1, 1, 2, 2, 3])
    expect(plan.at(-1)?.at).toBeGreaterThan(plan[0]?.at ?? 0)
  })

  it('adds one unit to every slime batch after the fission mutation', () => {
    const baseline = buildSpawnPlan(queue)
    const evolved = buildSpawnPlan(queue, ['slime_bloom'])
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
    const analysis = analyzeArmy(swarm)
    expect(analysis.mode).toBe('suppress')
    expect(analysis.counter).toContain('疾行兽')
  })

  it('locks down a repeated route with an extra tower', () => {
    const analysis = analyzeArmy([], {
      swiftRatio: 0,
      tankRatio: 0,
      repeatedRoute: true,
      breaches: 0
    })
    expect(analysis.mode).toBe('lockdown')
    expect(generateTowerBlueprints(DEFAULT_ROUTE, 1, analysis, 42)).toHaveLength(7)
    expect(analysis.counter).toContain('路标')
  })

  it('responds to a successful slime swarm instead of reading the new queue', () => {
    const analysis = analyzeArmy([{ id: 1, kind: 'tank' }], {
      swiftRatio: 0,
      tankRatio: 0,
      repeatedRoute: false,
      breaches: 4
    })
    expect(analysis.mode).toBe('suppress')
    expect(analysis.counter).toContain('疾行兽')
  })

  it('places more towers in later rounds without leaving the battlefield', () => {
    const analysis = analyzeArmy([])
    const early = generateTowerBlueprints(DEFAULT_ROUTE, 1, analysis, 42)
    const late = generateTowerBlueprints(DEFAULT_ROUTE, 5, analysis, 42)
    expect(early).toHaveLength(6)
    expect(late).toHaveLength(8)
    for (const tower of late) {
      expect(tower.position.x).toBeGreaterThanOrEqual(0.08)
      expect(tower.position.x).toBeLessThanOrEqual(0.92)
      expect(tower.position.y).toBeGreaterThanOrEqual(0.12)
      expect(tower.position.y).toBeLessThanOrEqual(0.88)
    }
  })
})

describe('evolution system', () => {
  it('applies persistent unit, economy and relay modifiers', () => {
    const mutations = ['tank_plating', 'brood_discount', 'jammer_echo'] as const
    const modifiers = modifiersFor([...mutations])
    expect(unitDefinition('tank', [...mutations]).hp).toBeGreaterThan(158)
    expect(unitDefinition('tank', [...mutations]).armor).toBeCloseTo(0.38)
    expect(unitCost('swift', [...mutations])).toBe(36)
    expect(modifiers.jammerDuration).toBe(3)
  })

  it('repairs the weakness exposed by a failed wave', () => {
    const adaptation = selectAdaptiveMutation(
      [{ id: 1, kind: 'swift' }],
      'intercept',
      { breaches: 0, nodes: 2 },
      []
    )
    expect(adaptation?.mutation.id).toBe('tank_plating')
    expect(adaptation?.reason).toContain('本轮防线')
  })

  it('amplifies a strong breakthrough without repeating owned mutations', () => {
    const adaptation = selectAdaptiveMutation(
      [{ id: 1, kind: 'tank' }],
      'pierce',
      { breaches: 4, nodes: 2 },
      ['signal_leech']
    )
    expect(adaptation?.mutation.id).not.toBe('signal_leech')
    expect(adaptation?.mutation.id).toBe('tank_plating')
  })

  it('stops adapting after every mutation has been acquired', () => {
    const adaptation = selectAdaptiveMutation(
      [{ id: 1, kind: 'slime' }],
      'balanced',
      { breaches: 0, nodes: 0 },
      [
        'slime_bloom',
        'swift_phase',
        'tank_plating',
        'brood_discount',
        'neural_drive',
        'signal_leech',
        'jammer_echo'
      ]
    )
    expect(adaptation).toBeNull()
  })
})

describe('tower rhythm', () => {
  it('uses a short fire cadence before entering a visible overheat window', () => {
    const definition = TOWER_DEFS.pulse
    let state = { burstLeft: definition.burst, cooldown: 0 }
    for (let shot = 0; shot < definition.burst; shot += 1) {
      state = towerBurstAfterShot('pulse', state.burstLeft)
      expect(state.cooldown).toBe(
        shot === definition.burst - 1 ? definition.overheat : definition.fireRate
      )
    }
    expect(state.burstLeft).toBe(0)
  })
})

describe('tactical nodes', () => {
  it('generates three reachable and distinct battlefield signals each round', () => {
    const nodes = generateTacticalNodes(2, 99)
    expect(nodes).toHaveLength(3)
    expect(new Set(nodes.map((node) => node.kind)).size).toBe(3)
    for (const node of nodes) {
      expect(node.position.x).toBeGreaterThan(0.15)
      expect(node.position.x).toBeLessThan(0.85)
      expect(node.position.y).toBeGreaterThanOrEqual(0.2)
      expect(node.position.y).toBeLessThanOrEqual(0.8)
    }
  })
})
