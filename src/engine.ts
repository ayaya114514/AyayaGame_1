export type UnitKind = 'slime' | 'swift' | 'tank'
export type TowerKind = 'pulse' | 'frost' | 'cannon'
export type Formation = 'rush' | 'steady' | 'split'
export type MutationId =
  | 'slime_bloom'
  | 'swift_phase'
  | 'tank_plating'
  | 'brood_discount'
  | 'neural_drive'
  | 'signal_leech'
  | 'emp_overload'
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
  formation?: Formation
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
  empDuration: number
}

export type TacticalNodeBlueprint = {
  id: number
  kind: TacticalNodeKind
  position: Point
  radius: number
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
    detail: '所有怪物批次的购买价格降低 6 DATA。',
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
    detail: '每次突破核心都会掠夺 2 DATA。',
    accent: '#ff9fcb'
  },
  emp_overload: {
    id: 'emp_overload',
    name: '过载脉冲',
    code: 'EMP +1.2S',
    detail: '每波一次的 EMP 指令持续时间增加 1.2 秒。',
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
    damage: 6,
    range: 0.155,
    fireRate: 0.52,
    color: '#ff7188'
  },
  frost: {
    name: '迟滞塔',
    damage: 3,
    range: 0.145,
    fireRate: 0.74,
    color: '#70d9ff'
  },
  cannon: {
    name: '穿甲炮',
    damage: 20,
    range: 0.18,
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

export function analyzeArmy(
  queue: ArmyBatch[],
  history?: AIHistory,
  formation: Formation = 'steady'
): AIAnalysis {
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

  const swiftSignal = swiftUnits / totalUnits + (history?.swiftRatio ?? 0) * 0.72
  const tankSignal = tankUnits / totalUnits + (history?.tankRatio ?? 0) * 0.72

  if (swiftSignal >= 0.42) {
    return {
      mode: 'intercept',
      name: '截流协议',
      detail: '侦测到高速集群，AI 正在增配迟滞塔并前移拦截线。',
      counter: '破解：混入铁甲兽吸收迟滞火力，或改用标准波次。',
      mix: { pulse: 0.22, frost: 0.58, cannon: 0.2 },
      accent: '#70d9ff'
    }
  }

  if (tankSignal >= 0.28) {
    return {
      mode: 'pierce',
      name: '破甲协议',
      detail: '重型信号升高，AI 将射界重叠并启用高伤穿甲炮。',
      counter: '破解：用史莱姆消耗炮击冷却，避免铁甲兽单独出兵。',
      mix: { pulse: 0.22, frost: 0.16, cannon: 0.62 },
      accent: '#ffac66'
    }
  }

  if (formation === 'rush' && queue.length >= 4 && slimeUnits / totalUnits >= 0.55) {
    return {
      mode: 'suppress',
      name: '集群清除',
      detail: '侦测到密集孢子信号，AI 正在用穿甲炮制造范围杀伤。',
      counter: '破解：改为分批出兵，或让疾行兽先骗出炮击。',
      mix: { pulse: 0.38, frost: 0.14, cannon: 0.48 },
      accent: '#ff8d72'
    }
  }

  if (history?.repeatedRoute) {
    return {
      mode: 'lockdown',
      name: '路径封锁',
      detail: '路线特征重复，AI 已在上次突破点建立交叉火力。',
      counter: '破解：移动至少两个路标，争夺本轮战场信标。',
      mix: { pulse: 0.5, frost: 0.26, cannon: 0.24 },
      accent: '#ff7188'
    }
  }

  return {
    mode: 'balanced',
    name: '均衡戒备',
    detail: '威胁样本不足，AI 采用脉冲塔为主的通用防线。',
    counter: '破解：观察射界后重新布线，不要把所有单位放在同一批次。',
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
    empDuration: 1.8 + (owned.has('emp_overload') ? 1.2 : 0)
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
  const xPositions = round % 2 === 0 ? [0.29, 0.72] : [0.36, 0.68]
  return xPositions.map((x, index) => ({
    id: index + 1,
    kind: kinds[(round + index - 1) % kinds.length] ?? 'vitality',
    position: { x, y: 0.2 + random() * 0.6 },
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
  const count = clamp(3 + Math.floor(round / 2) + (analysis.mode === 'lockdown' ? 1 : 0), 3, 6)
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
      level: round >= 4 && index % 3 === 0 ? 2 : 1
    })
  }

  return towers
}

export function buildSpawnPlan(
  queue: ArmyBatch[],
  formation: Formation,
  mutations: MutationId[] = []
): SpawnEntry[] {
  const unitGap: Record<Formation, number> = { rush: 0.2, steady: 0.34, split: 0.42 }
  const batchGap: Record<Formation, number> = { rush: 0.58, steady: 1.05, split: 1.85 }
  const plan: SpawnEntry[] = []
  const modifiers = modifiersFor(mutations)
  let cursor = 0

  for (const batch of queue) {
    const definition = UNIT_DEFS[batch.kind]
    const count = definition.count + (batch.kind === 'slime' ? modifiers.slimeBonus : 0)
    for (let index = 0; index < count; index += 1) {
      plan.push({ at: cursor + index * unitGap[formation], kind: batch.kind, batchId: batch.id })
    }
    cursor += (count - 1) * unitGap[formation] + batchGap[formation]
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
