export type UnitKind = 'slime' | 'swift' | 'tank'
export type TowerKind = 'pulse' | 'frost' | 'cannon'
export type MutationId =
  | 'slime_bloom'
  | 'swift_phase'
  | 'tank_plating'
  | 'brood_discount'
  | 'neural_drive'
  | 'signal_leech'
  | 'jammer_echo'
export type TacticalNodeKind = 'vitality' | 'haste' | 'jammer'

export type Point = {
  x: number
  y: number
}

export type ArmyBatch = {
  id: number
  kind: UnitKind
}

export type UnitDefinition = {
  name: string
  role: string
  cost: number
  count: number
  hp: number
  speed: number
  radius: number
  breach: number
  armor: number
  color: string
}

export type TowerDefinition = {
  name: string
  damage: number
  range: number
  fireRate: number
  color: string
}

export type AIHistory = {
  swiftRatio: number
  tankRatio: number
  repeatedRoute: boolean
  breaches: number
}

export type AIAnalysis = {
  mode: 'balanced' | 'intercept' | 'pierce' | 'suppress' | 'lockdown'
  name: string
  detail: string
  counter: string
  mix: Record<TowerKind, number>
  accent: string
}

export type MutationDefinition = {
  id: MutationId
  name: string
  code: string
  detail: string
  accent: string
}

export type CombatModifiers = {
  slimeBonus: number
  swiftShield: number
  tankHpMultiplier: number
  tankArmorBonus: number
  costDiscount: number
  speedMultiplier: number
  nodeMultiplier: number
  breachCredit: number
  jammerDuration: number
}

export type TacticalNodeBlueprint = {
  id: number
  kind: TacticalNodeKind
  position: Point
  radius: number
}

export type RoutePlanStatus = {
  linked: number
  required: number
  available: number
  length: number
  remaining: number
  ready: boolean
}

export type TowerBlueprint = {
  id: number
  kind: TowerKind
  position: Point
  range: number
  level: number
}

export type SpawnEntry = {
  at: number
  kind: UnitKind
  batchId: number
}

export const MUTATION_DEFS: Record<MutationId, MutationDefinition> = {
  slime_bloom: {
    id: 'slime_bloom',
    name: '分裂孢子',
    code: 'SLIME +1',
    detail: '每个史莱姆批次额外孵化 1 个单位。',
    accent: '#8fffc2'
  },
  swift_phase: {
    id: 'swift_phase',
    name: '相位薄膜',
    code: 'EVADE 01',
    detail: '每只疾行兽免疫受到的第一次攻击。',
    accent: '#ffe08a'
  },
  tank_plating: {
    id: 'tank_plating',
    name: '活体装甲',
    code: 'ARMOR +',
    detail: '铁甲兽生命提高 22%，护甲提高 10%。',
    accent: '#a8b7ff'
  },
  brood_discount: {
    id: 'brood_discount',
    name: '高效孵化',
    code: 'COST −06',
    detail: '所有怪物批次的购买价格降低 6 资源。',
    accent: '#76f4cf'
  },
  neural_drive: {
    id: 'neural_drive',
    name: '神经增幅',
    code: 'SPEED +09%',
    detail: '全军速度提高 9%，战场信标效果增强 25%。',
    accent: '#6fdcff'
  },
  signal_leech: {
    id: 'signal_leech',
    name: '数据寄生',
    code: 'LEECH +02',
    detail: '每次突破核心都会掠夺 2 资源。',
    accent: '#ff9fcb'
  },
  jammer_echo: {
    id: 'jammer_echo',
    name: '干扰回声',
    code: 'JAM +1.2S',
    detail: '停火中继的效果延长 1.2 秒。',
    accent: '#8ae9ff'
  }
}

export const TACTICAL_NODE_DEFS: Record<
  TacticalNodeKind,
  { name: string; code: string; detail: string; color: string }
> = {
  vitality: {
    name: '再生信标',
    code: 'HEAL',
    detail: '首个抵达单位触发全军修复。',
    color: '#75ffc1'
  },
  haste: {
    name: '跃迁信标',
    code: 'HASTE',
    detail: '首个抵达单位触发短时全军加速。',
    color: '#ffe378'
  },
  jammer: {
    name: '干扰信标',
    code: 'JAM',
    detail: '首个抵达单位使所有防御塔离线。',
    color: '#7bdfff'
  }
}

