import './style.css'
import {
  DEFAULT_ROUTE,
  COMMAND_DEFS,
  MUTATION_DEFS,
  TACTICAL_NODE_DEFS,
  TOWER_DEFS,
  UNIT_DEFS,
  analyzeArmy,
  buildSpawnPlan,
  clamp,
  compositionOf,
  coreDamageFor,
  formationMatchup,
  generateTacticalNodes,
  generateTowerBlueprints,
  linkedNodeIds,
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
  type CommandKind,
  type Formation,
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

const MAX_ROUNDS = 5
const MAX_CORE = 30
const maybeApp = document.querySelector<HTMLDivElement>('#app')

if (!maybeApp) throw new Error('App root is missing')
const app: HTMLDivElement = maybeApp

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="." aria-label="Ayaya Breach Protocol 首页">
        <strong>Ayaya</strong>
        <span>Breach Protocol</span>
      </a>
      <div class="game-stats" aria-label="战局状态">
        <span>第 <strong id="round-value">1 / 5</strong> 回合</span>
        <span>核心 <strong id="core-value">30</strong></span>
        <span><strong id="credit-value">180</strong> 资源</span>
      </div>
      <div class="top-actions">
        <button class="icon-button" id="sound-button" type="button" aria-label="关闭音效" aria-pressed="true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9H5Zm12.5 1a3.5 3.5 0 0 1 0 4M19.7 7a7 7 0 0 1 0 10"/></svg>
        </button>
        <button class="text-button" id="reset-button" type="button">重置</button>
      </div>
    </header>

    <main class="game-board">
      <section class="battlefield" aria-label="战场">
        <div class="battlefield-toolbar">
          <div class="phase-label"><i></i><span id="phase-label">规划中</span></div>
          <p class="battle-rule">接入中继才能攻击核心；重复路线会承受额外伤害。</p>
          <div class="battlefield-actions">
            <button class="command-button" id="command-button" type="button" aria-label="释放战术指令" disabled><span>静默</span><small>1 次</small></button>
            <button class="speed-button" id="speed-button" type="button" aria-label="切换战斗速度" disabled>1×</button>
          </div>
        </div>
        <div class="canvas-wrap">
          <canvas id="battlefield" tabindex="0" aria-label="路线战场。规划阶段可拖拽三个绿色路标，方向键可微调选中的路标。"></canvas>
          <div class="map-hint" id="map-hint">拖动路标 · 路线必须接入至少一个中继</div>
          <div class="wave-progress" id="wave-progress" hidden><i></i></div>
          <div class="combat-toast" id="combat-toast" role="status" aria-live="polite"></div>
        </div>
        <div class="route-readout" aria-label="路线评估">
          <span>中继 <strong id="relay-value">0 / 2</strong></span>
          <span>暴露 <strong id="route-risk">高</strong></span>
          <span>轨迹 <strong id="trace-value">新路线</strong></span>
          <span>长度 <strong id="route-length">1.52</strong></span>
        </div>
      </section>

      <section class="decision-dock" aria-label="入侵计划">
        <div class="defense-note">
          <span>防线</span>
          <p id="ai-readout">均衡戒备：威胁样本不足，先改变路线试探射界。</p>
        </div>

        <section class="decision-row route-row">
          <header><strong>路线</strong><small id="route-ready">未接入中继</small></header>
          <div class="route-options">
            <div class="preset-list" aria-label="路线预设">
            <button type="button" data-route="direct">直线</button>
            <button type="button" data-route="high">上绕</button>
            <button type="button" data-route="low">下绕</button>
            <button class="active" type="button" data-route="zigzag">折线</button>
            </div>
            <div class="signal-strip" id="signal-strip" aria-label="本回合战场中继"></div>
          </div>
        </section>

        <section class="decision-row army-row">
          <header><strong>编队</strong><small><span id="budget-value">180</span> 可用</small></header>
          <div class="army-builder">
            <div class="unit-market" id="unit-market">
              <button class="unit-card" type="button" data-unit="slime">
                <span class="unit-copy"><strong>史莱姆 <em>×3</em></strong><small>消耗炮击</small></span>
                <span class="unit-cost">30</span>
              </button>
              <button class="unit-card" type="button" data-unit="swift">
                <span class="unit-copy"><strong>疾行兽 <em>×2</em></strong><small>高速抢点</small></span>
                <span class="unit-cost">42</span>
              </button>
              <button class="unit-card" type="button" data-unit="tank">
                <span class="unit-copy"><strong>铁甲兽 <em>×1</em></strong><small>重装突破</small></span>
                <span class="unit-cost">60</span>
              </button>
            </div>
            <div class="queue-track" id="queue-track" aria-label="出兵序列"></div>
          </div>
          <div class="mutation-rack" id="mutation-rack"><span>进化</span><small>无</small></div>
        </section>

        <section class="decision-row tactic-row">
          <header><strong>战术</strong><small id="formation-copy">标准节奏</small></header>
          <div class="tactic-options">
            <div class="choice-block">
              <span>节奏</span>
              <div class="segmented" role="group" aria-label="出兵节奏">
                <button type="button" data-formation="rush">紧密</button>
                <button class="active" type="button" data-formation="steady">标准</button>
                <button type="button" data-formation="split">分批</button>
              </div>
            </div>
            <div class="choice-block command-block">
              <span>指令</span>
              <div class="command-choice" id="command-choice" role="group" aria-label="战术指令">
                <button class="active" type="button" data-command="blackout">静默</button>
                <button type="button" data-command="overdrive">冲刺</button>
                <button type="button" data-command="mend">再生</button>
              </div>
            </div>
          </div>
          <div class="tactic-copy">
            <p class="matchup neutral" id="matchup-copy">当前节奏不会明显克制这套防线。</p>
            <p id="command-description">让全部防御塔暂时离线。</p>
          </div>
        </section>

        <div class="launch-zone">
          <div class="readiness"><span><i id="ready-light"></i><strong id="ready-title">等待编队</strong></span><small id="ready-copy">购买单位并接入中继</small></div>
          <button class="launch-button" id="launch-button" type="button" disabled>
            <span>开始</span><small>路线接入中继后可出发</small>
          </button>
        </div>
      </section>
    </main>
  </div>

  <div class="modal-backdrop" id="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title" aria-hidden="true">
    <section class="modal summary-modal">
      <span class="modal-index" id="summary-index">第 1 回合</span>
      <h2 id="summary-title">回合结束</h2>
      <p id="summary-copy">AI 已记录你的打法，下一回合会调整塔组。</p>
      <div class="report-stats">
        <div><span>部署</span><strong id="stat-deployed">0</strong></div>
        <div><span>突破</span><strong id="stat-breaches">0</strong></div>
        <div><span>核心伤害</span><strong id="stat-damage">0</strong></div>
        <div><span>情报奖励</span><strong id="stat-reward">+0</strong></div>
      </div>
      <div class="adaptation-note"><span>下一轮</span><p><strong id="next-ai-name">截流协议</strong> · <span id="next-ai-copy">正在分析防守策略。</span></p></div>
      <div class="evolution-panel" id="evolution-panel">
        <div class="evolution-heading"><span>选择进化</span><small>本局永久生效</small></div>
        <div class="evolution-grid" id="evolution-grid"></div>
      </div>
      <button class="primary-modal-button" id="continue-button" type="button" disabled>先选择进化 <span>→</span></button>
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
  aiReadout: byId('ai-readout'),
  signalStrip: byId('signal-strip'),
  relayValue: byId('relay-value'),
  traceValue: byId('trace-value'),
  routeReady: byId('route-ready'),
  mutationRack: byId('mutation-rack'),
  queue: byId('queue-track'),
  market: byId('unit-market'),
  formationCopy: byId('formation-copy'),
  matchupCopy: byId('matchup-copy'),
  commandChoice: byId('command-choice'),
  commandDescription: byId('command-description'),
  readyLight: byId('ready-light'),
  readyTitle: byId('ready-title'),
  readyCopy: byId('ready-copy'),
  launch: byId<HTMLButtonElement>('launch-button'),
  phase: byId('phase-label'),
  mapHint: byId('map-hint'),
  speed: byId<HTMLButtonElement>('speed-button'),
  command: byId<HTMLButtonElement>('command-button'),
  waveProgress: byId('wave-progress'),
  combatToast: byId('combat-toast'),
  summary: byId('summary-modal'),
  evolutionPanel: byId('evolution-panel'),
  evolutionGrid: byId('evolution-grid'),
  continueButton: byId<HTMLButtonElement>('continue-button'),
  announcer: byId('announcer'),
  sound: byId<HTMLButtonElement>('sound-button')
}

