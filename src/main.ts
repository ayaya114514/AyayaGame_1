import './style.css'
import {
  DEFAULT_ROUTE,
  TOWER_DEFS,
  UNIT_DEFS,
  analyzeArmy,
  buildSpawnPlan,
  clamp,
  compositionOf,
  generateTowerBlueprints,
  pointOnRoute,
  routeLength,
  routeSignature,
  type AIAnalysis,
  type AIHistory,
  type ArmyBatch,
  type Formation,
  type Point,
  type SpawnEntry,
  type TowerBlueprint,
  type TowerKind,
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
  flash: number
  alive: boolean
}

type RuntimeTower = TowerBlueprint & {
  cooldown: number
  recoil: number
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
}

const MAX_ROUNDS = 5
const MAX_CORE = 30
const app = document.querySelector<HTMLDivElement>('#app')

if (!app) throw new Error('App root is missing')

app.innerHTML = `
  <div class="app-shell">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <header class="topbar">
      <a class="brand" href="." aria-label="Breach Protocol 首页">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="brand-copy">
          <strong>BREACH <i>//</i> PROTOCOL</strong>
          <small>AYAYA LABS · 反向塔防</small>
        </span>
      </a>
      <div class="mission-readout" aria-label="战局状态">
        <div><span>STAGE</span><strong id="round-value">01 / 05</strong></div>
        <div><span>AI CORE</span><strong id="core-value">30</strong></div>
        <div><span>DATA</span><strong id="credit-value">240</strong></div>
      </div>
      <div class="top-actions">
        <button class="icon-button" id="sound-button" type="button" aria-label="关闭音效" aria-pressed="true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9H5Zm12.5 1a3.5 3.5 0 0 1 0 4M19.7 7a7 7 0 0 1 0 10"/></svg>
        </button>
        <button class="text-button" id="reset-button" type="button">重新入侵</button>
      </div>
    </header>

    <main class="command-grid">
      <aside class="panel route-panel">
        <div class="panel-heading">
          <div><span class="eyebrow">01 / INFILTRATION</span><h2>路线工坊</h2></div>
          <span class="live-dot"><i></i> 可编辑</span>
        </div>
        <p class="panel-intro">拖拽战场上的三个路标绕开射界。过度绕行会给防御塔更多输出时间。</p>
        <div class="preset-list" aria-label="路线预设">
          <button type="button" data-route="direct"><span class="route-glyph direct"></span><span><strong>中路强攻</strong><small>最短 · 高风险</small></span></button>
          <button type="button" data-route="arc"><span class="route-glyph arc"></span><span><strong>上路诱导</strong><small>绕开核心火力</small></span></button>
          <button class="active" type="button" data-route="zigzag"><span class="route-glyph zigzag"></span><span><strong>蛇形牵制</strong><small>分散塔位</small></span></button>
        </div>
        <div class="route-metrics">
          <div><span>路线长度</span><strong id="route-length">1.51 km</strong></div>
          <div><span>预计威胁</span><strong id="route-risk" class="risk-medium">中等</strong></div>
        </div>
        <div class="intel-card">
          <div class="intel-topline"><span>AI COUNTERMEASURE</span><span id="ai-confidence">71%</span></div>
          <div class="intel-title"><span id="ai-icon" class="intel-icon"></span><strong id="ai-name">均衡戒备</strong></div>
          <p id="ai-detail">威胁样本不足，AI 采用脉冲塔为主的通用防线。</p>
          <div class="tower-mix" id="tower-mix" aria-label="AI 防御塔配比"></div>
        </div>
        <p class="micro-note"><span>TIP</span> 连续使用相同路线，AI 会记住你的突破点。</p>
      </aside>

      <section class="battlefield-card" aria-label="战场">
        <div class="battlefield-toolbar">
          <div class="phase-pill"><i></i><span id="phase-label">PLANNING</span></div>
          <div class="battlefield-title"><span>SECTOR</span><strong>NULL GARDEN · 07</strong></div>
          <button class="speed-button" id="speed-button" type="button" aria-label="切换战斗速度" disabled>1×</button>
        </div>
        <div class="canvas-wrap">
          <canvas id="battlefield" tabindex="0" aria-label="路线战场。规划阶段可拖拽三个绿色路标，方向键可微调选中的路标。"></canvas>
          <div class="canvas-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div class="map-hint" id="map-hint"><span></span> DRAG NODES TO REROUTE</div>
          <div class="wave-progress" id="wave-progress" hidden><i></i></div>
          <div class="combat-toast" id="combat-toast" role="status" aria-live="polite"></div>
        </div>
        <div class="battlefield-footer">
          <div><span class="legend-dot friendly"></span>侵入单位</div>
          <div><span class="legend-dot hostile"></span>AI 防御塔</div>
          <span class="footer-coordinate">47°13′N · SIMULATION LOCAL</span>
        </div>
      </section>

      <aside class="panel army-panel">
        <div class="panel-heading">
          <div><span class="eyebrow">02 / LOADOUT</span><h2>入侵编队</h2></div>
          <span class="budget"><i></i><strong id="budget-value">240</strong></span>
        </div>
        <div class="unit-market" id="unit-market">
          <button class="unit-card" type="button" data-unit="slime">
            <span class="unit-portrait slime"><i></i></span>
            <span class="unit-copy"><strong>史莱姆群 <em>×3</em></strong><small>数量压制 · HP 46</small></span>
            <span class="unit-cost">30</span>
          </button>
          <button class="unit-card" type="button" data-unit="swift">
            <span class="unit-portrait swift"><i></i></span>
            <span class="unit-copy"><strong>疾行兽 <em>×2</em></strong><small>高速突进 · SPD 142</small></span>
            <span class="unit-cost">42</span>
          </button>
          <button class="unit-card" type="button" data-unit="tank">
            <span class="unit-portrait tank"><i></i></span>
            <span class="unit-copy"><strong>铁甲兽 <em>×1</em></strong><small>吸收火力 · ARM 28</small></span>
            <span class="unit-cost">60</span>
          </button>
        </div>

        <div class="queue-heading"><span>出兵序列</span><small>点击批次可撤回</small></div>
        <div class="queue-track" id="queue-track" aria-label="出兵序列"></div>

        <div class="formation-block">
          <div class="queue-heading"><span>批次间隔</span><small id="formation-copy">平衡火力与节奏</small></div>
          <div class="segmented" role="group" aria-label="出兵节奏">
            <button type="button" data-formation="rush">紧密</button>
            <button class="active" type="button" data-formation="steady">标准</button>
            <button type="button" data-formation="split">分批</button>
          </div>
        </div>

        <div class="launch-zone">
          <div class="readiness"><span><i id="ready-light"></i><strong id="ready-title">等待编队</strong></span><small id="ready-copy">至少购买一个单位批次</small></div>
          <button class="launch-button" id="launch-button" type="button" disabled>
            <span>执行入侵</span><small>EXECUTE BREACH</small><i aria-hidden="true">↗</i>
          </button>
          <p><kbd>SPACE</kbd> 快速执行</p>
        </div>
      </aside>
    </main>

    <footer class="statusbar">
      <span><i></i> SIMULATION READY</span>
      <span>NO ACCOUNT · NO UPLOAD · LOCAL SAVE</span>
      <span id="high-score">BEST 000000</span>
    </footer>
  </div>

  <div class="modal-backdrop open" id="intro-modal" role="dialog" aria-modal="true" aria-labelledby="intro-title">
    <section class="modal intro-modal">
      <div class="modal-scanline"></div>
      <span class="modal-index">MISSION // 001</span>
      <div class="intro-emblem" aria-hidden="true"><span></span><i></i></div>
      <h1 id="intro-title">这次，你是怪物。</h1>
      <p>防线由自适应 AI 控制。改变路线、混编单位、错开波次，在五回合内摧毁它的核心。</p>
      <div class="briefing-grid">
        <div><b>01</b><span><strong>设计路线</strong><small>拖动三个绿色路标</small></span></div>
        <div><b>02</b><span><strong>编排军团</strong><small>购买并组合三个兵种</small></span></div>
        <div><b>03</b><span><strong>骗过 AI</strong><small>每回合改变你的打法</small></span></div>
      </div>
      <button class="primary-modal-button" id="enter-button" type="button">进入战场 <span>→</span></button>
      <small class="modal-footnote">建议开启音效 · 每局约 4 分钟</small>
    </section>
  </div>

  <div class="modal-backdrop" id="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title" aria-hidden="true">
    <section class="modal summary-modal">
      <span class="modal-index" id="summary-index">WAVE REPORT // 01</span>
      <div class="report-icon" id="report-icon"><span></span></div>
      <h2 id="summary-title">防线正在重构</h2>
      <p id="summary-copy">AI 已记录你的打法，下一回合会调整塔组。</p>
      <div class="report-stats">
        <div><span>部署</span><strong id="stat-deployed">0</strong></div>
        <div><span>突破</span><strong id="stat-breaches">0</strong></div>
        <div><span>核心伤害</span><strong id="stat-damage">0</strong></div>
        <div><span>情报奖励</span><strong id="stat-reward">+0</strong></div>
      </div>
      <div class="adaptation-note"><span>AI ADAPTATION</span><strong id="next-ai-name">截流协议</strong><p id="next-ai-copy">正在分析下一轮防守策略。</p></div>
      <button class="primary-modal-button" id="continue-button" type="button">准备下一回合 <span>→</span></button>
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
  budget: byId('budget-value'),
  routeLength: byId('route-length'),
  routeRisk: byId('route-risk'),
  aiConfidence: byId('ai-confidence'),
  aiName: byId('ai-name'),
  aiDetail: byId('ai-detail'),
  aiIcon: byId('ai-icon'),
  towerMix: byId('tower-mix'),
  queue: byId('queue-track'),
  market: byId('unit-market'),
  formationCopy: byId('formation-copy'),
  readyLight: byId('ready-light'),
  readyTitle: byId('ready-title'),
  readyCopy: byId('ready-copy'),
  launch: byId<HTMLButtonElement>('launch-button'),
  phase: byId('phase-label'),
  mapHint: byId('map-hint'),
  speed: byId<HTMLButtonElement>('speed-button'),
  waveProgress: byId('wave-progress'),
  combatToast: byId('combat-toast'),
  intro: byId('intro-modal'),
  summary: byId('summary-modal'),
  continueButton: byId<HTMLButtonElement>('continue-button'),
  highScore: byId('high-score'),
  announcer: byId('announcer'),
  sound: byId<HTMLButtonElement>('sound-button')
}

let phase: Phase = 'planning'
let round = 1
let credits = 240
let core = MAX_CORE
let score = 0
let bestScore = Number.parseInt(localStorage.getItem('breach-protocol-best') ?? '0', 10) || 0
let queue: ArmyBatch[] = []
let nextBatchId = 1
let formation: Formation = 'steady'
let route = DEFAULT_ROUTE.map((point) => ({ ...point }))
let defenseRoute = DEFAULT_ROUTE.map((point) => ({ ...point }))
let lastRouteSignature = ''
let history: AIHistory | undefined
let analysis: AIAnalysis = analyzeArmy(queue)
let towers: RuntimeTower[] = []
let units: RuntimeUnit[] = []
let spawnPlan: SpawnEntry[] = []
let spawnIndex = 0
let nextUnitId = 1
let waveElapsed = 0
let speed = 1
let selectedWaypoint = 2
let draggedWaypoint: number | null = null
let particles: Particle[] = []
let shots: Shot[] = []
let labels: FloatLabel[] = []
let waveStats: WaveStats = { deployed: 0, destroyed: 0, breaches: 0, coreDamage: 0 }
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

function currentConfidence(): number {
  const repeatBonus = history?.repeatedRoute ? 12 : 0
  return clamp(62 + round * 5 + repeatBonus, 0, 97)
}

function rebuildDefense(): void {
  analysis = analyzeArmy(queue, history)
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
  const length = routeLength(route)
  const exposureSamples = Array.from({ length: 60 }, (_, index) => pointOnRoute(route, index / 59))
  const exposure =
    exposureSamples.filter((point) =>
      towers.some(
        (tower) =>
          Math.hypot(point.x - tower.position.x, point.y - tower.position.y) < tower.range * 0.84
      )
    ).length / exposureSamples.length
  const risk =
    exposure > 0.58 ? '极高' : exposure > 0.42 ? '较高' : exposure > 0.25 ? '中等' : '较低'
  const riskClass = exposure > 0.42 ? 'risk-high' : exposure > 0.25 ? 'risk-medium' : 'risk-low'

  ui.round.textContent = `${round.toString().padStart(2, '0')} / ${MAX_ROUNDS.toString().padStart(2, '0')}`
  ui.core.textContent = core.toString().padStart(2, '0')
  ui.credits.textContent = credits.toString()
  ui.budget.textContent = credits.toString()
  ui.routeLength.textContent = `${length.toFixed(2)} km`
  ui.routeRisk.textContent = risk
  ui.routeRisk.className = riskClass
  ui.aiConfidence.textContent = `${currentConfidence()}%`
  ui.aiName.textContent = analysis.name
  ui.aiDetail.textContent = analysis.detail
  ui.aiIcon.style.setProperty('--intel-accent', analysis.accent)
  ui.towerMix.innerHTML = (['pulse', 'frost', 'cannon'] as TowerKind[])
    .map((kind) => {
      const percentage = Math.round(analysis.mix[kind] * 100)
      return `<div><span><i style="--tower:${TOWER_DEFS[kind].color}"></i>${TOWER_DEFS[kind].name}</span><b>${percentage}%</b></div>`
    })
    .join('')

  ui.queue.innerHTML = queue.length
    ? queue
        .map(
          (
            batch,
            index
          ) => `<button type="button" class="queue-token ${batch.kind}" data-remove-batch="${batch.id}" aria-label="撤回第 ${index + 1} 批 ${UNIT_DEFS[batch.kind].name}">
              <span>${(index + 1).toString().padStart(2, '0')}</span><i></i><strong>${UNIT_DEFS[batch.kind].count}</strong>
            </button>`
        )
        .join('')
    : '<div class="queue-empty"><span>＋</span><p>从上方购买单位<br><small>批次将按顺序部署</small></p></div>'

  ui.market.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((button) => {
    const kind = button.dataset.unit as UnitKind
    button.disabled = !isPlanning || credits < UNIT_DEFS[kind].cost || queue.length >= 9
  })

  document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => {
    button.disabled = !isPlanning
  })
  document.querySelectorAll<HTMLButtonElement>('[data-formation]').forEach((button) => {
    button.disabled = !isPlanning
  })

  const totalUnits = queue.reduce((sum, batch) => sum + UNIT_DEFS[batch.kind].count, 0)
  ui.launch.disabled = !isPlanning || queue.length === 0
  ui.readyLight.classList.toggle('ready', queue.length > 0 && isPlanning)
  ui.readyTitle.textContent = queue.length ? `${totalUnits} 个单位就绪` : '等待编队'
  ui.readyCopy.textContent = queue.length
    ? `${queue.length} 个批次 · AI 已更新防线`
    : '至少购买一个单位批次'
  ui.phase.textContent =
    phase === 'battle' ? 'BREACHING' : phase === 'planning' ? 'PLANNING' : 'ANALYSIS'
  ui.mapHint.classList.toggle('hidden', !isPlanning)
  ui.speed.disabled = phase !== 'battle'
  ui.waveProgress.toggleAttribute('hidden', phase !== 'battle')
  ui.highScore.textContent = `BEST ${formatScore(bestScore)}`
}

function showToast(message: string, tone: 'neutral' | 'success' | 'danger' = 'neutral'): void {
  ui.combatToast.textContent = message
  ui.combatToast.className = `combat-toast visible ${tone}`
  toastTimer = 1.8
}

function setRoutePreset(name: string): void {
  if (phase !== 'planning') return
  const presets: Record<string, number[]> = {
    direct: [0.5, 0.5, 0.5],
    arc: [0.22, 0.18, 0.38],
    zigzag: [0.27, 0.69, 0.32]
  }
  const values = presets[name]
  if (!values) return
  values.forEach((value, index) => {
    const point = route[index + 1]
    if (point) point.y = value
  })
  document.querySelectorAll('[data-route]').forEach((button) => {
    button.classList.toggle('active', (button as HTMLElement).dataset.route === name)
  })
  selectedWaypoint = 2
  rebuildDefense()
  updateUI()
  sounds.play('click')
}

function addBatch(kind: UnitKind): void {
  if (phase !== 'planning' || credits < UNIT_DEFS[kind].cost || queue.length >= 9) return
  credits -= UNIT_DEFS[kind].cost
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
  credits += UNIT_DEFS[batch.kind].cost
  queue = queue.filter((item) => item.id !== id)
  rebuildDefense()
  updateUI()
  sounds.play('click')
}

function setFormation(nextFormation: Formation): void {
  if (phase !== 'planning') return
  formation = nextFormation
  const copy: Record<Formation, string> = {
    rush: '集中冲锋，易受范围伤害',
    steady: '平衡火力与节奏',
    split: '拉开波次，试探塔的冷却'
  }
  ui.formationCopy.textContent = copy[formation]
  document.querySelectorAll('[data-formation]').forEach((button) => {
    button.classList.toggle('active', (button as HTMLElement).dataset.formation === formation)
  })
  sounds.play('click')
}

function launchWave(): void {
  if (phase !== 'planning' || queue.length === 0) return
  phase = 'battle'
  spawnPlan = buildSpawnPlan(queue, formation)
  spawnIndex = 0
  waveElapsed = 0
  waveStats = { deployed: spawnPlan.length, destroyed: 0, breaches: 0, coreDamage: 0 }
  units = []
  particles = []
  shots = []
  labels = []
  speed = 1
  ui.speed.textContent = '1×'
  towers.forEach((tower) => {
    tower.cooldown = Math.random() * 0.35
  })
  showToast(`WAVE ${round.toString().padStart(2, '0')} · 入侵开始`, 'neutral')
  ui.announcer.textContent = `第 ${round} 回合入侵开始，共 ${spawnPlan.length} 个单位。`
  updateUI()
  sounds.play('launch')
}

function spawnUnit(entry: SpawnEntry): void {
  const definition = UNIT_DEFS[entry.kind]
  units.push({
    id: nextUnitId,
    kind: entry.kind,
    progress: 0,
    hp: definition.hp,
    maxHp: definition.hp,
    slowUntil: 0,
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

function damageUnit(target: RuntimeUnit, damage: number, tower: RuntimeTower): void {
  const definition = UNIT_DEFS[target.kind]
  const ignoresArmor = tower.kind === 'cannon' ? 0.55 : 0
  const armor = definition.armor * (1 - ignoresArmor)
  target.hp -= damage * (1 - armor)
  target.flash = 0.12
  if (tower.kind === 'frost') target.slowUntil = Math.max(target.slowUntil, waveElapsed + 1.25)
  if (target.hp > 0) return

  target.alive = false
  waveStats.destroyed += 1
  const position = pointOnRoute(route, target.progress)
  burst(position, definition.color, target.kind === 'tank' ? 14 : 8, 0.12)
  labels.push({ x: position.x, y: position.y, text: 'SIGNAL LOST', color: '#86918d', life: 0.8 })
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
        damageUnit(nearby, damage * 0.35, tower)
      }
    }
    burst(targetPosition, definition.color, 5, 0.05)
  }
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
    const definition = UNIT_DEFS[unit.kind]
    const slowed = unit.slowUntil > waveElapsed
    unit.progress += (definition.speed * (slowed ? 0.55 : 1) * delta) / lengthScale
    unit.flash = Math.max(0, unit.flash - delta)

    if (unit.progress >= 1) {
      unit.alive = false
      waveStats.breaches += 1
      waveStats.coreDamage += definition.breach
      core = Math.max(0, core - definition.breach)
      const destination = route.at(-1) ?? { x: 0.96, y: 0.5 }
      burst(destination, definition.color, 18, 0.16)
      labels.push({
        x: destination.x - 0.04,
        y: destination.y - 0.035,
        text: `CORE −${definition.breach}`,
        color: definition.color,
        life: 1.2
      })
      score += definition.breach * 650 + Math.max(0, waveStats.breaches - 1) * 80
      showToast(
        waveStats.breaches > 1 ? `突破连锁 ×${waveStats.breaches}` : '核心已突破',
        'success'
      )
      sounds.play('breach')
    }
  }

  for (const tower of towers) {
    tower.cooldown -= delta
    tower.recoil = Math.max(0, tower.recoil - delta)
    if (tower.cooldown > 0) continue
    const target = units
      .filter((unit) => {
        if (!unit.alive) return false
        const position = pointOnRoute(route, unit.progress)
        return (
          Math.hypot(position.x - tower.position.x, position.y - tower.position.y) <= tower.range
        )
      })
      .sort((a, b) => b.progress - a.progress)[0]
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
  const signature = routeSignature(route)
  history = {
    ...composition,
    repeatedRoute: signature === lastRouteSignature,
    breaches: waveStats.breaches
  }
  lastRouteSignature = signature
  const reward = 118 + round * 12 + waveStats.coreDamage * 5
  credits += reward

  if (round >= MAX_ROUNDS) {
    finishGame(false)
    return
  }

  const nextAnalysis = analyzeArmy(queue, history)
  byId('summary-index').textContent = `WAVE REPORT // ${round.toString().padStart(2, '0')}`
  byId('summary-title').textContent = waveStats.breaches ? '防线正在重构' : '入侵信号已中断'
  byId('summary-copy').textContent = waveStats.breaches
    ? `你对核心造成了 ${waveStats.coreDamage} 点伤害。AI 已锁定本轮编队特征。`
    : '没有单位抵达核心。调整路线或用铁甲兽吸收第一轮火力。'
  byId('stat-deployed').textContent = waveStats.deployed.toString()
  byId('stat-breaches').textContent = waveStats.breaches.toString()
  byId('stat-damage').textContent = waveStats.coreDamage.toString()
  byId('stat-reward').textContent = `+${reward}`
  byId('next-ai-name').textContent = nextAnalysis.name
  byId('next-ai-copy').textContent = nextAnalysis.detail
  ui.continueButton.innerHTML = '准备下一回合 <span>→</span>'
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
  byId('summary-index').textContent = victory ? 'MISSION COMPLETE' : 'MISSION TERMINATED'
  byId('summary-title').textContent = victory ? '核心已被吞噬' : 'AI 守住了最后防线'
  byId('summary-copy').textContent = victory
    ? `你在第 ${round} 回合完成突破。最终情报评分 ${formatScore(score)}。`
    : `核心还剩 ${core} 点完整度。AI 已封存这次入侵样本。`
  byId('stat-deployed').textContent = waveStats.deployed.toString()
  byId('stat-breaches').textContent = waveStats.breaches.toString()
  byId('stat-damage').textContent = waveStats.coreDamage.toString()
  byId('stat-reward').textContent = formatScore(score)
  byId('next-ai-name').textContent = victory ? '样本已污染' : '防线保持在线'
  byId('next-ai-copy').textContent = victory
    ? 'AI 无法为未知路线建立稳定模型。'
    : '尝试混入高速单位，并改变连续两回合的路线。'
  ui.continueButton.innerHTML = '再次入侵 <span>↻</span>'
  ui.summary.classList.add('open')
  ui.summary.setAttribute('aria-hidden', 'false')
  ui.announcer.textContent = victory ? '任务完成，AI 核心已摧毁。' : '任务失败，AI 守住了核心。'
  showToast(victory ? 'CORE OFFLINE' : 'CONNECTION TERMINATED', victory ? 'success' : 'danger')
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
  selectedWaypoint = 2
  defenseRoute = route.map((point) => ({ ...point }))
  rebuildDefense()
  ui.summary.classList.remove('open')
  ui.summary.setAttribute('aria-hidden', 'true')
  showToast(`STAGE ${round.toString().padStart(2, '0')} · ${analysis.name}`, 'neutral')
  updateUI()
}