export const UNIT_DEFS: Record<UnitKind, UnitDefinition> = {
  slime: {
    name: '史莱姆群',
    role: '数量压制',
    cost: 30,
    count: 3,
    hp: 46,
    speed: 0.084,
    radius: 0.012,
    breach: 1,
    armor: 0,
    color: '#8fffc2'
  },
  swift: {
    name: '疾行兽',
    role: '高速突进',
    cost: 42,
    count: 2,
    hp: 34,
    speed: 0.142,
    radius: 0.01,
    breach: 1,
    armor: 0,
    color: '#ffe08a'
  },
  tank: {
    name: '铁甲兽',
    role: '吸收火力',
    cost: 60,
    count: 1,
    hp: 158,
    speed: 0.058,
    radius: 0.017,
    breach: 3,
    armor: 0.28,
    color: '#a8b7ff'
  }
}

export const TOWER_DEFS: Record<TowerKind, TowerDefinition> = {
  pulse: {
    name: '脉冲塔',
    damage: 7,
    range: 0.14,
    fireRate: 0.52,
    color: '#ff7188'
  },
  frost: {
    name: '迟滞塔',
    damage: 4,
    range: 0.135,
    fireRate: 0.74,
    color: '#70d9ff'
  },
  cannon: {
    name: '穿甲炮',
    damage: 24,
    range: 0.145,
    fireRate: 1.48,
    color: '#ffac66'
  }
}

export const DEFAULT_ROUTE: Point[] = [
  { x: 0.04, y: 0.5 },
  { x: 0.25, y: 0.27 },
  { x: 0.5, y: 0.69 },
  { x: 0.75, y: 0.32 },
  { x: 0.96, y: 0.5 }
]

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export function routeLength(points: Point[]): number {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (!previous || !current) continue
    length += Math.hypot(current.x - previous.x, current.y - previous.y)
  }
  return length
}

export function pointOnRoute(points: Point[], progress: number): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return { ...(points[0] ?? { x: 0, y: 0 }) }
  if (progress <= 0) return { ...(points[0] ?? { x: 0, y: 0 }) }
  if (progress >= 1) return { ...(points.at(-1) ?? { x: 0, y: 0 }) }

  const total = routeLength(points)
  let remaining = clamp(progress, 0, 1) * total

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    if (!start || !end) continue
    const segment = Math.hypot(end.x - start.x, end.y - start.y)
    if (remaining <= segment || index === points.length - 1) {
      const ratio = segment === 0 ? 0 : clamp(remaining / segment, 0, 1)
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
      }
    }
    remaining -= segment
  }

  return { ...(points.at(-1) ?? { x: 0, y: 0 }) }
}

export function routeSignature(points: Point[]): string {
  return points
    .slice(1, -1)
    .map((point) => Math.round(point.y * 10))
    .join('-')
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const projection = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1
  )
  return Math.hypot(point.x - (start.x + dx * projection), point.y - (start.y + dy * projection))
}

export function routeTouchesNode(points: Point[], node: TacticalNodeBlueprint): boolean {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    if (start && end && distanceToSegment(node.position, start, end) <= node.radius * 0.72) {
      return true
    }
  }
  return false
}

export function linkedNodeIds(points: Point[], nodes: TacticalNodeBlueprint[]): number[] {
  return nodes.filter((node) => routeTouchesNode(points, node)).map((node) => node.id)
}

export function evaluateRoutePlan(
  points: Point[],
  nodes: TacticalNodeBlueprint[],
  maxLength: number,
  requiredNodes = nodes.length
): RoutePlanStatus {
  const length = routeLength(points)
  const linked = linkedNodeIds(points, nodes).length
  const required = clamp(requiredNodes, 0, nodes.length)
  return {
    linked,
    required,
    available: nodes.length,
    length,
    remaining: maxLength - length,
    ready: linked >= required && length <= maxLength
  }
}

