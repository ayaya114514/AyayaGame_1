import './style.css'
import {
  DEFAULT_ROUTE,
  MUTATION_DEFS,
  TACTICAL_NODE_DEFS,
  TOWER_DEFS,
  UNIT_DEFS,
  analyzeArmy,
  buildSpawnPlan,
  clamp,
  compositionOf,
  coreDamageFor,
  evaluateRoutePlan,
  generateTacticalNodes,
  generateTowerBlueprints,
  modifiersFor,
  mutationOffers,
  pointOnRoute,
  routeLength,
  routeSimilarity,
  routeSignature,
  unitCost,
  unitDefinition,
  type AIAnalysis,
  type AIHistory,
  type ArmyBatch,
  type MutationDefinition,
  type MutationId,
  type Point,
  type SpawnEntry,
  type TowerBlueprint,
  type TowerKind,
  type TacticalNodeBlueprint,
  type UnitKind
} from './engine'

type Phase = 'planning' | 'battle' | 'summary' | 'ended'

type RuntimeUnit = {
  id: number
  kind: UnitKind
  progress: number
  hp: number
  maxHp: number
  slowUntil: number
  shield: number
  flash: number
  alive: boolean
}

type RuntimeTower = TowerBlueprint & {
  cooldown: number
  recoil: number
}

type RuntimeNode = TacticalNodeBlueprint & {
  activated: boolean
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

type Shot = {
  from: Point
  to: Point
  life: number
  maxLife: number
  color: string
  width: number
}

type FloatLabel = {
  x: number
  y: number
  text: string
  color: string
  life: number
}

type WaveStats = {
  deployed: number
  destroyed: number
  breaches: number
  coreDamage: number
  nodes: number
}

const MAX_ROUNDS = 4
const MAX_CORE = 32
const STARTING_CREDITS = 132
const MAX_ROUTE_LENGTH = 1.35
const MIN_BATCHES = 2
const MAX_BATCHES = 4
const maybeApp = document.querySelector<HTMLDivElement>('#app')

if (!maybeApp) throw new Error('App root is missing')
const app: HTMLDivElement = maybeApp

app.innerHTML = `
  <div class="app-shell">
    <main class="game-stage">
      <section class="battlefield" aria-label="战场">
        <div class="canvas-wrap">
          <canvas id="battlefield" tabindex="0" aria-label="路线战场。拖动三个圆形路标，让路线经过两个中继并避开红色火力路段。"></canvas>
          <a class="brand" href="." aria-label="Ayaya Breach Protocol 首页"><strong>Ayaya</strong></a>
          <div class="field-hud" aria-label="战局状态">
            <div class="hud-stat round-stat"><span>R</span><strong id="round-value">1 / 4</strong></div>
            <div class="hud-stat core-stat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 7 6-2.7 10H7.7L5 8l7-6Z"/></svg><strong id="core-value">32</strong></div>
            <div class="hud-stat credit-stat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 8v8l8 5 8-5V8l-8-5Zm0 5v8m-4-6 4 2 4-2"/></svg><strong id="credit-value">132</strong></div>
          </div>
          <div class="top-actions">
            <button class="icon-button" id="sound-button" type="button" aria-label="关闭音效" aria-pressed="true">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9H5Zm12.5 1a3.5 3.5 0 0 1 0 4M19.7 7a7 7 0 0 1 0 10"/></svg>
            </button>
            <button class="icon-button reset-button" id="reset-button" type="button" aria-label="重置战局">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>
            </button>
          </div>
          <div class="phase-label"><i></i><span id="phase-label">规划中</span></div>
          <p class="battle-rule" id="defense-copy">红色路段处于火力覆盖内</p>
          <button class="speed-button" id="speed-button" type="button" aria-label="切换战斗速度" disabled>1×</button>
          <div class="map-hint" id="map-hint"><b>↝</b><span>拖动白色孢子，串起两枚中继</span></div>
          <div class="wave-progress" id="wave-progress" hidden><i></i></div>
          <div class="combat-toast" id="combat-toast" role="status" aria-live="polite"></div>
          <div class="route-dashboard" aria-label="路线评估">
            <div class="relay-strip" id="relay-dots" aria-hidden="true"><i></i><span></span><i></i></div>
            <div class="route-meter"><i id="route-meter-fill"></i><b></b></div>
            <strong id="route-length">1.52</strong>
            <strong id="trace-value">路线无效</strong>
            <span class="sr-only">中继 <strong id="relay-value">0 / 2</strong></span>
          </div>
          <section class="swarm-control" aria-label="出兵顺序">
            <div class="unit-market" id="unit-market">
              <button class="unit-card slime" type="button" data-unit="slime" aria-label="加入史莱姆">
                <svg class="unit-glyph" viewBox="0 0 64 64" aria-hidden="true"><path d="M10 42c0-17 8-29 22-29s22 12 22 29c0 8-9 11-15 7-5 5-10 5-15 0-6 4-14 1-14-7Z"/><circle cx="27" cy="33" r="2.5"/><circle cx="39" cy="33" r="2.5"/></svg>
                <span class="unit-meta"><em>×3</em><strong class="unit-cost">30</strong></span>
              </button>
              <button class="unit-card swift" type="button" data-unit="swift" aria-label="加入疾行兽">
                <svg class="unit-glyph" viewBox="0 0 64 64" aria-hidden="true"><path d="m56 32-42 21 11-21-11-21 42 21Z"/><path d="m24 32-15 8 7-8-7-8 15 8Z"/></svg>
                <span class="unit-meta"><em>×2</em><strong class="unit-cost">42</strong></span>
              </button>
              <button class="unit-card tank" type="button" data-unit="tank" aria-label="加入铁甲兽">
                <svg class="unit-glyph" viewBox="0 0 64 64" aria-hidden="true"><path d="M12 18h38v35H12z"/><path d="M20 10h28v15H20zm30 18h8v10h-8z"/><circle cx="22" cy="53" r="5"/><circle cx="43" cy="53" r="5"/></svg>
                <span class="unit-meta"><em>×1</em><strong class="unit-cost">60</strong></span>
              </button>
            </div>
            <div class="queue-track" id="queue-track" aria-label="当前出兵序列"></div>
            <div class="mutation-rack" id="mutation-rack" aria-label="自动进化"><small>无进化</small></div>
            <div class="launch-zone">
              <div class="readiness"><i id="ready-light"></i><strong id="ready-title">路线无效</strong><small id="ready-copy">经过两个中继并缩短路线</small></div>
              <button class="launch-button" id="launch-button" type="button" disabled>
                <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m7 25 18-9L7 7l4 9-4 9Z"/></svg>
                <span class="sr-only">出发</span>
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  </div>

  <div class="modal-backdrop" id="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title" aria-hidden="true">
    <section class="modal summary-modal">
      <span class="modal-index" id="summary-index">第 1 回合</span>
      <h2 id="summary-title">回合结束</h2>
      <p id="summary-copy">下一回合的火力会重新布置。</p>
      <div class="report-stats">
        <div><span>部署</span><strong id="stat-deployed">0</strong></div>
        <div><span>突破</span><strong id="stat-breaches">0</strong></div>
        <div><span>核心伤害</span><strong id="stat-damage">0</strong></div>
        <div><span>情报奖励</span><strong id="stat-reward">+0</strong></div>
      </div>
      <div class="earned-upgrade" id="earned-upgrade">
        <span>自动进化</span>
        <p><strong id="earned-upgrade-name">相位薄膜</strong> · <span id="earned-upgrade-copy">疾行兽抵消第一次攻击。</span></p>
      </div>
      <button class="primary-modal-button" id="continue-button" type="button">下一回合 <span>→</span></button>
    </section>
  </div>

  <div class="sr-only" id="announcer" aria-live="assertive"></div>
`

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}