function resetGame(): void {
  phase = 'planning'
  round = 1
  credits = 240
  core = MAX_CORE
  score = 0
  queue = []
  nextBatchId = 1
  formation = 'steady'
  route = DEFAULT_ROUTE.map((point) => ({ ...point }))
  defenseRoute = DEFAULT_ROUTE.map((point) => ({ ...point }))
  lastRouteSignature = ''
  history = undefined
  units = []
  spawnPlan = []
  spawnIndex = 0
  waveElapsed = 0
  speed = 1
  particles = []
  shots = []
  labels = []
  document.querySelectorAll('[data-route]').forEach((button) => {
    button.classList.toggle('active', (button as HTMLElement).dataset.route === 'zigzag')
  })
  document.querySelectorAll('[data-formation]').forEach((button) => {
    button.classList.toggle('active', (button as HTMLElement).dataset.formation === 'steady')
  })
  ui.formationCopy.textContent = '平衡火力与节奏'
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

function roundedRect(
  drawing: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  drawing.beginPath()
  drawing.roundRect(x, y, width, height, radius)
}

function drawBackdrop(time: number): void {
  context.clearRect(0, 0, canvasWidth, canvasHeight)
  const gradient = context.createLinearGradient(0, 0, canvasWidth, canvasHeight)
  gradient.addColorStop(0, '#101619')
  gradient.addColorStop(0.55, '#0b1012')
  gradient.addColorStop(1, '#080b0d')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvasWidth, canvasHeight)

  const gridSize = Math.max(34, canvasWidth / 15)
  context.strokeStyle = 'rgba(156, 255, 208, 0.045)'
  context.lineWidth = 1
  context.beginPath()
  for (let x = (time * 0.003) % gridSize; x < canvasWidth; x += gridSize) {
    context.moveTo(x, 0)
    context.lineTo(x, canvasHeight)
  }
  for (let y = 0; y < canvasHeight; y += gridSize) {
    context.moveTo(0, y)
    context.lineTo(canvasWidth, y)
  }
  context.stroke()

  context.fillStyle = 'rgba(151, 210, 184, 0.055)'
  const zones = [
    [0.12, 0.17, 0.12, 0.08],
    [0.4, 0.78, 0.15, 0.06],
    [0.69, 0.12, 0.1, 0.08],
    [0.82, 0.7, 0.11, 0.1]
  ]
  zones.forEach(([x = 0, y = 0, width = 0, height = 0]) => {
    roundedRect(
      context,
      x * canvasWidth,
      y * canvasHeight,
      width * canvasWidth,
      height * canvasHeight,
      8
    )
    context.fill()
  })
}

