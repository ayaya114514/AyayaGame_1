export type UnitKind = 'slime' | 'swift' | 'tank'
export type TowerKind = 'pulse' | 'frost' | 'cannon'
export type Formation = 'rush' | 'steady' | 'split'

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
  mode: 'balanced' | 'intercept' | 'pierce'
  name: string
  detail: string
  mix: Record<TowerKind, number>
  accent: string
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

export function analyzeArmy(queue: ArmyBatch[], history?: AIHistory): AIAnalysis {
  const totalUnits = queue.reduce((sum, batch) => sum + UNIT_DEFS[batch.kind].count, 0) || 1
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
      mix: { pulse: 0.22, frost: 0.58, cannon: 0.2 },
      accent: '#70d9ff'
    }
  }

  if (tankSignal >= 0.28) {
    return {
      mode: 'pierce',
      name: '破甲协议',
      detail: '重型信号升高，AI 将射界重叠并启用高伤穿甲炮。',
      mix: { pulse: 0.22, frost: 0.16, cannon: 0.62 },
      accent: '#ffac66'
    }
  }

  if (history?.repeatedRoute) {
    return {
      mode: 'balanced',
      name: '路径封锁',
      detail: '路线特征重复，AI 已在上次突破点建立交叉火力。',
      mix: { pulse: 0.5, frost: 0.26, cannon: 0.24 },
      accent: '#ff7188'
    }
  }

  return {
    mode: 'balanced',
    name: '均衡戒备',
    detail: '威胁样本不足，AI 采用脉冲塔为主的通用防线。',
    mix: { pulse: 0.52, frost: 0.28, cannon: 0.2 },
    accent: '#ff7188'
  }
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
  const count = clamp(3 + Math.floor(round / 2), 3, 5)
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

export function buildSpawnPlan(queue: ArmyBatch[], formation: Formation): SpawnEntry[] {
  const unitGap: Record<Formation, number> = { rush: 0.2, steady: 0.34, split: 0.42 }
  const batchGap: Record<Formation, number> = { rush: 0.58, steady: 1.05, split: 1.85 }
  const plan: SpawnEntry[] = []
  let cursor = 0

  for (const batch of queue) {
    const definition = UNIT_DEFS[batch.kind]
    for (let index = 0; index < definition.count; index += 1) {
      plan.push({ at: cursor + index * unitGap[formation], kind: batch.kind, batchId: batch.id })
    }
    cursor += (definition.count - 1) * unitGap[formation] + batchGap[formation]
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