const canvas = byId<HTMLCanvasElement>('battlefield')
const maybeContext = canvas.getContext('2d')
if (!maybeContext) throw new Error('Canvas 2D is unavailable')
const context: CanvasRenderingContext2D = maybeContext

const ui = {
  round: byId('round-value'),
  core: byId('core-value'),
  credits: byId('credit-value'),
  routeLength: byId('route-length'),
  routeMeter: byId('route-meter-fill'),
  relayDots: byId('relay-dots'),
  relayValue: byId('relay-value'),
  traceValue: byId('trace-value'),
  mutationRack: byId('mutation-rack'),
  queue: byId('queue-track'),
  market: byId('unit-market'),
  defenseCopy: byId('defense-copy'),
  readyLight: byId('ready-light'),
  readyTitle: byId('ready-title'),
  readyCopy: byId('ready-copy'),
  launch: byId<HTMLButtonElement>('launch-button'),
  phase: byId('phase-label'),
  mapHint: byId('map-hint'),
  speed: byId<HTMLButtonElement>('speed-button'),
  waveProgress: byId('wave-progress'),
  combatToast: byId('combat-toast'),
  summary: byId('summary-modal'),
  earnedUpgrade: byId('earned-upgrade'),
  continueButton: byId<HTMLButtonElement>('continue-button'),
  announcer: byId('announcer'),
  sound: byId<HTMLButtonElement>('sound-button')
}

let phase: Phase = 'planning'
let round = 1
let credits = STARTING_CREDITS
let core = MAX_CORE
let score = 0
let bestScore = Number.parseInt(localStorage.getItem('breach-protocol-best') ?? '0', 10) || 0
let queue: ArmyBatch[] = []
let nextBatchId = 1
let route = DEFAULT_ROUTE.map((point) => ({ ...point }))
let defenseRoute = DEFAULT_ROUTE.map((point) => ({ ...point }))
let previousRoute: Point[] | null = null
let history: AIHistory | undefined
let analysis: AIAnalysis = analyzeArmy([])
let towers: RuntimeTower[] = []
let nodes: RuntimeNode[] = generateTacticalNodes(round).map((node) => ({
  ...node,
  activated: false
}))
let units: RuntimeUnit[] = []
let spawnPlan: SpawnEntry[] = []
let spawnIndex = 0
let nextUnitId = 1
let waveElapsed = 0
let speed = 1
let ownedMutations: MutationId[] = []
let lastEarnedMutation: MutationDefinition | null = null
let routeRepeated = false
let jammedUntil = 0
let globalBoostUntil = 0
let selectedWaypoint = 2
let draggedWaypoint: number | null = null
let particles: Particle[] = []
let shots: Shot[] = []
let labels: FloatLabel[] = []
let waveStats: WaveStats = { deployed: 0, destroyed: 0, breaches: 0, coreDamage: 0, nodes: 0 }
let lastTimestamp = performance.now()
let canvasWidth = 0
let canvasHeight = 0
let toastTimer = 0
let soundEnabled = true

class SoundDeck {
  private audioContext?: AudioContext

  private getContext(): AudioContext | undefined {
    if (!soundEnabled) return undefined
    this.audioContext ??= new AudioContext()
    if (this.audioContext.state === 'suspended') void this.audioContext.resume()
    return this.audioContext
  }

  play(type: 'click' | 'launch' | 'hit' | 'breach' | 'win'): void {
    const audio = this.getContext()
    if (!audio) return
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    const now = audio.currentTime
    const settings = {
      click: [280, 360, 0.035, 0.04],
      launch: [150, 420, 0.16, 0.075],
      hit: [210, 120, 0.045, 0.018],
      breach: [320, 760, 0.22, 0.09],
      win: [260, 880, 0.45, 0.1]
    } as const
    const [start, end, duration, volume] = settings[type]
    oscillator.type = type === 'hit' ? 'square' : 'sine'
    oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }
}

const sounds = new SoundDeck()

function rebuildDefense(): void {
  const similarity = routeSimilarity(route, previousRoute)
  routeRepeated = round > 1 && similarity >= 0.78
  const planningHistory = history ? { ...history, repeatedRoute: routeRepeated } : undefined
  analysis = planningHistory ? analyzeArmy([], planningHistory) : analyzeArmy([])
  const signatureSeed = routeSignature(defenseRoute)
    .split('-')
    .reduce((sum, value) => sum * 17 + Number(value), 19)
  towers = generateTowerBlueprints(defenseRoute, round, analysis, signatureSeed).map((tower) => ({
    ...tower,
    cooldown: Math.random() * 0.3,
    recoil: 0
  }))
}

function formatScore(value: number): string {
  return Math.round(value).toString().padStart(6, '0')
}