let phase: Phase = 'planning'
let round = 1
let credits = 180
let core = MAX_CORE
let score = 0
let bestScore = Number.parseInt(localStorage.getItem('breach-protocol-best') ?? '0', 10) || 0
let queue: ArmyBatch[] = []
let nextBatchId = 1
let formation: Formation = 'steady'
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
let pendingMutation: MutationId | null = null
let currentMutationOffers: MutationDefinition[] = []
let commandUsed = false
let selectedCommand: CommandKind = 'blackout'
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

function defenseReason(current: AIAnalysis): string {
  const summaries: Record<AIAnalysis['mode'], string> = {
    balanced: '样本不足 → 通用火力',
    intercept: '上轮高速单位偏多 → 本轮迟滞塔前移',
    pierce: '上轮重装单位偏多 → 本轮穿甲火力重叠',
    suppress: '上轮密集冲锋 → 本轮范围火力覆盖',
    lockdown: '路线重复 → 本轮沿旧路径增伤 30%'
  }
  return summaries[current.mode]
}

function updateUI(): void {
  const isPlanning = phase === 'planning'
  const modifiers = modifiersFor(ownedMutations)
  const length = routeLength(route)
  const linkedNodes = linkedNodeIds(route, nodes)
  const similarity = routeSimilarity(route, previousRoute)
  routeRepeated = round > 1 && similarity >= 0.78
  const exposureSamples = Array.from({ length: 60 }, (_, index) => pointOnRoute(route, index / 59))
  const exposure =
    exposureSamples.filter((point) =>
      towers.some(
        (tower) =>
          Math.hypot(point.x - tower.position.x, point.y - tower.position.y) < tower.range * 0.84
      )
    ).length / exposureSamples.length
  const risk = exposure > 0.56 ? '极高' : exposure > 0.4 ? '高' : exposure > 0.24 ? '中' : '低'
  const riskClass = exposure > 0.4 ? 'risk-high' : exposure > 0.24 ? 'risk-medium' : 'risk-low'
  const matchup = formationMatchup(formation, analysis.mode)

  ui.round.textContent = `${round} / ${MAX_ROUNDS}`
  ui.core.textContent = Math.ceil(core).toString()
  ui.credits.textContent = credits.toString()
  ui.budget.textContent = credits.toString()
  ui.routeLength.textContent = length.toFixed(2)
  ui.routeRisk.textContent = risk
  ui.routeRisk.className = riskClass
  ui.relayValue.textContent = `${linkedNodes.length} / ${nodes.length}`
  ui.relayValue.className = linkedNodes.length ? 'ready-value' : 'danger-value'
  ui.traceValue.textContent =
    round === 1
      ? '新路线'
      : routeRepeated
        ? `重复 ${Math.round(similarity * 100)}%`
        : `变化 ${Math.round((1 - similarity) * 100)}%`
  ui.traceValue.className = routeRepeated ? 'danger-value' : 'ready-value'
  ui.routeReady.textContent =
    linkedNodes.length === 0
      ? '未接入中继'
      : linkedNodes.length === 1
        ? '已接入 1 个 · 伤害 50%'
        : '已接入 2 个 · 完整伤害'
  ui.routeReady.className = linkedNodes.length ? 'ready-value' : 'danger-value'
  ui.aiReadout.textContent = `${analysis.name} · ${defenseReason(analysis)}`

  ui.signalStrip.innerHTML = nodes
    .map((node) => {
      const definition = TACTICAL_NODE_DEFS[node.kind]
      const linked = linkedNodes.includes(node.id)
      return `<button type="button" class="signal-chip ${linked ? 'linked' : ''} ${node.activated ? 'activated' : ''}" data-link-node="${node.id}" ${isPlanning ? '' : 'disabled'}>
        <strong>${definition.name}</strong><small>${node.activated ? '已吸收' : linked ? '已接入' : '接入'}</small>
      </button>`
    })
    .join('')

  ui.mutationRack.innerHTML = ownedMutations.length
    ? `<span>进化 ${ownedMutations.length}</span><div>${ownedMutations
        .map((id) => {
          const mutation = MUTATION_DEFS[id]
          return `<i style="--mutation:${mutation.accent}" title="${mutation.name} · ${mutation.detail}">${mutation.name}</i>`
        })
        .join('')}</div>`
    : '<span>进化</span><small>无</small>'

  ui.queue.innerHTML = queue.length
    ? queue
        .map(
          (
            batch,
            index
          ) => `<button type="button" class="queue-token ${batch.kind}" data-remove-batch="${batch.id}" aria-label="撤回第 ${index + 1} 批 ${UNIT_DEFS[batch.kind].name}">
              <span>${index + 1}</span><i></i><strong>×${UNIT_DEFS[batch.kind].count + (batch.kind === 'slime' ? modifiers.slimeBonus : 0)}</strong>
            </button>`
        )
        .join('')
    : '<div class="queue-empty"><p>购买顺序就是部署顺序</p></div>'

  ui.market.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((button) => {
    const kind = button.dataset.unit as UnitKind
    const definition = unitDefinition(kind, ownedMutations)
    const cost = unitCost(kind, ownedMutations)
    const count = UNIT_DEFS[kind].count + (kind === 'slime' ? modifiers.slimeBonus : 0)
    const countLabel = button.querySelector('em')
    const statLabel = button.querySelector('small')
    const costLabel = button.querySelector('.unit-cost')
    if (countLabel) countLabel.textContent = `×${count}`
    if (statLabel) {
      statLabel.textContent =
        kind === 'tank'
          ? `重装 · 核心伤害 ${definition.breach}`
          : kind === 'swift'
            ? `抢占中继 · 速度 ${Math.round(definition.speed * 1000)}`
            : `消耗炮击 · 生命 ${definition.hp}`
    }
    if (costLabel) costLabel.textContent = cost.toString()
    button.disabled = !isPlanning || credits < cost || queue.length >= 6
  })

  document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => {
    button.disabled = !isPlanning
  })
  document.querySelectorAll<HTMLButtonElement>('[data-formation]').forEach((button) => {
    button.disabled = !isPlanning
  })
  ui.commandChoice.querySelectorAll<HTMLButtonElement>('[data-command]').forEach((button) => {
    button.disabled = !isPlanning
    button.classList.toggle('active', button.dataset.command === selectedCommand)
  })
  ui.commandDescription.textContent = COMMAND_DEFS[selectedCommand].detail
  ui.matchupCopy.textContent = matchup.detail
  ui.matchupCopy.className = `matchup ${matchup.state}`

  const totalUnits = queue.reduce(
    (sum, batch) =>
      sum + UNIT_DEFS[batch.kind].count + (batch.kind === 'slime' ? modifiers.slimeBonus : 0),
    0
  )
  const routeReady = linkedNodes.length > 0
  const canLaunch = isPlanning && queue.length > 0 && routeReady
  ui.launch.disabled = !canLaunch
  ui.readyLight.classList.toggle('ready', canLaunch)
  ui.readyTitle.textContent = !queue.length
    ? '等待编队'
    : !routeReady
      ? '路线未接入中继'
      : `${totalUnits} 个单位就绪`
  ui.readyCopy.textContent = !queue.length
    ? '至少购买一个单位批次'
    : !routeReady
      ? '拖动路标或点击一个中继'
      : routeRepeated
        ? `重复路线 · 塔伤 +30% · 核心伤害 ${linkedNodes.length === 1 ? '50%' : '100%'}`
        : `${queue.length} 个批次 · 核心伤害 ${linkedNodes.length === 1 ? '50%' : '100%'}`
  const launchCopy = ui.launch.querySelector('small')
  if (launchCopy) {
    launchCopy.textContent = !routeReady
      ? '路线接入中继后可出发'
      : linkedNodes.length === 1
        ? '核心护盾仍减伤 50%'
        : '核心护盾已完全关闭'
  }
  ui.phase.textContent = phase === 'battle' ? '突破中' : phase === 'planning' ? '规划中' : '结算中'
  ui.mapHint.classList.toggle('hidden', !isPlanning)
  ui.speed.disabled = phase !== 'battle'
  ui.command.disabled = phase !== 'battle' || commandUsed
  ui.command.classList.toggle('used', commandUsed)
  const commandDefinition = COMMAND_DEFS[selectedCommand]
  ui.command.innerHTML = commandUsed
    ? `<span>${commandDefinition.name}</span><small>已使用</small>`
    : `<span>${commandDefinition.name}</span><small>1 次</small>`
  ui.command.setAttribute('aria-label', `释放${commandDefinition.name}`)
  ui.waveProgress.toggleAttribute('hidden', phase !== 'battle')
  app.dataset.phase = phase
  app.dataset.round = round.toString()
  app.dataset.core = core.toString()
  app.dataset.relays = linkedNodes.length.toString()
  app.dataset.doctrine = analysis.mode
  app.dataset.repeated = routeRepeated.toString()
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
    high: [0.25, 0.17, 0.3],
    low: [0.7, 0.83, 0.68],
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