function traceRoute(): void {
  if (route.length < 2) return
  const points = route.map(px)
  const first = points[0]
  if (!first) return
  context.beginPath()
  context.moveTo(first.x, first.y)
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index]
    if (!current) continue
    context.lineTo(current.x, current.y)
  }
}

function drawRoute(time: number): void {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  traceRoute()
  context.strokeStyle = 'rgba(2, 5, 6, 0.82)'
  context.lineWidth = Math.max(30, canvasHeight * 0.085)
  context.stroke()
  traceRoute()
  context.strokeStyle = 'rgba(121, 255, 197, 0.12)'
  context.lineWidth = Math.max(24, canvasHeight * 0.066)
  context.stroke()
  traceRoute()
  context.strokeStyle = phase === 'battle' ? 'rgba(143, 255, 194, .72)' : 'rgba(143, 255, 194, .48)'
  context.setLineDash([2, 11])
  context.lineDashOffset = -time * 0.025
  context.lineWidth = 2
  context.stroke()
  context.restore()
}

function drawPortal(position: Point, destination: boolean, time: number): void {
  const center = px(position)
  const pulse = 1 + Math.sin(time * 0.003 + (destination ? 2 : 0)) * 0.08
  context.save()
  context.translate(center.x, center.y)
  context.strokeStyle = destination ? 'rgba(255, 113, 136, .55)' : 'rgba(143, 255, 194, .55)'
  context.fillStyle = destination ? 'rgba(255, 77, 108, .12)' : 'rgba(109, 255, 190, .12)'
  context.lineWidth = 2
  context.beginPath()
  context.arc(0, 0, 23 * pulse, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.beginPath()
  context.arc(0, 0, 15 / pulse, 0, Math.PI * 2)
  context.stroke()
  context.fillStyle = destination ? '#ff7188' : '#8fffc2'
  context.beginPath()
  context.arc(0, 0, 5, 0, Math.PI * 2)
  context.fill()
  context.font = '600 9px ui-monospace, monospace'
  context.textAlign = destination ? 'right' : 'left'
  context.fillStyle = destination ? 'rgba(255, 164, 176, .84)' : 'rgba(174, 255, 215, .8)'
  context.fillText(
    destination ? `CORE ${core.toString().padStart(2, '0')}` : 'SPAWN',
    destination ? 8 : -8,
    39
  )
  context.restore()
}

function drawTower(tower: RuntimeTower, time: number): void {
  const center = px(tower.position)
  const definition = TOWER_DEFS[tower.kind]
  const radius = tower.kind === 'cannon' ? 12 : 10
  context.save()
  context.translate(center.x, center.y)
  if (phase === 'planning') {
    context.beginPath()
    context.arc(0, 0, tower.range * canvasWidth, 0, Math.PI * 2)
    context.fillStyle = `${definition.color}08`
    context.fill()
    context.strokeStyle = `${definition.color}18`
    context.setLineDash([3, 6])
    context.stroke()
    context.setLineDash([])
  }
  context.rotate(time * 0.00022 * (tower.id % 2 ? 1 : -1))
  context.fillStyle = 'rgba(5, 8, 10, .92)'
  context.strokeStyle = definition.color
  context.lineWidth = 1.5
  context.beginPath()
  for (let side = 0; side < 6; side += 1) {
    const angle = (side / 6) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (side === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.closePath()
  context.fill()
  context.stroke()
  context.rotate(-time * 0.00022 * (tower.id % 2 ? 1 : -1))
  context.fillStyle = definition.color
  if (tower.kind === 'pulse') {
    context.fillRect(-4, -4, 8, 8)
  } else if (tower.kind === 'frost') {
    context.beginPath()
    context.arc(0, 0, 4.5, 0, Math.PI * 2)
    context.fill()
  } else {
    context.fillRect(-3, -7 - tower.recoil * 20, 6, 12)
  }
  if (tower.level === 2) {
    context.strokeStyle = '#fff1c9'
    context.lineWidth = 1
    context.beginPath()
    context.arc(0, 0, radius + 4, 0, Math.PI * 2)
    context.stroke()
  }
  context.restore()
}

function drawUnit(unit: RuntimeUnit): void {
  if (!unit.alive) return
  const position = px(pointOnRoute(route, unit.progress))
  const ahead = px(pointOnRoute(route, clamp(unit.progress + 0.008, 0, 1)))
  const angle = Math.atan2(ahead.y - position.y, ahead.x - position.x)
  const definition = UNIT_DEFS[unit.kind]
  const radius = Math.max(7, definition.radius * canvasWidth)
  context.save()
  context.translate(position.x, position.y)
  context.rotate(angle)
  context.shadowColor = definition.color
  context.shadowBlur = unit.flash > 0 ? 17 : 7
  context.fillStyle = unit.flash > 0 ? '#ffffff' : definition.color
  context.strokeStyle = 'rgba(4, 8, 8, .75)'
  context.lineWidth = 1.5
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
    roundedRect(context, -radius, -radius * 0.72, radius * 2, radius * 1.44, 4)
    context.fill()
    context.stroke()
    context.fillStyle = '#2b335a'
    context.fillRect(-radius * 0.12, -radius * 0.92, radius * 1.02, radius * 0.28)
  }
  context.shadowBlur = 0
  context.rotate(-angle)
  const barWidth = radius * 2.1
  context.fillStyle = 'rgba(0, 0, 0, .6)'
  context.fillRect(-barWidth / 2, -radius - 8, barWidth, 2.5)
  context.fillStyle = definition.color
  context.fillRect(-barWidth / 2, -radius - 8, barWidth * clamp(unit.hp / unit.maxHp, 0, 1), 2.5)
  context.restore()
}

function drawWaypoints(time: number): void {
  if (phase !== 'planning') return
  route.slice(1, -1).forEach((position, sliceIndex) => {
    const index = sliceIndex + 1
    const center = px(position)
    const selected = index === selectedWaypoint
    const pulse = 1 + Math.sin(time * 0.004 + index) * 0.08
    context.save()
    context.translate(center.x, center.y)
    context.fillStyle = selected ? 'rgba(143, 255, 194, .18)' : 'rgba(143, 255, 194, .08)'
    context.strokeStyle = selected ? '#a5ffd0' : 'rgba(143, 255, 194, .62)'
    context.lineWidth = selected ? 2 : 1
    context.beginPath()
    context.arc(0, 0, (selected ? 19 : 15) * pulse, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.fillStyle = '#9cffcb'
    context.beginPath()
    context.arc(0, 0, 4, 0, Math.PI * 2)
    context.fill()
    context.font = '600 8px ui-monospace, monospace'
    context.textAlign = 'center'
    context.fillStyle = '#07100c'
    context.fillText(index.toString(), 0, 3)
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
    context.shadowColor = shot.color
    context.shadowBlur = 8
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
    context.font = '700 9px ui-monospace, monospace'
    context.textAlign = 'center'
    context.fillText(label.text, position.x, position.y)
    context.restore()
  }
}

function render(time: number): void {
  resizeCanvas()
  drawBackdrop(time)
  drawRoute(time)
  const start = route[0]
  const destination = route.at(-1)
  if (start) drawPortal(start, false, time)
  if (destination) drawPortal(destination, true, time)
  towers.forEach((tower) => drawTower(tower, time))
  units.forEach(drawUnit)
  drawEffects()
  drawWaypoints(time)
}

function frame(timestamp: number): void {
  const rawDelta = Math.min((timestamp - lastTimestamp) / 1000, 0.05)
  lastTimestamp = timestamp
  if (phase === 'battle') updateBattle(rawDelta * speed)
  if (toastTimer > 0) {
    toastTimer -= rawDelta
    if (toastTimer <= 0) ui.combatToast.classList.remove('visible')
  }
  render(timestamp)
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
  document.querySelectorAll('[data-route]').forEach((button) => button.classList.remove('active'))
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

document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => {
  button.addEventListener('click', () => setRoutePreset(button.dataset.route ?? 'zigzag'))
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

document.querySelectorAll<HTMLButtonElement>('[data-formation]').forEach((button) => {
  button.addEventListener('click', () => setFormation(button.dataset.formation as Formation))
})

ui.launch.addEventListener('click', launchWave)
ui.continueButton.addEventListener('click', advanceRound)

byId<HTMLButtonElement>('enter-button').addEventListener('click', () => {
  ui.intro.classList.remove('open')
  sounds.play('launch')
  canvas.focus({ preventScroll: true })
})

byId<HTMLButtonElement>('reset-button').addEventListener('click', () => {
  resetGame()
  ui.summary.classList.remove('open')
  ui.summary.setAttribute('aria-hidden', 'true')
  showToast('SIMULATION RESET', 'neutral')
  sounds.play('click')
})

ui.speed.addEventListener('click', () => {
  speed = speed === 1 ? 2 : 1
  ui.speed.textContent = `${speed}×`
  showToast(`SIMULATION SPEED ${speed}×`)
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
  if (event.code === 'Space' && phase === 'planning' && !ui.intro.classList.contains('open')) {
    event.preventDefault()
    launchWave()
  }
})

window.addEventListener('resize', resizeCanvas)

rebuildDefense()
updateUI()
resizeCanvas()
requestAnimationFrame(frame)