function updateUI(): void {
  const isPlanning = phase === 'planning'
  const modifiers = modifiersFor(ownedMutations)
  const routeStatus = evaluateRoutePlan(route, nodes, MAX_ROUTE_LENGTH)
  const similarity = routeSimilarity(route, previousRoute)
  routeRepeated = round > 1 && similarity >= 0.72

  ui.round.textContent = `${round} / ${MAX_ROUNDS}`
  ui.core.textContent = Math.ceil(core).toString()
  ui.credits.textContent = credits.toString()
  ui.routeLength.textContent = routeStatus.length.toFixed(2)
  ui.routeLength.className = routeStatus.remaining >= 0 ? 'ready-value' : 'danger-value'
  const routeRatio = clamp(routeStatus.length / MAX_ROUTE_LENGTH, 0, 1.18)
  ui.routeMeter.style.width = `${Math.min(routeRatio, 1) * 100}%`
  ui.routeMeter.classList.toggle('danger', routeStatus.remaining < 0)
  ui.relayValue.textContent = `${routeStatus.linked} / ${routeStatus.total}`
  ui.relayValue.className =
    routeStatus.linked === routeStatus.total ? 'ready-value' : 'danger-value'
  ui.relayDots.querySelectorAll('i').forEach((dot, index) => {
    dot.classList.toggle('linked', index < routeStatus.linked)
  })
  ui.traceValue.textContent =
    round === 1 ? (routeStatus.ready ? '可突破' : '未接通') : routeRepeated ? '+60% 火力' : '新路线'
  ui.traceValue.className = routeRepeated ? 'danger-value' : 'ready-value'
  ui.defenseCopy.textContent = routeRepeated
    ? '路径暴露 · 火力 +60%'
    : round > 1
      ? '火力已重布'
      : '红色 = 火力覆盖'

  ui.mutationRack.innerHTML = ownedMutations.length
    ? `<div>${ownedMutations
        .map((id) => {
          const mutation = MUTATION_DEFS[id]
          return `<i title="${mutation.name} · ${mutation.detail}" aria-label="${mutation.name}"></i>`
        })
        .join('')}</div>`
    : '<small>无进化</small>'

  ui.queue.innerHTML = queue.length
    ? queue
        .map(
          (
            batch,
            index
          ) => `<button type="button" class="queue-token ${batch.kind}" data-remove-batch="${batch.id}" aria-label="撤回第 ${index + 1} 批 ${UNIT_DEFS[batch.kind].name}">
              <i></i><strong>×${UNIT_DEFS[batch.kind].count + (batch.kind === 'slime' ? modifiers.slimeBonus : 0)}</strong>
            </button>`
        )
        .join('')
    : '<div class="queue-empty" aria-hidden="true"><i></i><i></i><i></i><i></i></div>'

  ui.market.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((button) => {
    const kind = button.dataset.unit as UnitKind
    const cost = unitCost(kind, ownedMutations)
    const count = UNIT_DEFS[kind].count + (kind === 'slime' ? modifiers.slimeBonus : 0)
    const countLabel = button.querySelector('em')
    const costLabel = button.querySelector('.unit-cost')
    if (countLabel) countLabel.textContent = `×${count}`
    if (costLabel) costLabel.textContent = cost.toString()
    button.disabled = !isPlanning || credits < cost || queue.length >= MAX_BATCHES
  })

  const totalUnits = queue.reduce(
    (sum, batch) =>
      sum + UNIT_DEFS[batch.kind].count + (batch.kind === 'slime' ? modifiers.slimeBonus : 0),
    0
  )
  const armyReady = queue.length >= MIN_BATCHES
  const canLaunch = isPlanning && armyReady && routeStatus.ready
  ui.launch.disabled = !canLaunch
  ui.readyLight.classList.toggle('ready', canLaunch)
  ui.readyTitle.textContent =
    routeStatus.linked < routeStatus.total
      ? `还差 ${routeStatus.total - routeStatus.linked} 个中继`
      : routeStatus.remaining < 0
        ? `路线超出 ${Math.abs(routeStatus.remaining).toFixed(2)}`
        : !armyReady
          ? `还需 ${MIN_BATCHES - queue.length} 批单位`
          : `${totalUnits} 个单位就绪`
  ui.readyCopy.textContent = canLaunch ? '可以出发' : '拖路线或调整队列'
  ui.phase.textContent = phase === 'battle' ? '突破中' : phase === 'planning' ? '规划中' : '结算中'
  ui.mapHint.classList.toggle('hidden', !isPlanning || routeStatus.ready)
  ui.speed.disabled = phase !== 'battle'
  ui.waveProgress.toggleAttribute('hidden', phase !== 'battle')
  app.dataset.phase = phase
  app.dataset.round = round.toString()
  app.dataset.core = core.toString()
  app.dataset.relays = routeStatus.linked.toString()
  app.dataset.routeReady = routeStatus.ready.toString()
  app.dataset.doctrine = analysis.mode
  app.dataset.repeated = routeRepeated.toString()
}

function showToast(message: string, tone: 'neutral' | 'success' | 'danger' = 'neutral'): void {
  ui.combatToast.textContent = message
  ui.combatToast.className = `combat-toast visible ${tone}`
  toastTimer = 1.8
}

function addBatch(kind: UnitKind): void {
  const cost = unitCost(kind, ownedMutations)
  if (phase !== 'planning' || credits < cost || queue.length >= MAX_BATCHES) return
  credits -= cost
  queue.push({ id: nextBatchId, kind })
  nextBatchId += 1
  rebuildDefense()
  updateUI()
  sounds.play('click')
}

function removeBatch(id: number): void {
  if (phase !== 'planning') return
  const batch = queue.find((item) => item.id === id)
  if (!batch) return
  credits += unitCost(batch.kind, ownedMutations)
  queue = queue.filter((item) => item.id !== id)
  rebuildDefense()
  updateUI()
  sounds.play('click')
}

function launchWave(): void {
  const routeStatus = evaluateRoutePlan(route, nodes, MAX_ROUTE_LENGTH)
  if (phase !== 'planning' || queue.length < MIN_BATCHES || !routeStatus.ready) return
  phase = 'battle'
  spawnPlan = buildSpawnPlan(queue, 'steady', ownedMutations)
  spawnIndex = 0
  waveElapsed = 0
  waveStats = { deployed: spawnPlan.length, destroyed: 0, breaches: 0, coreDamage: 0, nodes: 0 }
  units = []
  particles = []
  shots = []
  labels = []
  jammedUntil = 0
  globalBoostUntil = 0
  nodes.forEach((node) => (node.activated = false))
  speed = 1
  ui.speed.textContent = '1×'
  towers.forEach((tower) => {
    tower.cooldown = Math.random() * 0.35
  })
  showToast(`第 ${round} 回合 · 入侵开始`, 'neutral')
  ui.announcer.textContent = `第 ${round} 回合入侵开始，共 ${spawnPlan.length} 个单位。`
  updateUI()
  sounds.play('launch')
}

function spawnUnit(entry: SpawnEntry): void {
  const definition = unitDefinition(entry.kind, ownedMutations)
  units.push({
    id: nextUnitId,
    kind: entry.kind,
    progress: 0,
    hp: definition.hp,
    maxHp: definition.hp,
    slowUntil: 0,
    shield: entry.kind === 'swift' ? modifiersFor(ownedMutations).swiftShield : 0,
    flash: 0,
    alive: true
  })
  nextUnitId += 1
  const origin = route[0] ?? { x: 0.04, y: 0.5 }
  burst(origin, definition.color, 4, 0.04)
}

function burst(position: Point, color: string, count: number, force = 0.08): void {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2
    const power = force * (0.4 + Math.random() * 0.8)
    particles.push({
      x: position.x,
      y: position.y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      color,
      size: 1.5 + Math.random() * 3
    })
  }
}