function linkNodeToRoute(id: number): void {
  if (phase !== 'planning') return
  const node = nodes.find((candidate) => candidate.id === id)
  if (!node) return
  const editable = route.slice(1, -1)
  const nearestIndex = editable.reduce(
    (best, point, index) =>
      Math.abs(point.x - node.position.x) < Math.abs((editable[best]?.x ?? 0) - node.position.x)
        ? index
        : best,
    0
  )
  moveWaypoint(nearestIndex + 1, node.position)
  showToast(`${TACTICAL_NODE_DEFS[node.kind].name}已接入路线`, 'success')
  sounds.play('click')
}

function addBatch(kind: UnitKind): void {
  const cost = unitCost(kind, ownedMutations)
  if (phase !== 'planning' || credits < cost || queue.length >= 6) return
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

function setFormation(nextFormation: Formation): void {
  if (phase !== 'planning') return
  formation = nextFormation
  const copy: Record<Formation, string> = {
    rush: '紧密节奏',
    steady: '标准节奏',
    split: '分批节奏'
  }
  ui.formationCopy.textContent = copy[formation]
  document.querySelectorAll('[data-formation]').forEach((button) => {
    button.classList.toggle('active', (button as HTMLElement).dataset.formation === formation)
  })
  rebuildDefense()
  updateUI()
  sounds.play('click')
}

function setCommand(command: CommandKind): void {
  if (phase !== 'planning') return
  selectedCommand = command
  updateUI()
  sounds.play('click')
}

function launchWave(): void {
  if (phase !== 'planning' || queue.length === 0 || linkedNodeIds(route, nodes).length === 0) return
  phase = 'battle'
  spawnPlan = buildSpawnPlan(queue, formation, ownedMutations)
  spawnIndex = 0
  waveElapsed = 0
  waveStats = { deployed: spawnPlan.length, destroyed: 0, breaches: 0, coreDamage: 0, nodes: 0 }
  units = []
  particles = []
  shots = []
  labels = []
  commandUsed = false
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
  const matchup = formationMatchup(formation, analysis.mode)
  const repetitionPenalty = routeRepeated ? 1.3 : 1
  const splashMultiplier = isSplash ? matchup.splashMultiplier : 1
  target.hp -=
    damage * matchup.damageMultiplier * splashMultiplier * repetitionPenalty * (1 - armor)
  target.flash = 0.12
  if (tower.kind === 'frost') {
    target.slowUntil = Math.max(
      target.slowUntil,
      waveElapsed + 1.25 * matchup.slowMultiplier * repetitionPenalty
    )
  }
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
        damageUnit(nearby, damage * 0.35, tower, true)
      }
    }
    burst(targetPosition, definition.color, 5, 0.05)
  }
}