export function routeExposure(
  points: Point[],
  towers: Pick<TowerBlueprint, 'position' | 'range'>[],
  samples = 96
): number {
  const sampleCount = Math.max(1, Math.floor(samples))
  let exposed = 0
  for (let index = 0; index <= sampleCount; index += 1) {
    const point = pointOnRoute(points, index / sampleCount)
    if (
      towers.some(
        (tower) => Math.hypot(point.x - tower.position.x, point.y - tower.position.y) <= tower.range
      )
    ) {
      exposed += 1
    }
  }
  return exposed / (sampleCount + 1)
}

export function exposureLimitForRound(round: number): number {
  const limit = clamp(0.58 - (Math.max(1, Math.floor(round)) - 1) * 0.02, 0.52, 0.58)
  return Math.round(limit * 100) / 100
}

function routeCandidatesThroughNodes(nodes: TacticalNodeBlueprint[]): Point[][] {
  if (nodes.length !== 3) return []
  const start = DEFAULT_ROUTE[0]
  const end = DEFAULT_ROUTE.at(-1)
  if (!start || !end) return []
  const waypointX = [0.25, 0.5, 0.75]
  return nodes.flatMap((_, freeIndex) =>
    Array.from({ length: 17 }, (_, step) => {
      const waypoints = nodes.map((node) => ({ ...node.position }))
      waypoints[freeIndex] = {
        x: waypointX[freeIndex] ?? 0.5,
        y: 0.1 + step * 0.05
      }
      return [{ ...start }, ...waypoints, { ...end }]
    })
  )
}

export function boardExposureLimit(
  round: number,
  nodes: TacticalNodeBlueprint[],
  towers: Pick<TowerBlueprint, 'position' | 'range'>[],
  maxLength: number,
  requiredNodes = 2
): number {
  const baseLimit = exposureLimitForRound(round)
  const legalRoutes = routeCandidatesThroughNodes(nodes).filter(
    (route) => evaluateRoutePlan(route, nodes, maxLength, requiredNodes).ready
  )
  if (legalRoutes.length === 0) return baseLimit
  const minimumExposure = Math.min(...legalRoutes.map((route) => routeExposure(route, towers)))
  const playableLimit = Math.ceil((minimumExposure + 0.02) * 100) / 100
  return clamp(Math.max(baseLimit, playableLimit), baseLimit, 1)
}

export function routeSimilarity(points: Point[], previous: Point[] | null): number {
  if (!previous || points.length !== previous.length || points.length < 3) return 0
  const editable = points.slice(1, -1)
  const previousEditable = previous.slice(1, -1)
  const averageDelta =
    editable.reduce((sum, point, index) => {
      const oldPoint = previousEditable[index]
      return sum + (oldPoint ? Math.hypot(point.x - oldPoint.x, point.y - oldPoint.y) : 1)
    }, 0) / Math.max(editable.length, 1)
  return clamp(1 - averageDelta / 0.28, 0, 1)
}

export function coreDamageFor(breach: number, activatedNodes: number): number {
  if (activatedNodes <= 0) return 0
  return breach * (activatedNodes >= 2 ? 1 : 0.5)
}