function damageUnit(
  target: RuntimeUnit,
  damage: number,
  tower: RuntimeTower,
  isSplash = false
): void {
  const definition = unitDefinition(target.kind, ownedMutations)
  if (target.shield > 0) {
    target.shield -= 1
    target.flash = 0.18
    const position = pointOnRoute(route, target.progress)
    burst(position, '#fff1a6', 6, 0.05)
    labels.push({ x: position.x, y: position.y, text: '护盾抵消', color: '#ffe08a', life: 0.75 })
    return
  }
  const ignoresArmor = tower.kind === 'cannon' ? 0.55 : 0
  const armor = definition.armor * (1 - ignoresArmor)
  const repetitionPenalty = routeRepeated ? 1.6 : 1
  const splashMultiplier = isSplash ? 1.08 : 1
  target.hp -= damage * splashMultiplier * repetitionPenalty * (1 - armor)
  target.flash = 0.12
  if (tower.kind === 'frost') {
    target.slowUntil = Math.max(target.slowUntil, waveElapsed + 1.25 * repetitionPenalty)
  }
  if (target.hp > 0) return

  target.alive = false
  waveStats.destroyed += 1
  const position = pointOnRoute(route, target.progress)
  burst(position, definition.color, target.kind === 'tank' ? 14 : 8, 0.12)
  labels.push({ x: position.x, y: position.y, text: '已消灭', color: '#86918d', life: 0.8 })
  score += Math.round(target.progress * 110)
}

function attackWithTower(tower: RuntimeTower, target: RuntimeUnit): void {
  const definition = TOWER_DEFS[tower.kind]
  const targetPosition = pointOnRoute(route, target.progress)
  const damage = definition.damage * (tower.level === 2 ? 1.24 : 1)
  tower.cooldown = definition.fireRate
  tower.recoil = 0.12
  shots.push({
    from: { ...tower.position },
    to: targetPosition,
    life: tower.kind === 'cannon' ? 0.18 : 0.11,
    maxLife: tower.kind === 'cannon' ? 0.18 : 0.11,
    color: definition.color,
    width: tower.kind === 'cannon' ? 3 : 1.6
  })

  damageUnit(target, damage, tower)
  if (tower.kind === 'cannon') {
    for (const nearby of units) {
      if (!nearby.alive || nearby.id === target.id) continue
      const nearbyPosition = pointOnRoute(route, nearby.progress)
      if (
        Math.hypot(nearbyPosition.x - targetPosition.x, nearbyPosition.y - targetPosition.y) < 0.052
      ) {
        damageUnit(nearby, damage * 0.35, tower, true)
      }
    }
    burst(targetPosition, definition.color, 5, 0.05)
  }
}

function activateNode(node: RuntimeNode): void {
  if (node.activated) return
  node.activated = true
  waveStats.nodes += 1
  const definition = TACTICAL_NODE_DEFS[node.kind]
  const multiplier = modifiersFor(ownedMutations).nodeMultiplier

  if (node.kind === 'vitality') {
    for (const unit of units) {
      if (!unit.alive) continue
      unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * 0.3 * multiplier)
    }
  } else if (node.kind === 'haste') {
    globalBoostUntil = Math.max(globalBoostUntil, waveElapsed + 2.4 * multiplier)
  } else {
    jammedUntil = Math.max(jammedUntil, waveElapsed + 1.8 * multiplier)
  }

  score += 180
  burst(node.position, definition.color, 22, 0.15)
  labels.push({
    x: node.position.x,
    y: node.position.y - 0.035,
    text: `${definition.name}已触发`,
    color: definition.color,
    life: 1.25
  })
  showToast(`${definition.name} · 已吸收`, 'success')
  ui.announcer.textContent = `${definition.name}已触发。${definition.detail}`
  updateUI()
  sounds.play('breach')
}

function updateBattle(delta: number): void {
  waveElapsed += delta

  while (spawnIndex < spawnPlan.length && (spawnPlan[spawnIndex]?.at ?? Infinity) <= waveElapsed) {
    const entry = spawnPlan[spawnIndex]
    if (entry) spawnUnit(entry)
    spawnIndex += 1
  }

  const lengthScale = routeLength(route) / 1.1
  for (const unit of units) {
    if (!unit.alive) continue
    const definition = unitDefinition(unit.kind, ownedMutations)
    const slowed = unit.slowUntil > waveElapsed
    const boosted = globalBoostUntil > waveElapsed
    unit.progress +=
      (definition.speed * (slowed ? 0.55 : 1) * (boosted ? 1.52 : 1) * delta) / lengthScale
    unit.flash = Math.max(0, unit.flash - delta)

    if (unit.progress >= 1) {
      unit.alive = false
      if (waveStats.nodes === 0) {
        const destination = route.at(-1) ?? { x: 0.96, y: 0.5 }
        labels.push({
          x: destination.x - 0.04,
          y: destination.y - 0.035,
          text: '核心护盾阻挡',
          color: '#f3b66f',
          life: 1.2
        })
        continue
      }
      const breachDamage = coreDamageFor(definition.breach, waveStats.nodes)
      waveStats.breaches += 1
      waveStats.coreDamage += breachDamage
      core = Math.max(0, core - breachDamage)
      const destination = route.at(-1) ?? { x: 0.96, y: 0.5 }
      burst(destination, definition.color, 18, 0.16)
      labels.push({
        x: destination.x - 0.04,
        y: destination.y - 0.035,
        text: `核心 −${breachDamage}`,
        color: definition.color,
        life: 1.2
      })
      score += breachDamage * 650 + Math.max(0, waveStats.breaches - 1) * 80
      const stolen = modifiersFor(ownedMutations).breachCredit
      if (stolen > 0) {
        credits += stolen
        ui.credits.textContent = credits.toString()
      }
      showToast(
        waveStats.breaches > 1 ? `突破连锁 ×${waveStats.breaches}` : '核心已突破',
        'success'
      )
      sounds.play('breach')
    }
  }

  for (const node of nodes) {
    if (node.activated) continue
    const reached = units.some((unit) => {
      if (!unit.alive) return false
      const position = pointOnRoute(route, unit.progress)
      return Math.hypot(position.x - node.position.x, position.y - node.position.y) <= node.radius
    })
    if (reached) activateNode(node)
  }

  for (const tower of towers) {
    tower.cooldown -= delta
    tower.recoil = Math.max(0, tower.recoil - delta)
    if (waveElapsed < jammedUntil) continue
    if (tower.cooldown > 0) continue
    const candidates = units.filter((unit) => {
      if (!unit.alive) return false
      const position = pointOnRoute(route, unit.progress)
      return Math.hypot(position.x - tower.position.x, position.y - tower.position.y) <= tower.range
    })
    const target = candidates.sort((left, right) => {
      if (tower.kind === 'frost') {
        return (
          unitDefinition(right.kind, ownedMutations).speed -
            unitDefinition(left.kind, ownedMutations).speed || right.progress - left.progress
        )
      }
      if (tower.kind === 'cannon') {
        const crowd = (unit: RuntimeUnit) => {
          const position = pointOnRoute(route, unit.progress)
          return candidates.filter((other) => {
            const otherPosition = pointOnRoute(route, other.progress)
            return Math.hypot(position.x - otherPosition.x, position.y - otherPosition.y) < 0.055
          }).length
        }
        return crowd(right) - crowd(left) || right.progress - left.progress
      }
      return right.progress - left.progress
    })[0]
    if (target) attackWithTower(tower, target)
  }

  particles.forEach((particle) => {
    particle.x += particle.vx * delta
    particle.y += particle.vy * delta
    particle.vx *= 0.94
    particle.vy *= 0.94
    particle.life -= delta
  })
  particles = particles.filter((particle) => particle.life > 0)
  shots.forEach((shot) => (shot.life -= delta))
  shots = shots.filter((shot) => shot.life > 0)
  labels.forEach((label) => {
    label.y -= delta * 0.025
    label.life -= delta
  })
  labels = labels.filter((label) => label.life > 0)

  const lastSpawnAt = spawnPlan.at(-1)?.at ?? 0
  const alive = units.some((unit) => unit.alive)
  const progress = Math.min(1, waveElapsed / Math.max(lastSpawnAt + 11, 1))
  const bar = ui.waveProgress.firstElementChild as HTMLElement | null
  if (bar) bar.style.width = `${progress * 100}%`

  if (core <= 0) {
    finishGame(true)
  } else if (spawnIndex >= spawnPlan.length && !alive && waveElapsed > lastSpawnAt + 0.8) {
    finishWave()
  }
}