function activateCommand(): void {
  if (phase !== 'battle' || commandUsed) return
  commandUsed = true
  const command = COMMAND_DEFS[selectedCommand]

  if (selectedCommand === 'blackout') {
    const duration = modifiersFor(ownedMutations).empDuration
    jammedUntil = Math.max(jammedUntil, waveElapsed + duration)
    for (const tower of towers) {
      tower.cooldown = Math.max(tower.cooldown, duration * 0.35)
      burst(tower.position, command.color, 8, 0.075)
    }
    labels.push({
      x: 0.5,
      y: 0.12,
      text: `静默 ${duration.toFixed(1)} 秒`,
      color: command.color,
      life: 1.2
    })
    showToast(`防线停火 ${duration.toFixed(1)} 秒`, 'success')
  } else if (selectedCommand === 'overdrive') {
    const duration = 2.4 * modifiersFor(ownedMutations).nodeMultiplier
    globalBoostUntil = Math.max(globalBoostUntil, waveElapsed + duration)
    for (const unit of units) {
      if (unit.alive) burst(pointOnRoute(route, unit.progress), command.color, 5, 0.06)
    }
    labels.push({ x: 0.5, y: 0.12, text: '全军过载', color: command.color, life: 1.2 })
    showToast(`全军加速 ${duration.toFixed(1)} 秒`, 'success')
  } else {
    let healed = 0
    for (const unit of units) {
      if (!unit.alive) continue
      const before = unit.hp
      unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * 0.38)
      healed += unit.hp - before
      burst(pointOnRoute(route, unit.progress), command.color, 5, 0.055)
    }
    labels.push({ x: 0.5, y: 0.12, text: '全军修复', color: command.color, life: 1.2 })
    showToast(
      healed > 1 ? `全军恢复 ${Math.round(healed)} 生命` : '当前没有可修复的单位',
      'success'
    )
  }
  ui.announcer.textContent = `${command.name}已释放。${command.short}。`
  updateUI()
  sounds.play('launch')
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
    text: `${definition.code} ACQUIRED`,
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
  const formationSpeed: Record<Formation, number> = { rush: 1.08, steady: 1, split: 0.96 }
  for (const unit of units) {
    if (!unit.alive) continue
    const definition = unitDefinition(unit.kind, ownedMutations)
    const slowed = unit.slowUntil > waveElapsed
    const boosted = globalBoostUntil > waveElapsed
    unit.progress +=
      (definition.speed *
        formationSpeed[formation] *
        (slowed ? 0.55 : 1) *
        (boosted ? 1.52 : 1) *
        delta) /
      lengthScale
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
        ui.budget.textContent = credits.toString()
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
    breaches: waveStats.breaches,
    formation
  }
  previousRoute = route.map((point) => ({ ...point }))
  const reward = 72 + round * 8 + waveStats.coreDamage * 4 + Math.max(0, waveStats.nodes - 1) * 22
  credits += reward

  if (round >= MAX_ROUNDS) {
    finishGame(false)
    return
  }

  const nextAnalysis = analyzeArmy([], history)
  byId('summary-index').textContent = `第 ${round} 回合报告`
  byId('summary-title').textContent = waveStats.breaches ? '防线正在重构' : '入侵信号已中断'
  byId('summary-copy').textContent = waveStats.breaches
    ? `核心受到 ${waveStats.coreDamage} 点伤害；${waveStats.destroyed} 个单位被防线截获。`
    : `没有单位完成突破。下一轮需要改路线、换节奏，或调整指令时机。`
  byId('stat-deployed').textContent = waveStats.deployed.toString()
  byId('stat-breaches').textContent = waveStats.breaches.toString()
  byId('stat-damage').textContent = waveStats.coreDamage.toString()
  byId('stat-reward').textContent = `+${reward}`
  byId('next-ai-name').textContent = nextAnalysis.name
  byId('next-ai-copy').textContent = defenseReason(nextAnalysis)
  currentMutationOffers = mutationOffers(round, ownedMutations)
  pendingMutation = null
  ui.evolutionPanel.hidden = false
  ui.evolutionGrid.innerHTML = currentMutationOffers
    .map(
      (
        mutation
      ) => `<button type="button" data-mutation="${mutation.id}" style="--evolution:${mutation.accent}">
        <strong>${mutation.name}</strong><small>${mutation.detail}</small>
      </button>`
    )
    .join('')
  ui.continueButton.disabled = true
  ui.continueButton.innerHTML = '先选择进化 <span>→</span>'
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
  ui.evolutionPanel.hidden = true
  pendingMutation = null
  ui.continueButton.disabled = false
  ui.continueButton.innerHTML = '再次入侵 <span>↻</span>'
  ui.summary.classList.add('open')
  ui.summary.setAttribute('aria-hidden', 'false')
  ui.announcer.textContent = victory ? '任务完成，AI 核心已摧毁。' : '任务失败，AI 守住了核心。'
  showToast(victory ? '核心已离线' : '入侵已终止', victory ? 'success' : 'danger')
  updateUI()
  sounds.play(victory ? 'win' : 'hit')
}

