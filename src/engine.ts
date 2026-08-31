export type UnitKind = 'slime' | 'swift' | 'tank'
export type TowerKind = 'pulse' | 'frost' | 'cannon'
export type Formation = 'rush' | 'steady' | 'split'
export type CommandKind = 'blackout' | 'overdrive' | 'mend'
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

export type FormationMatchup = {
  state: 'favored' | 'neutral' | 'exposed'
  label: string
  detail: string
  damageMultiplier: number
  slowMultiplier: number
  splashMultiplier: number
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

export type RoutePlanStatus = {
  linked: number
  total: number
  length: number
  remaining: number
  ready: boolean
}

export type CommandDefinition = {
  name: string
  short: string
  detail: string
  color: string
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

export const COMMAND_DEFS: Record<CommandKind, CommandDefinition> = {
  blackout: {
    name: '静默脉冲',
    short: '停火 1.8 秒',
    detail: '让全部防御塔暂时离线。适合穿越重叠射界。',
    color: '#83d7ff'
  },
  overdrive: {
    name: '过载冲刺',
    short: '全军加速 2.4 秒',
    detail: '短时间提高全军速度。适合冲过迟滞防线。',
    color: '#ffd56a'
  },
  mend: {
    name: '再生指令',
    short: '恢复 38% 生命',
    detail: '修复场上所有存活单位。适合保护铁甲兽。',
    color: '#7ee2ae'
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
  maxLength: number
): RoutePlanStatus {
  const length = routeLength(points)
  const linked = linkedNodeIds(points, nodes).length
  return {
    linked,
    total: nodes.length,
    length,
    remaining: maxLength - length,
    ready: linked === nodes.length && length <= maxLength
  }
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

  if (history?.repeatedRoute) {
    return {
      mode: 'lockdown',
      name: '路径封锁',
      detail: 'AI 已锁定上一条路线，沿旧路径增设交叉火力。重复走线会让塔伤提高 30%。',
      counter: '破解：移动至少两个路标，或用静默脉冲穿越封锁区。',
      mix: { pulse: 0.5, frost: 0.26, cannon: 0.24 },
      accent: '#f07a72'
    }
  }

  if (history?.formation === 'rush' && history.breaches >= 2) {
    return {
      mode: 'suppress',
      name: '集群清除',
      detail: 'AI 记住了上一轮密集冲锋，范围火力正在覆盖旧路线。',
      counter: '破解：改用分批，拉开单位间距来削弱溅射伤害。',
      mix: { pulse: 0.34, frost: 0.14, cannon: 0.52 },
      accent: '#ed8a68'
    }
  }

  const swiftSignal = history ? history.swiftRatio : swiftUnits / totalUnits
  const tankSignal = history ? history.tankRatio : tankUnits / totalUnits

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

  if (!history && formation === 'rush' && queue.length >= 4 && slimeUnits / totalUnits >= 0.55) {
    return {
      mode: 'suppress',
      name: '集群清除',
      detail: '侦测到密集孢子信号，AI 正在用穿甲炮制造范围杀伤。',
      counter: '破解：改为分批出兵，或让疾行兽先骗出炮击。',
      mix: { pulse: 0.38, frost: 0.14, cannon: 0.48 },
      accent: '#ff8d72'
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

export function formationMatchup(formation: Formation, mode: AIAnalysis['mode']): FormationMatchup {
  if (mode === 'pierce' && formation === 'rush') {
    return {
      state: 'favored',
      label: '节奏占优',
      detail: '密集冲锋能挤压穿甲炮的长冷却。',
      damageMultiplier: 0.86,
      slowMultiplier: 1,
      splashMultiplier: 1.16
    }
  }
  if (mode === 'suppress' && formation === 'split') {
    return {
      state: 'favored',
      label: '节奏占优',
      detail: '分批部署将范围溅射降低 58%。',
      damageMultiplier: 1,
      slowMultiplier: 1,
      splashMultiplier: 0.42
    }
  }
  if (mode === 'intercept' && formation === 'steady') {
    return {
      state: 'favored',
      label: '节奏占优',
      detail: '标准节奏让迟滞效果更快衰减。',
      damageMultiplier: 1,
      slowMultiplier: 0.66,
      splashMultiplier: 1
    }
  }
  if (mode === 'lockdown' && formation === 'split') {
    return {
      state: 'exposed',
      label: '节奏不利',
      detail: '分批部队会被封锁区逐个击破。',
      damageMultiplier: 1.13,
      slowMultiplier: 1.08,
      splashMultiplier: 1
    }
  }
  if (mode === 'suppress' && formation === 'rush') {
    return {
      state: 'exposed',
      label: '节奏不利',
      detail: '密集单位将承受完整范围伤害。',
      damageMultiplier: 1.06,
      slowMultiplier: 1,
      splashMultiplier: 1.28
    }
  }
  return {
    state: 'neutral',
    label: '节奏中性',
    detail: '当前间隔不会明显克制这套防线。',
    damageMultiplier: 1,
    slowMultiplier: 1,
    splashMultiplier: 1
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