function finishWave(): void {
  phase = 'summary'
  const composition = compositionOf(queue)
  history = {
    ...composition,
    repeatedRoute: routeRepeated,
    breaches: waveStats.breaches
  }
  previousRoute = route.map((point) => ({ ...point }))
  const reward = 58 + round * 6 + waveStats.coreDamage * 3
  credits += reward

  if (round >= MAX_ROUNDS) {
    finishGame(false)
    return
  }

  byId('summary-index').textContent = `第 ${round} 回合`
  byId('summary-title').textContent = waveStats.breaches ? '突破完成' : '全部被拦截'
  byId('summary-copy').textContent = waveStats.breaches
    ? `核心受到 ${waveStats.coreDamage} 点伤害，${waveStats.destroyed} 个单位被消灭。`
    : '没有单位抵达核心。下一轮必须换路线或调整出兵顺序。'
  byId('stat-deployed').textContent = waveStats.deployed.toString()
  byId('stat-breaches').textContent = waveStats.breaches.toString()
  byId('stat-damage').textContent = waveStats.coreDamage.toString()
  byId('stat-reward').textContent = `+${reward}`
  lastEarnedMutation = mutationOffers(round, ownedMutations)[0] ?? null
  if (lastEarnedMutation) ownedMutations.push(lastEarnedMutation.id)
  ui.earnedUpgrade.hidden = !lastEarnedMutation
  byId('earned-upgrade-name').textContent = lastEarnedMutation?.name ?? '无'
  byId('earned-upgrade-copy').textContent = lastEarnedMutation?.detail ?? '没有新的进化。'
  ui.continueButton.disabled = false
  ui.continueButton.innerHTML = '下一回合 <span>→</span>'
  ui.summary.classList.add('open')
  ui.summary.setAttribute('aria-hidden', 'false')
  updateUI()
}

function finishGame(victory: boolean): void {
  phase = 'ended'
  const finalScore = Math.round(score + Math.max(0, MAX_ROUNDS - round) * 900 + core * -20)
  score = Math.max(0, finalScore)
  if (score > bestScore) {
    bestScore = score
    localStorage.setItem('breach-protocol-best', bestScore.toString())
  }
  byId('summary-index').textContent = victory ? '入侵完成' : '入侵终止'
  byId('summary-title').textContent = victory ? '核心已摧毁' : '突破失败'
  byId('summary-copy').textContent = victory
    ? `你在第 ${round} 回合完成突破。最终情报评分 ${formatScore(score)}。`
    : `四轮结束，核心还剩 ${core} 点。`
  byId('stat-deployed').textContent = waveStats.deployed.toString()
  byId('stat-breaches').textContent = waveStats.breaches.toString()
  byId('stat-damage').textContent = waveStats.coreDamage.toString()
  byId('stat-reward').textContent = formatScore(score)
  ui.earnedUpgrade.hidden = true
  lastEarnedMutation = null
  ui.continueButton.disabled = false
  ui.continueButton.innerHTML = '再次入侵 <span>↻</span>'
  ui.summary.classList.add('open')
  ui.summary.setAttribute('aria-hidden', 'false')
  ui.announcer.textContent = victory ? '任务完成，核心已摧毁。' : '任务失败，防线守住了核心。'
  showToast(victory ? '核心已离线' : '入侵已终止', victory ? 'success' : 'danger')
  updateUI()
  sounds.play(victory ? 'win' : 'hit')
}

function advanceRound(): void {
  if (phase === 'ended') {
    resetGame()
    ui.summary.classList.remove('open')
    ui.summary.setAttribute('aria-hidden', 'true')
    return
  }
  round += 1
  phase = 'planning'
  queue = []
  units = []
  particles = []
  shots = []
  labels = []
  spawnPlan = []
  spawnIndex = 0
  waveElapsed = 0
  waveStats = { deployed: 0, destroyed: 0, breaches: 0, coreDamage: 0, nodes: 0 }
  jammedUntil = 0
  globalBoostUntil = 0
  selectedWaypoint = 2
  defenseRoute = (previousRoute ?? route).map((point) => ({ ...point }))
  nodes = generateTacticalNodes(round).map((node) => ({ ...node, activated: false }))
  rebuildDefense()
  ui.summary.classList.remove('open')
  ui.summary.setAttribute('aria-hidden', 'true')
  showToast(`第 ${round} 回合 · 防线已重布`, 'neutral')
  ui.announcer.textContent = `第 ${round} 回合规划开始。请重新规划路线和出兵顺序。`
  updateUI()
}