export function analyzeArmy(queue: ArmyBatch[], history?: AIHistory): AIAnalysis {
  const totalUnits = queue.reduce((sum, batch) => sum + UNIT_DEFS[batch.kind].count, 0) || 1
  const slimeUnits = queue
    .filter((batch) => batch.kind === 'slime')
    .reduce((sum, batch) => sum + UNIT_DEFS[batch.kind].count, 0)
  const swiftUnits = queue
    .filter((batch) => batch.kind === 'swift')
    .reduce((sum, batch) => sum + UNIT_DEFS[batch.kind].count, 0)
  const tankUnits = queue
    .filter((batch) => batch.kind === 'tank')
    .reduce((sum, batch) => sum + UNIT_DEFS[batch.kind].count, 0)

  if (history?.repeatedRoute) {
    return {
      mode: 'lockdown',
      name: '路径封锁',
      detail: 'AI 已锁定上一条路线，沿旧路径增设交叉火力。重复走线会让塔伤提高 80%。',
      counter: '旧路火力提高 80%；先移动至少两个路标。',
      mix: { pulse: 0.5, frost: 0.26, cannon: 0.24 },
      accent: '#f07a72'
    }
  }

  const swiftSignal = history ? history.swiftRatio : swiftUnits / totalUnits
  const tankSignal = history ? history.tankRatio : tankUnits / totalUnits
  const slimeSignal = history ? Math.max(0, 1 - swiftSignal - tankSignal) : slimeUnits / totalUnits

  if (history && history.breaches >= 2 && slimeSignal >= 0.55) {
    return {
      mode: 'suppress',
      name: '集群清除',
      detail: 'AI 记住了上一轮密集冲锋，范围火力正在覆盖旧路线。',
      counter: '范围炮惩罚扎堆；让疾行兽先走以拉开距离。',
      mix: { pulse: 0.34, frost: 0.14, cannon: 0.52 },
      accent: '#ed8a68'
    }
  }

  if (swiftSignal >= 0.42) {
    return {
      mode: 'intercept',
      name: '截流协议',
      detail: '侦测到高速集群，AI 正在增配迟滞塔并前移拦截线。',
      counter: '迟滞塔盯最快单位；让铁甲兽先压线。',
      mix: { pulse: 0.22, frost: 0.58, cannon: 0.2 },
      accent: '#70d9ff'
    }
  }

  if (tankSignal >= 0.28) {
    return {
      mode: 'pierce',
      name: '破甲协议',
      detail: '重型信号升高，AI 将射界重叠并启用高伤穿甲炮。',
      counter: '穿甲炮攻击最密处；先用史莱姆骗炮。',
      mix: { pulse: 0.22, frost: 0.16, cannon: 0.62 },
      accent: '#ffac66'
    }
  }

  if (!history && queue.length >= 4 && slimeSignal >= 0.55) {
    return {
      mode: 'suppress',
      name: '集群清除',
      detail: '侦测到密集孢子信号，AI 正在用穿甲炮制造范围杀伤。',
      counter: '范围炮惩罚扎堆；让疾行兽先走以拉开距离。',
      mix: { pulse: 0.38, frost: 0.14, cannon: 0.48 },
      accent: '#ff8d72'
    }
  }

  return {
    mode: 'balanced',
    name: '均衡戒备',
    detail: '威胁样本不足，AI 采用脉冲塔为主的通用防线。',
    counter: '脉冲塔追击最前单位；让史莱姆先吃火力。',
    mix: { pulse: 0.52, frost: 0.28, cannon: 0.2 },
    accent: '#ff7188'
  }
}

export function modifiersFor(mutations: MutationId[]): CombatModifiers {
  const owned = new Set(mutations)
  return {
    slimeBonus: owned.has('slime_bloom') ? 1 : 0,
    swiftShield: owned.has('swift_phase') ? 1 : 0,
    tankHpMultiplier: owned.has('tank_plating') ? 1.22 : 1,
    tankArmorBonus: owned.has('tank_plating') ? 0.1 : 0,
    costDiscount: owned.has('brood_discount') ? 6 : 0,
    speedMultiplier: owned.has('neural_drive') ? 1.09 : 1,
    nodeMultiplier: owned.has('neural_drive') ? 1.25 : 1,
    breachCredit: owned.has('signal_leech') ? 2 : 0,
    jammerDuration: 1.8 + (owned.has('jammer_echo') ? 1.2 : 0)
  }
}

export function unitDefinition(kind: UnitKind, mutations: MutationId[] = []): UnitDefinition {
  const base = UNIT_DEFS[kind]
  const modifiers = modifiersFor(mutations)
  if (kind !== 'tank') return { ...base, speed: base.speed * modifiers.speedMultiplier }
  return {
    ...base,
    hp: Math.round(base.hp * modifiers.tankHpMultiplier),
    armor: clamp(base.armor + modifiers.tankArmorBonus, 0, 0.75),
    speed: base.speed * modifiers.speedMultiplier
  }
}

export function unitCost(kind: UnitKind, mutations: MutationId[] = []): number {
  return Math.max(18, UNIT_DEFS[kind].cost - modifiersFor(mutations).costDiscount)
}