function selectMutation(id: MutationId): void {
  if (phase !== 'summary' || !currentMutationOffers.some((offer) => offer.id === id)) return
  pendingMutation = id
  ui.evolutionGrid.querySelectorAll<HTMLButtonElement>('[data-mutation]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.mutation === id)
  })
  ui.continueButton.disabled = false
  ui.continueButton.innerHTML = `吸收「${MUTATION_DEFS[id].name}」 <span>→</span>`
  sounds.play('click')
}

function advanceRound(): void {
  if (phase === 'ended') {
    resetGame()
    ui.summary.classList.remove('open')
    ui.summary.setAttribute('aria-hidden', 'true')
    return
  }
  if (!pendingMutation) return
  ownedMutations.push(pendingMutation)
  pendingMutation = null
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
  commandUsed = false
  jammedUntil = 0
  globalBoostUntil = 0
  selectedWaypoint = 2
  defenseRoute = (previousRoute ?? route).map((point) => ({ ...point }))
  nodes = generateTacticalNodes(round).map((node) => ({ ...node, activated: false }))
  rebuildDefense()
  ui.summary.classList.remove('open')
  ui.summary.setAttribute('aria-hidden', 'true')
  showToast(`第 ${round} 回合 · ${analysis.name}`, 'neutral')
  ui.announcer.textContent = `第 ${round} 回合规划开始。战术指令已重新充能。`
  updateUI()
}