function resetGame(): void {
  phase = 'planning'
  round = 1
  credits = STARTING_CREDITS
  core = MAX_CORE
  score = 0
  queue = []
  nextBatchId = 1
  route = DEFAULT_ROUTE.map((point) => ({ ...point }))
  defenseRoute = DEFAULT_ROUTE.map((point) => ({ ...point }))
  previousRoute = null
  history = undefined
  ownedMutations = []
  lastEarnedMutation = null
  routeRepeated = false
  jammedUntil = 0
  globalBoostUntil = 0
  nodes = generateTacticalNodes(round).map((node) => ({ ...node, activated: false }))
  units = []
  spawnPlan = []
  spawnIndex = 0
  waveElapsed = 0
  speed = 1
  particles = []
  shots = []
  labels = []
  ui.earnedUpgrade.hidden = false
  ui.continueButton.disabled = false
  rebuildDefense()
  updateUI()
}

function resizeCanvas(): void {
  const bounds = canvas.getBoundingClientRect()
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvasWidth = Math.max(1, bounds.width)
  canvasHeight = Math.max(1, bounds.height)
  const nextWidth = Math.round(canvasWidth * ratio)
  const nextHeight = Math.round(canvasHeight * ratio)
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
  }
}

const px = (point: Point): Point => ({ x: point.x * canvasWidth, y: point.y * canvasHeight })

function organicBlob(radius: number, seed: number, lobes = 9): void {
  const points = Array.from({ length: lobes }, (_, index) => {
    const angle = (index / lobes) * Math.PI * 2
    const wobble = 1 + Math.sin(seed * 1.73 + index * 2.19) * 0.12
    return {
      x: Math.cos(angle) * radius * wobble,
      y: Math.sin(angle) * radius * wobble
    }
  })
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return
  context.beginPath()
  context.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2)
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    if (!current || !next) continue
    context.quadraticCurveTo(
      current.x,
      current.y,
      (current.x + next.x) / 2,
      (current.y + next.y) / 2
    )
  }
  context.closePath()
}

function routePixelAt(progress: number): Point {
  const point = px(pointOnRoute(route, progress))
  const before = px(pointOnRoute(route, clamp(progress - 0.004, 0, 1)))
  const after = px(pointOnRoute(route, clamp(progress + 0.004, 0, 1)))
  const dx = after.x - before.x
  const dy = after.y - before.y
  const length = Math.max(1, Math.hypot(dx, dy))
  const wobble = Math.sin(progress * 47 + round * 0.7) * 2.2 + Math.sin(progress * 19) * 1.1
  return {
    x: point.x + (-dy / length) * wobble,
    y: point.y + (dx / length) * wobble
  }
}

function drawBackdrop(): void {
  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.fillStyle = '#10130d'
  context.fillRect(0, 0, canvasWidth, canvasHeight)

  context.save()
  context.globalAlpha = 0.48
  context.fillStyle = '#192015'
  context.beginPath()
  context.moveTo(0, canvasHeight * 0.09)
  context.bezierCurveTo(
    canvasWidth * 0.12,
    canvasHeight * 0.23,
    canvasWidth * 0.33,
    -canvasHeight * 0.03,
    canvasWidth * 0.51,
    canvasHeight * 0.11
  )
  context.bezierCurveTo(
    canvasWidth * 0.69,
    canvasHeight * 0.25,
    canvasWidth * 0.78,
    canvasHeight * 0.02,
    canvasWidth,
    canvasHeight * 0.18
  )
  context.lineTo(canvasWidth, 0)
  context.lineTo(0, 0)
  context.closePath()
  context.fill()

  context.fillStyle = '#171c13'
  context.beginPath()
  context.moveTo(0, canvasHeight * 0.81)
  context.bezierCurveTo(
    canvasWidth * 0.16,
    canvasHeight * 0.68,
    canvasWidth * 0.29,
    canvasHeight * 0.97,
    canvasWidth * 0.53,
    canvasHeight * 0.82
  )
  context.bezierCurveTo(
    canvasWidth * 0.72,
    canvasHeight * 0.7,
    canvasWidth * 0.84,
    canvasHeight * 0.98,
    canvasWidth,
    canvasHeight * 0.74
  )
  context.lineTo(canvasWidth, canvasHeight)
  context.lineTo(0, canvasHeight)
  context.closePath()
  context.fill()

  for (const tower of towers) {
    const center = px(tower.position)
    const radius = tower.range * Math.min(canvasWidth, canvasHeight)
    context.save()
    context.translate(center.x, center.y)
    context.rotate(tower.id * 0.37)
    organicBlob(radius, tower.id * 3.1, 11)
    context.fillStyle = tower.kind === 'cannon' ? '#351c17' : '#20281f'
    context.globalAlpha = tower.kind === 'cannon' ? 0.14 : 0.11
    context.fill()
    context.restore()
  }
  context.restore()
}

function traceRoute(): void {
  if (route.length < 2) return
  const first = routePixelAt(0)
  context.beginPath()
  context.moveTo(first.x, first.y)
  for (let index = 1; index <= 120; index += 1) {
    const current = routePixelAt(index / 120)
    context.lineTo(current.x, current.y)
  }
}

function drawRoute(): void {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  traceRoute()
  context.strokeStyle = '#070905'
  context.lineWidth = Math.max(32, canvasHeight * 0.065)
  context.stroke()
  traceRoute()
  context.strokeStyle = '#242b1e'
  context.lineWidth = Math.max(22, canvasHeight * 0.043)
  context.stroke()
  context.lineWidth = 3
  let previous = routePixelAt(0)
  for (let index = 1; index <= 120; index += 1) {
    const progress = index / 120
    const point = pointOnRoute(route, progress)
    const current = routePixelAt(progress)
    const exposed = towers.some(
      (tower) => Math.hypot(point.x - tower.position.x, point.y - tower.position.y) <= tower.range
    )
    context.strokeStyle = exposed ? '#b06159' : '#8d9879'
    context.beginPath()
    context.moveTo(previous.x, previous.y)
    context.lineTo(current.x, current.y)
    context.stroke()
    previous = current
  }
  for (const progress of [0.2, 0.4, 0.6, 0.8]) {
    const center = routePixelAt(progress)
    const ahead = routePixelAt(clamp(progress + 0.006, 0, 1))
    const angle = Math.atan2(ahead.y - center.y, ahead.x - center.x)
    context.save()
    context.translate(center.x, center.y)
    context.rotate(angle)
    context.fillStyle = '#68735a'
    context.beginPath()
    context.moveTo(6, 0)
    context.lineTo(-4, -5)
    context.lineTo(-1, 0)
    context.lineTo(-4, 5)
    context.closePath()
    context.fill()
    context.restore()
  }
  context.restore()
}