export function mutationOffers(round: number, owned: MutationId[]): MutationDefinition[] {
  const ownedSet = new Set(owned)
  const candidates = (Object.keys(MUTATION_DEFS) as MutationId[]).filter((id) => !ownedSet.has(id))
  const random = seededRandom(round * 409 + owned.length * 97 + 13)
  return candidates
    .map((id) => ({ id, roll: random() }))
    .sort((left, right) => left.roll - right.roll)
    .slice(0, 3)
    .map(({ id }) => MUTATION_DEFS[id])
}

export function generateTacticalNodes(round: number, seed = 31): TacticalNodeBlueprint[] {
  const random = seededRandom(seed + round * 577)
  const kinds: TacticalNodeKind[] = ['vitality', 'haste', 'jammer']
  const xPositions = round % 2 === 0 ? [0.28, 0.5, 0.73] : [0.27, 0.51, 0.72]
  return xPositions.map((x, index) => ({
    id: index + 1,
    kind: kinds[(round + index - 1) % kinds.length] ?? 'vitality',
    position: { x, y: 0.18 + random() * 0.64 },
    radius: 0.055
  }))
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function pickTowerKind(analysis: AIAnalysis, roll: number): TowerKind {
  if (roll < analysis.mix.pulse) return 'pulse'
  if (roll < analysis.mix.pulse + analysis.mix.frost) return 'frost'
  return 'cannon'
}

export function generateTowerBlueprints(
  points: Point[],
  round: number,
  analysis: AIAnalysis,
  seed = 1
): TowerBlueprint[] {
  const random = seededRandom(seed + round * 811)
  const count = clamp(6 + Math.floor(round / 2) + (analysis.mode === 'lockdown' ? 1 : 0), 6, 9)
  const towers: TowerBlueprint[] = []

  for (let index = 0; index < count; index += 1) {
    const progress = 0.14 + (index / Math.max(count - 1, 1)) * 0.72 + (random() - 0.5) * 0.035
    const here = pointOnRoute(points, progress)
    const ahead = pointOnRoute(points, clamp(progress + 0.018, 0, 1))
    const dx = ahead.x - here.x
    const dy = ahead.y - here.y
    const magnitude = Math.hypot(dx, dy) || 1
    const direction = index % 2 === 0 ? 1 : -1
    const offset = (0.085 + random() * 0.025) * direction
    const kind = pickTowerKind(analysis, random())

    towers.push({
      id: index + 1,
      kind,
      position: {
        x: clamp(here.x + (-dy / magnitude) * offset, 0.08, 0.92),
        y: clamp(here.y + (dx / magnitude) * offset, 0.12, 0.88)
      },
      range: TOWER_DEFS[kind].range,
      level: round >= 3 && index % 3 === 0 ? 2 : 1
    })
  }

  return towers
}

export function buildSpawnPlan(queue: ArmyBatch[], mutations: MutationId[] = []): SpawnEntry[] {
  const unitGap = 0.34
  const batchGap = 1.05
  const plan: SpawnEntry[] = []
  const modifiers = modifiersFor(mutations)
  let cursor = 0

  for (const batch of queue) {
    const definition = UNIT_DEFS[batch.kind]
    const count = definition.count + (batch.kind === 'slime' ? modifiers.slimeBonus : 0)
    for (let index = 0; index < count; index += 1) {
      plan.push({ at: cursor + index * unitGap, kind: batch.kind, batchId: batch.id })
    }
    cursor += (count - 1) * unitGap + batchGap
  }

  return plan
}

export function compositionOf(queue: ArmyBatch[]): { swiftRatio: number; tankRatio: number } {
  const unitCounts = queue.reduce(
    (counts, batch) => {
      counts[batch.kind] += UNIT_DEFS[batch.kind].count
      return counts
    },
    { slime: 0, swift: 0, tank: 0 }
  )
  const total = unitCounts.slime + unitCounts.swift + unitCounts.tank || 1
  return {
    swiftRatio: unitCounts.swift / total,
    tankRatio: unitCounts.tank / total
  }
}