function resetGame(): void {
  phase = 'planning'
  round = 1
  credits = 180
  core = MAX_CORE
  score = 0
  queue = []
  nextBatchId = 1
  formation = 'steady'
  route = DEFAULT_ROUTE.map((point) => ({ ...point }))
  defenseRoute = DEFAULT_ROUTE.map((point) => ({ ...point }))
  previousRoute = null
  history = undefined
  ownedMutations = []
  pendingMutation = null
  currentMutationOffers = []
  commandUsed = false
  selectedCommand = 'blackout'
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
  ui.evolutionPanel.hidden = false
  ui.continueButton.disabled = true
  document.querySelectorAll('[data-route]').forEach((button) => {
    button.classList.toggle('active', (button as HTMLElement).dataset.route === 'zigzag')
  })
  document.querySelectorAll('[data-formation]').forEach((button) => {
    button.classList.toggle('active', (button as HTMLElement).dataset.formation === 'steady')
  })
  ui.formationCopy.textContent = '标准节奏'
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

function drawBackdrop(): void {
  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.fillStyle = '#121311'
  context.fillRect(0, 0, canvasWidth, canvasHeight)
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

function drawRoute(): void {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  traceRoute()
  context.strokeStyle = '#080908'
  context.lineWidth = Math.max(24, canvasHeight * 0.06)
  context.stroke()
  traceRoute()
  context.strokeStyle = '#282a23'
  context.lineWidth = Math.max(16, canvasHeight * 0.04)
  context.stroke()
  traceRoute()
  context.strokeStyle = phase === 'battle' ? '#aab88d' : '#747d66'
  context.lineWidth = 1
  context.stroke()
  context.restore()
}

function drawPortal(position: Point, destination: boolean): void {
  const center = px(position)
  context.save()
  context.translate(center.x, center.y)
  context.strokeStyle = destination ? '#c87970' : '#aab88d'
  context.fillStyle = '#121311'
  context.lineWidth = 1.5
  if (destination) context.rotate(Math.PI / 4)
  context.fillRect(-11, -11, 22, 22)
  context.strokeRect(-11, -11, 22, 22)
  context.fillStyle = destination ? '#c87970' : '#aab88d'
  context.fillRect(-3, -3, 6, 6)
  if (destination) context.rotate(-Math.PI / 4)
  context.font = '500 9px ui-sans-serif, sans-serif'
  context.textAlign = destination ? 'right' : 'left'
  context.fillStyle = destination ? '#c87970' : '#aab88d'
  context.fillText(destination ? `核心 ${Math.ceil(core)}` : '入口', destination ? 4 : -4, 28)
  context.restore()
}

function drawTacticalNode(node: RuntimeNode): void {
  const center = px(node.position)
  const definition = TACTICAL_NODE_DEFS[node.kind]
  const radius = Math.min(canvasWidth, canvasHeight) * node.radius
  context.save()
  context.translate(center.x, center.y)
  context.globalAlpha = node.activated ? 0.3 : 0.8
  context.setLineDash([3, 5])
  context.beginPath()
  context.arc(0, 0, radius, 0, Math.PI * 2)
  context.strokeStyle = '#62655a'
  context.lineWidth = 1
  context.stroke()
  context.setLineDash([])
  context.fillStyle = '#121311'
  context.strokeStyle = '#9a9d8d'
  context.fillRect(-7, -7, 14, 14)
  context.strokeRect(-7, -7, 14, 14)
  context.fillStyle = '#aab88d'
  context.fillRect(-2, -2, 4, 4)
  context.font = '500 8px ui-sans-serif, sans-serif'
  context.textAlign = 'center'
  context.fillStyle = '#a4a39b'
  context.fillText(node.activated ? '已吸收' : definition.name, 0, radius + 13)
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
  const radius = tower.kind === 'cannon' ? 10 : 9
  context.save()
  context.translate(center.x, center.y)
  if (phase === 'battle' && waveElapsed < jammedUntil) context.globalAlpha = 0.42
  context.fillStyle = '#171815'
  context.strokeStyle = color
  context.lineWidth = 1
  context.fillRect(-radius, -radius, radius * 2, radius * 2)
  context.strokeRect(-radius, -radius, radius * 2, radius * 2)
  context.fillStyle = color
  if (tower.kind === 'pulse') {
    context.fillRect(-3, -3, 6, 6)
  } else if (tower.kind === 'frost') {
    context.beginPath()
    context.arc(0, 0, 3.5, 0, Math.PI * 2)
    context.fill()
  } else {
    context.fillRect(-2, -6 - tower.recoil * 14, 4, 10)
  }
  if (tower.level === 2) {
    context.strokeStyle = '#c6c2b4'
    context.lineWidth = 1
    context.strokeRect(-radius - 3, -radius - 3, radius * 2 + 6, radius * 2 + 6)
  }
  context.restore()
}

function drawUnit(unit: RuntimeUnit): void {
  if (!unit.alive) return
  const position = px(pointOnRoute(route, unit.progress))
  const ahead = px(pointOnRoute(route, clamp(unit.progress + 0.008, 0, 1)))
  const angle = Math.atan2(ahead.y - position.y, ahead.x - position.x)
  const definition = unitDefinition(unit.kind, ownedMutations)
  const radius = Math.max(7, definition.radius * canvasWidth)
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
    roundedRect(context, -radius, -radius * 0.72, radius * 2, radius * 1.44, 4)
    context.fill()
    context.stroke()
    context.fillStyle = '#2b335a'
    context.fillRect(-radius * 0.12, -radius * 0.92, radius * 1.02, radius * 0.28)
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
    const size = selected ? 22 : 18
    context.fillStyle = selected ? '#aab88d' : '#20221d'
    context.strokeStyle = selected ? '#d5d9ca' : '#777d6a'
    context.lineWidth = 1
    context.fillRect(-size / 2, -size / 2, size, size)
    context.strokeRect(-size / 2, -size / 2, size, size)
    context.font = '600 8px ui-sans-serif, sans-serif'
    context.textAlign = 'center'
    context.fillStyle = selected ? '#121311' : '#a4a39b'
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

ui.signalStrip.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-link-node]')
  const id = Number(button?.dataset.linkNode)
  if (Number.isFinite(id)) linkNodeToRoute(id)
})

ui.commandChoice.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-command]')
  if (button?.dataset.command) setCommand(button.dataset.command as CommandKind)
})

ui.launch.addEventListener('click', launchWave)
ui.continueButton.addEventListener('click', advanceRound)
ui.command.addEventListener('click', activateCommand)
ui.evolutionGrid.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-mutation]')
  if (button?.dataset.mutation) selectMutation(button.dataset.mutation as MutationId)
})

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
  if (event.code === 'KeyE' && phase === 'battle') activateCommand()
})

window.addEventListener('resize', resizeCanvas)

rebuildDefense()
updateUI()
resizeCanvas()
requestAnimationFrame(frame)