function drawPortal(position: Point, destination: boolean): void {
  const center = px(position)
  context.save()
  context.translate(center.x, center.y)
  const color = destination ? '#d4776e' : '#b7c795'
  context.rotate(destination ? 0.18 : -0.22)
  organicBlob(24, destination ? 17 : 11, 8)
  context.fillStyle = color
  context.fill()
  organicBlob(16, destination ? 19 : 13, 8)
  context.fillStyle = '#0c0f09'
  context.fill()
  context.fillStyle = color
  if (destination) {
    context.beginPath()
    context.moveTo(1, -9)
    context.lineTo(9, -1)
    context.lineTo(-1, 9)
    context.lineTo(-8, 1)
    context.closePath()
    context.fill()
  } else {
    context.beginPath()
    context.moveTo(10, -1)
    context.lineTo(-5, -9)
    context.lineTo(-1, 0)
    context.lineTo(-6, 9)
    context.closePath()
    context.fill()
  }
  context.restore()
}

function drawTacticalNode(node: RuntimeNode): void {
  const center = px(node.position)
  const radius = Math.min(canvasWidth, canvasHeight) * node.radius
  context.save()
  context.translate(center.x, center.y)
  context.rotate(node.id % 2 ? -0.24 : 0.19)
  context.globalAlpha = node.activated ? 0.28 : 0.92
  organicBlob(radius, node.id * 5.2, 10)
  context.fillStyle = 'rgba(151, 165, 126, .07)'
  context.fill()
  organicBlob(22, node.id * 7.1, 8)
  context.fillStyle = '#9bac7d'
  context.fill()
  organicBlob(15, node.id * 7.1 + 2, 8)
  context.fillStyle = '#0d0e0c'
  context.fill()
  context.fillStyle = '#aab88d'
  context.lineWidth = 3
  if (node.kind === 'vitality') {
    context.fillRect(-3, -10, 6, 20)
    context.fillRect(-10, -3, 20, 6)
  } else if (node.kind === 'haste') {
    context.beginPath()
    context.moveTo(-10, -9)
    context.lineTo(0, 0)
    context.lineTo(-10, 9)
    context.lineTo(-4, 9)
    context.lineTo(6, 0)
    context.lineTo(-4, -9)
    context.closePath()
    context.fill()
  } else {
    context.strokeStyle = '#aab88d'
    context.beginPath()
    context.moveTo(-8, -8)
    context.lineTo(8, 8)
    context.moveTo(8, -8)
    context.lineTo(-8, 8)
    context.stroke()
  }
  context.restore()
}

function drawTower(tower: RuntimeTower): void {
  const center = px(tower.position)
  const towerColor: Record<TowerKind, string> = {
    pulse: '#8d9680',
    frost: '#87939a',
    cannon: '#a58a78'
  }
  const color = towerColor[tower.kind]
  const radius = tower.kind === 'cannon' ? 17 : 15
  context.save()
  context.translate(center.x, center.y)
  context.rotate(tower.id * 0.51 - 0.3)
  if (phase === 'battle' && waveElapsed < jammedUntil) context.globalAlpha = 0.42
  organicBlob(radius + 5, tower.id * 2.7, tower.kind === 'cannon' ? 7 : 9)
  context.fillStyle = color
  context.fill()
  organicBlob(radius, tower.id * 3.3 + 1, tower.kind === 'cannon' ? 7 : 9)
  context.fillStyle = '#0c0f0a'
  context.fill()
  context.fillStyle = color
  if (tower.kind === 'pulse') {
    context.fillRect(-3, -9, 6, 18)
    context.fillRect(-9, -3, 18, 6)
  } else if (tower.kind === 'frost') {
    context.strokeStyle = color
    context.lineWidth = 2.5
    for (let index = 0; index < 3; index += 1) {
      context.rotate(Math.PI / 3)
      context.beginPath()
      context.moveTo(-8, 0)
      context.lineTo(8, 0)
      context.stroke()
    }
  } else {
    context.fillRect(-4, -8 - tower.recoil * 14, 8, 21)
  }
  if (tower.level === 2) {
    context.fillStyle = '#d8d2bd'
    for (const angle of [0.1, 2.2, 4.3]) {
      context.beginPath()
      context.arc(
        Math.cos(angle) * (radius + 8),
        Math.sin(angle) * (radius + 8),
        2.4,
        0,
        Math.PI * 2
      )
      context.fill()
    }
  }
  context.restore()
}

function drawUnit(unit: RuntimeUnit): void {
  if (!unit.alive) return
  const position = routePixelAt(unit.progress)
  const ahead = routePixelAt(clamp(unit.progress + 0.008, 0, 1))
  const angle = Math.atan2(ahead.y - position.y, ahead.x - position.x)
  const definition = unitDefinition(unit.kind, ownedMutations)
  const radius = Math.max(10, definition.radius * canvasWidth * 1.28)
  context.save()
  context.translate(position.x, position.y)
  context.rotate(angle)
  context.fillStyle = unit.flash > 0 ? '#ffffff' : definition.color
  context.strokeStyle = 'rgba(4, 8, 8, .75)'
  context.lineWidth = 1.5
  if (unit.shield > 0) {
    context.beginPath()
    context.arc(0, 0, radius + 4, 0, Math.PI * 2)
    context.strokeStyle = 'rgba(255, 232, 151, .86)'
    context.stroke()
    context.strokeStyle = 'rgba(4, 8, 8, .75)'
  }
  if (unit.kind === 'slime') {
    context.beginPath()
    context.moveTo(-radius, radius * 0.45)
    context.quadraticCurveTo(-radius * 0.75, -radius, 0, -radius * 0.86)
    context.quadraticCurveTo(radius * 0.82, -radius, radius, radius * 0.45)
    context.quadraticCurveTo(radius * 0.35, radius * 0.88, 0, radius * 0.55)
    context.quadraticCurveTo(-radius * 0.45, radius * 0.88, -radius, radius * 0.45)
    context.fill()
    context.stroke()
    context.fillStyle = '#10211b'
    context.beginPath()
    context.arc(radius * 0.2, -radius * 0.16, 1.5, 0, Math.PI * 2)
    context.arc(radius * 0.52, -radius * 0.12, 1.5, 0, Math.PI * 2)
    context.fill()
  } else if (unit.kind === 'swift') {
    context.beginPath()
    context.moveTo(radius, 0)
    context.lineTo(-radius * 0.75, -radius * 0.8)
    context.lineTo(-radius * 0.35, 0)
    context.lineTo(-radius * 0.75, radius * 0.8)
    context.closePath()
    context.fill()
    context.stroke()
  } else {
    organicBlob(radius, unit.id * 1.9, 7)
    context.fill()
    context.stroke()
    context.fillStyle = '#2b335a'
    context.rotate(-0.18)
    context.fillRect(-radius * 0.08, -radius * 0.92, radius * 1.06, radius * 0.3)
  }
  context.rotate(-angle)
  const barWidth = radius * 2.1
  context.fillStyle = 'rgba(0, 0, 0, .6)'
  context.fillRect(-barWidth / 2, -radius - 8, barWidth, 2.5)
  context.fillStyle = definition.color
  context.fillRect(-barWidth / 2, -radius - 8, barWidth * clamp(unit.hp / unit.maxHp, 0, 1), 2.5)
  context.restore()
}

function drawWaypoints(): void {
  if (phase !== 'planning') return
  route.slice(1, -1).forEach((position, sliceIndex) => {
    const index = sliceIndex + 1
    const center = px(position)
    const selected = index === selectedWaypoint
    context.save()
    context.translate(center.x, center.y)
    context.rotate(index * 0.73)
    const size = selected ? 18 : 15
    organicBlob(size + (selected ? 5 : 3), index * 4.3 + round, 8)
    context.fillStyle = selected ? '#eef0e7' : '#747e66'
    context.fill()
    organicBlob(size, index * 5.1 + round, 8)
    context.fillStyle = selected ? '#b7c795' : '#1b1e18'
    context.fill()
    context.fillStyle = selected ? '#10120e' : '#aab88d'
    organicBlob(4.5, index * 2.3, 6)
    context.fill()
    context.restore()
  })
}

function drawEffects(): void {
  for (const shot of shots) {
    const from = px(shot.from)
    const to = px(shot.to)
    context.save()
    context.globalAlpha = clamp(shot.life / shot.maxLife, 0, 1)
    context.strokeStyle = shot.color
    context.lineWidth = shot.width
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
    context.restore()
  }
  for (const particle of particles) {
    const position = px(particle)
    context.save()
    context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1)
    context.fillStyle = particle.color
    context.beginPath()
    context.arc(position.x, position.y, particle.size, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }
  for (const label of labels) {
    const position = px(label)
    context.save()
    context.globalAlpha = clamp(label.life / 0.8, 0, 1)
    context.fillStyle = label.color
    context.font = '600 9px ui-sans-serif, sans-serif'
    context.textAlign = 'center'
    context.fillText(label.text, position.x, position.y)
    context.restore()
  }
}

function render(): void {
  resizeCanvas()
  drawBackdrop()
  drawRoute()
  nodes.forEach(drawTacticalNode)
  const start = route[0]
  const destination = route.at(-1)
  if (start) drawPortal(start, false)
  if (destination) drawPortal(destination, true)
  towers.forEach(drawTower)
  units.forEach(drawUnit)
  drawEffects()
  drawWaypoints()
}

function frame(timestamp: number): void {
  const rawDelta = Math.min((timestamp - lastTimestamp) / 1000, 0.05)
  lastTimestamp = timestamp
  if (phase === 'battle') updateBattle(rawDelta * speed)
  if (toastTimer > 0) {
    toastTimer -= rawDelta
    if (toastTimer <= 0) ui.combatToast.classList.remove('visible')
  }
  render()
  requestAnimationFrame(frame)
}

function pointFromPointer(event: PointerEvent): Point {
  const bounds = canvas.getBoundingClientRect()
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
    y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
  }
}

function nearestWaypoint(pointer: Point): number | null {
  let nearest: number | null = null
  let distance = 0.07
  route.slice(1, -1).forEach((point, sliceIndex) => {
    const current = Math.hypot(
      (point.x - pointer.x) * (canvasWidth / canvasHeight),
      point.y - pointer.y
    )
    if (current < distance) {
      nearest = sliceIndex + 1
      distance = current
    }
  })
  return nearest
}

function moveWaypoint(index: number, pointer: Point): void {
  const waypoint = route[index]
  if (!waypoint) return
  const xBounds: Record<number, [number, number]> = {
    1: [0.16, 0.34],
    2: [0.41, 0.59],
    3: [0.66, 0.84]
  }
  const [minX, maxX] = xBounds[index] ?? [waypoint.x, waypoint.x]
  waypoint.x = clamp(pointer.x, minX, maxX)
  waypoint.y = clamp(pointer.y, 0.13, 0.87)
  rebuildDefense()
  updateUI()
}

canvas.addEventListener('pointerdown', (event) => {
  if (phase !== 'planning') return
  const index = nearestWaypoint(pointFromPointer(event))
  if (index === null) return
  draggedWaypoint = index
  selectedWaypoint = index
  canvas.setPointerCapture(event.pointerId)
  moveWaypoint(index, pointFromPointer(event))
  sounds.play('click')
})

canvas.addEventListener('pointermove', (event) => {
  if (draggedWaypoint !== null) moveWaypoint(draggedWaypoint, pointFromPointer(event))
})

canvas.addEventListener('pointerup', (event) => {
  if (draggedWaypoint === null) return
  draggedWaypoint = null
  canvas.releasePointerCapture(event.pointerId)
})

canvas.addEventListener('pointercancel', () => {
  draggedWaypoint = null
})

canvas.addEventListener('keydown', (event) => {
  if (
    phase !== 'planning' ||
    !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
  )
    return
  event.preventDefault()
  const point = route[selectedWaypoint]
  if (!point) return
  const amount = event.shiftKey ? 0.04 : 0.015
  const next = { ...point }
  if (event.key === 'ArrowUp') next.y -= amount
  if (event.key === 'ArrowDown') next.y += amount
  if (event.key === 'ArrowLeft') next.x -= amount
  if (event.key === 'ArrowRight') next.x += amount
  moveWaypoint(selectedWaypoint, next)
})

ui.market.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-unit]')
  if (button?.dataset.unit) addBatch(button.dataset.unit as UnitKind)
})

ui.queue.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-batch]')
  const id = Number(button?.dataset.removeBatch)
  if (Number.isFinite(id)) removeBatch(id)
})

ui.launch.addEventListener('click', launchWave)
ui.continueButton.addEventListener('click', advanceRound)

byId<HTMLButtonElement>('reset-button').addEventListener('click', () => {
  resetGame()
  ui.summary.classList.remove('open')
  ui.summary.setAttribute('aria-hidden', 'true')
  showToast('入侵已重置', 'neutral')
  sounds.play('click')
})

ui.speed.addEventListener('click', () => {
  speed = speed === 1 ? 2 : 1
  ui.speed.textContent = `${speed}×`
  showToast(`战斗速度 ${speed}×`)
  sounds.play('click')
})

ui.sound.addEventListener('click', () => {
  soundEnabled = !soundEnabled
  ui.sound.setAttribute('aria-pressed', soundEnabled.toString())
  ui.sound.setAttribute('aria-label', soundEnabled ? '关闭音效' : '开启音效')
  ui.sound.classList.toggle('muted', !soundEnabled)
  if (soundEnabled) sounds.play('click')
})

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && phase === 'planning') {
    event.preventDefault()
    launchWave()
  }
})

window.addEventListener('resize', resizeCanvas)

rebuildDefense()
updateUI()
resizeCanvas()
requestAnimationFrame(frame)
