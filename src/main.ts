import './style.css'
import {
  beamsAt,
  DELTAS,
  firesOn,
  initialState,
  isPlatePressed,
  isTurretActive,
  move,
  plateIndex,
  positionKey,
  relayIndex,
  requiredRelays,
  samePosition,
  tileAt,
  type Action,
  type GameState,
  type Level
} from './engine'
import { LEVELS } from './levels'
import { decodeLevel, encodeLevel, SHARE_PREFIX } from './share'
import { solve } from './solver'
import { sprite } from './sprites'
import { loadProgress, restoreAttempt, saveProgress } from './storage'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing app root')
const progress = loadProgress(LEVELS.map((level) => level.id))
/** Levels open in order: the first one, anything already cleared, and the one after a clear. */
const isUnlocked = (index: number): boolean =>
  index === 0 || !!progress.best[LEVELS[index]!.id] || !!progress.best[LEVELS[index - 1]!.id]
if (!isUnlocked(progress.selected)) {
  progress.selected = 0
  progress.attempt = []
}
let selected = progress.selected
let level: Level = LEVELS[selected]!
/** A puzzle opened from a share link; it never touches campaign progress. */
let shared: Level | null = null
const restored = restoreAttempt(level, progress.attempt)
let state = restored.state
let history: GameState[] = restored.history
progress.attempt = restored.actions
let preview = 1
let hintOpen = false
let notice = state.status === 'caught' ? '被击中。可撤回上一步。' : ''
let storageAvailable = true
let dialogTrigger: HTMLElement | null = null

app.innerHTML = `
  <main class="shell">
    <div class="top-row">
      <h1 class="game-title">破阵</h1>
      <span class="step-count"><span id="turn-count">0</span> 步 · 最少 <span id="par-inline">8</span></span>
    </div>
    <div id="board" class="board" role="group" aria-label="棋盘；方向键移动，空格等待，Z 撤回，点炮台预览火力" aria-describedby="board-instructions"></div>
    <div class="play-toolbar">
      <button id="levels-button" type="button" title="选择关卡">第 <span id="level-number">1</span> 关</button>
      <button id="undo-button" type="button" title="撤回 · Z">撤回</button>
      <div class="turn-action">
        <button id="wait-button" type="button">等待<span class="wait-warning" aria-hidden="true" hidden>!</span></button>
        <button id="next-button" type="button" hidden>下一关</button>
      </div>
      <button id="help-button" type="button" aria-label="更多：说明、提示与设置">更多</button>
    </div>
    <div class="status-line">
      <p id="board-instructions" class="board-instructions"></p>
      <p id="board-caption" class="preview-notice" role="status" hidden></p>
      <p id="feedback" class="feedback" role="status" aria-live="polite" aria-atomic="true"></p>
      <p id="save-warning" class="feedback" role="status" hidden></p>
      <section id="result" class="result" role="status" aria-label="通关结果" hidden>
        <h2 id="result-title">已通关</h2><p id="result-copy"></p>
      </section>
    </div>
  </main>
  <dialog id="levels-dialog" class="dialog" aria-labelledby="levels-title">
    <div class="dialog-top"><h2 id="levels-title">关卡</h2><button type="button" data-close="levels-dialog" aria-label="返回棋盘">返回</button></div>
    <p class="menu-note">已完成 <span id="completion-count">0 / ${LEVELS.length}</span></p>
    <div id="level-groups"></div>
  </dialog>
  <dialog id="help-dialog" class="dialog" aria-labelledby="help-title">
    <div class="dialog-top"><h2 id="help-title"><span id="level-title"></span></h2><button type="button" data-close="help-dialog" aria-label="返回棋盘">返回</button></div>
    <p class="menu-note">最少 <span id="par-count">8</span> 步<span id="best-score"></span></p>
    <details class="instructions">
      <summary>怎么玩</summary>
      <p>点相邻格移动，点小人或“等待”原地等一步。踩下全部开关，再走到出口。</p>
      <p>红线是下一步的射击。炮台下的三个点是它未来三步的节奏：实心射击，空心停火。点炮台可预览后两步，不消耗步数。</p>
      <p>踩下 A 后，标 A 的炮台永久停火；标 +A 的炮台反而从此开始射击。</p>
      <p>X 是压板：人或箱子压在上面时，标 X 的炮台停火，离开就恢复。</p>
      <p>箱子能推不能拉，可以挡炮。走错可以撤回。</p>
      <p>前两关会标出每一步是否安全；之后要自己推算，也可以在这里打开“标记”。</p>
      <p class="menu-note">方向键移动，空格等待，Z 撤回，R 重来。</p>
    </details>
    <div class="menu-actions"><button id="hint-button" type="button" aria-expanded="false" aria-controls="hint">提示</button><button id="reset-button" type="button" title="重来 · R">重来</button><button id="assist-button" type="button" aria-pressed="false">标记：关</button><button id="theme-button" type="button" aria-label="切换为浅色">浅色</button><button id="share-button" type="button">复制关卡链接</button></div>
    <p id="share-note" class="menu-note share-note" hidden></p>
    <p id="hint" class="hint" hidden></p>
    <div class="forecast-tabs" role="group" aria-label="预览未来火力"><span>预览</span><button type="button" data-preview="1" aria-pressed="true">下一步</button><button type="button" data-preview="2" aria-pressed="false">第 2 步</button><button type="button" data-preview="3" aria-pressed="false">第 3 步</button></div>
    <p class="menu-note">按当前方块和开关位置计算。</p>
    <p id="save-note" class="menu-note save-note" hidden></p>
  </dialog>
`

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing ${id}`)
  return element as T
}
const board = byId('board')
const feedback = byId('feedback')
const cells: HTMLButtonElement[] = []

function persist(): void {
  storageAvailable = saveProgress(progress)
  byId('save-note').textContent = storageAvailable
    ? progress.attempt.length > 4096
      ? '本局超过保存步数上限；通关记录仍会保存'
      : ''
    : '浏览器未允许保存'
  byId('save-note').hidden = !byId('save-note').textContent
  byId('save-warning').hidden = storageAvailable
  byId('save-warning').textContent = storageAvailable ? '' : '本次进度无法保存。'
}
function setTheme(): void {
  document.documentElement.dataset.theme = progress.theme
  const themeButton = byId('theme-button')
  themeButton.textContent = progress.theme === 'light' ? '深色' : '浅色'
  themeButton.setAttribute('aria-label', progress.theme === 'light' ? '切换为深色' : '切换为浅色')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', progress.theme === 'light' ? '#f3f4ef' : '#1c211d')
}
function setAssist(): void {
  const button = byId('assist-button')
  button.textContent = progress.assist ? '标记：开' : '标记：关'
  button.setAttribute('aria-pressed', String(progress.assist))
}
function buildBoard(): void {
  board.replaceChildren()
  cells.length = 0
  board.style.setProperty('--size', String(level.map.length))
  level.map.forEach((row, y) =>
    [...row].forEach((_, x) => {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'cell'
      cell.dataset.x = String(x)
      cell.dataset.y = String(y)
      cell.tabIndex = -1
      cell.addEventListener('click', (event) => {
        if (suppressClick && event.detail > 0) {
          suppressClick = false
          return
        }
        if (level.turrets.some((turret) => turret.position.x === x && turret.position.y === y)) {
          if (state.status === 'playing') {
            preview = (preview % 3) + 1
            notice = ''
            render()
          }
          return
        }
        const dx = x - state.player.x,
          dy = y - state.player.y
        if (!dx && !dy) act('wait')
        else if (Math.abs(dx) + Math.abs(dy) === 1)
          act(dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up')
        else announce('只能移动到相邻格。')
      })
      cells.push(cell)
      board.append(cell)
    })
  )
  const beams = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  beams.classList.add('beam-layer')
  beams.setAttribute('viewBox', `0 0 ${level.map[0]!.length} ${level.map.length}`)
  beams.setAttribute('aria-hidden', 'true')
  board.append(beams)
}

function announce(message: string): void {
  notice = message
  feedback.textContent = message
  if (message) byId('board-instructions').hidden = true
}
function render(): void {
  const ended = state.status !== 'playing'
  const caught = state.status === 'caught'
  const won = state.status === 'won'
  const shownTurn = caught ? state.turn : state.turn + preview
  const beams = won ? [] : beamsAt(level, state, shownTurn)
  const dangerous = new Set(beams.flatMap((beam) => beam.cells.map(positionKey)))
  board.dataset.status = state.status
  board.dataset.preview = String(preview)
  byId('levels-button').innerHTML = shared
    ? '分享关卡'
    : `第 <span id="level-number">${selected + 1}</span> 关`
  byId('level-title').textContent = level.title
  byId('turn-count').textContent = String(state.turn)
  byId('par-inline').textContent = String(level.par)
  byId('par-count').textContent = String(level.par)
  // Opening line for the level's new idea; it gives way to feedback after the first action.
  byId('board-instructions').textContent = level.description
  byId('board-instructions').hidden =
    !level.description ||
    state.turn !== 0 ||
    (!shared && !!progress.best[level.id]) ||
    preview !== 1 ||
    !!notice
  byId('completion-count').textContent = `${Object.keys(progress.best).length} / ${LEVELS.length}`
  byId('board-caption').hidden = preview === 1 || ended
  byId('board-caption').textContent = `第 ${state.turn + preview} 步射击 · 仅预览`
  const best = shared ? undefined : progress.best[level.id]
  byId('best-score').textContent = best ? `，个人最佳 ${best} 步` : ''
  // Past the opening puzzles, players judge each step's safety from beams and rhythm themselves.
  const assisted = !!level.tutorial || progress.assist

  const focusWasOnPlayer = document.activeElement?.classList.contains('is-player')
  for (const cell of cells) {
    const position = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) }
    const tile = tileAt(level, position)
    const turret = level.turrets.find((t) => samePosition(t.position, position))
    const crate = state.crates.some((c) => samePosition(c, position))
    const player = samePosition(position, state.player)
    const relay = relayIndex(tile)
    const plate = plateIndex(tile)
    const collected = relay >= 0 && !!(state.collected & (1 << relay))
    const danger = dangerous.has(positionKey(position))
    const distance = Math.abs(position.x - state.player.x) + Math.abs(position.y - state.player.y)
    const direction: Action =
      position.x > state.player.x
        ? 'right'
        : position.x < state.player.x
          ? 'left'
          : position.y > state.player.y
            ? 'down'
            : 'up'
    const result = distance === 1 && !ended ? move(level, state, direction) : null
    const available = !!result?.changed
    const safe = result?.state.status !== 'caught'
    let content = ''
    let name = '空地'
    if (tile === '#') {
      content = ''
      name = '墙'
    } else if (turret) {
      const rotation = { up: 0, right: 90, down: 180, left: 270 }[turret.direction]
      const active = isTurretActive(level, turret, state)
      const silenced = turret.relay !== undefined && !!(state.collected & (1 << turret.relay))
      const letter =
        turret.relay !== undefined
          ? 'AB'[turret.relay]!
          : turret.arm !== undefined
            ? `+${'AB'[turret.arm]}`
            : turret.plate !== undefined
              ? 'XY'[turret.plate]!
              : ''
      const upcoming = Array.from({ length: 3 }, (_, index) =>
        firesOn(turret, state.turn + index + 1)
      )
      const firing = beams.some((beam) => beam.turretId === turret.id)
      content = `<span class="turret-mark ${active ? '' : 'off'} ${firing ? 'firing' : ''}">${sprite('turret', rotation)}<small>${letter}</small></span>${silenced || ended ? '' : `<span class="turret-beats ${active ? '' : 'idle'}" aria-hidden="true">${upcoming.map((fires) => `<i class="${fires ? 'fire' : ''}"></i>`).join('')}</span>`}`
      const waiting = silenced
        ? '，已永久停火'
        : active
          ? ''
          : turret.arm !== undefined && !(state.collected & (1 << turret.arm))
            ? `，踩下 ${'AB'[turret.arm]} 后启动`
            : '，压板压下，暂停射击'
      name = `${letter || turret.id} 炮台${waiting}${silenced || ended ? '' : `，节奏未来三步：${upcoming.map((fires) => (fires ? '射击' : '停火')).join('、')}`}`
    } else if (crate) {
      content = `<span class="crate-mark">${sprite('crate')}</span>${plate >= 0 || relay >= 0 ? `<span class="tile-caption">${tile.toUpperCase()}</span>` : ''}`
      name = `可推动的掩体${plate >= 0 ? `，压着 ${tile.toUpperCase()} 压板` : ''}`
    } else if (plate >= 0) {
      const pressed = isPlatePressed(level, state, plate)
      content = `<span class="plate-mark ${pressed ? 'pressed' : ''}">${sprite(pressed ? 'platePressed' : 'plate')}</span><span class="tile-caption">${tile.toUpperCase()}</span>`
      name = `${tile.toUpperCase()} 压板${pressed ? '，已压下' : ''}`
    } else if (tile === 'E') {
      content = `<span class="exit-mark ${state.collected === requiredRelays(level) ? 'open' : ''}">${sprite(state.collected === requiredRelays(level) ? 'exitOpen' : 'exit')}</span><span class="tile-caption">出口</span>`
      name = `出口，${state.collected === requiredRelays(level) ? '已开启' : '需要触发所有开关'}`
    } else if (relay >= 0) {
      content = `<span class="relay-mark ${collected ? 'off' : ''}">${sprite(collected ? 'switchOn' : 'switch')}</span><span class="tile-caption">${tile.toUpperCase()}</span>`
      name = `${tile.toUpperCase()} 开关${collected ? '，已触发' : ''}`
    }
    if (player) {
      content += `<span class="player-mark ${caught ? 'caught' : ''}">${sprite('player')}${caught ? '<span class="hit-mark">×</span>' : ''}</span>`
      name += '，你在这里'
    } else if (available)
      content += `<span class="move-dot ${assisted && !safe ? 'risky' : ''} ${tile === 'E' || relay >= 0 || plate >= 0 || crate ? 'corner' : ''}">${assisted && !safe ? '×' : ''}</span>`
    const edge =
      position.x === 0 ||
      position.y === 0 ||
      position.x === level.map[0]!.length - 1 ||
      position.y === level.map.length - 1
    cell.className = `cell ${(position.x + position.y) % 2 ? 'shade' : ''} ${tile === '#' ? `wall ${edge ? 'outer-wall' : ''}` : ''} ${turret ? 'turret' : ''} ${crate ? 'crate' : ''} ${player ? 'is-player' : ''} ${danger ? 'danger' : ''} ${available ? 'reachable' : ''} ${assisted && available && !safe ? 'risky-move' : ''}`
    cell.innerHTML = content
    cell.tabIndex = player || (turret && !ended) ? 0 : -1
    cell.title = turret && !ended ? '点按切换火力预览，不计步数' : ''
    cell.setAttribute(
      'aria-label',
      `${position.y + 1} 行 ${position.x + 1} 列，${name}${turret && !ended ? '，可切换火力预览' : ''}${danger ? '，预览火线经过' : ''}${available ? (!assisted ? '，可以移动' : safe ? '，这一步可安全到达' : '，这一步会被击中') : ''}`
    )
    cell.setAttribute('aria-disabled', String(ended || (!player && !available && !turret)))
  }
  if (focusWasOnPlayer)
    cells.find((cell) => cell.classList.contains('is-player'))?.focus({ preventScroll: true })
  const layer = board.querySelector<SVGSVGElement>('.beam-layer')!
  layer.innerHTML = beams
    .map((beam) => {
      const first = beam.cells[0],
        last = beam.cells.at(-1)
      if (!first || !last) return ''
      const delta = DELTAS[beam.direction]
      return `<path d="M ${first.x + 0.5 - delta.x * 0.45} ${first.y + 0.5 - delta.y * 0.45} L ${last.x + 0.5 + delta.x * 0.45} ${last.y + 0.5 + delta.y * 0.45}"/>`
    })
    .join('')
  byId<HTMLButtonElement>('undo-button').disabled = history.length === 0
  byId<HTMLButtonElement>('reset-button').disabled = history.length === 0
  byId<HTMLButtonElement>('wait-button').disabled = ended
  const unsafeWait = assisted && !ended && move(level, state, 'wait').state.status === 'caught'
  byId('wait-button').classList.toggle('unsafe-wait', unsafeWait)
  byId('wait-button').setAttribute('aria-label', unsafeWait ? '等待! 这一步会被击中' : '等待一步')
  byId('wait-button').querySelector<HTMLElement>('.wait-warning')!.hidden = !unsafeWait
  byId('wait-button').hidden = won
  byId('next-button').hidden = !won
  feedback.textContent = notice
  feedback.classList.toggle('error', caught)
  byId('result').hidden = !won
  byId('board-instructions').hidden ||= won
  document.querySelectorAll<HTMLButtonElement>('button[data-preview]').forEach((button) => {
    button.disabled = ended
  })
  if (won) {
    byId('result-title').textContent = '已通关'
    byId('result-copy').textContent =
      state.turn <= level.par ? '已达最少步数。' : `最少 ${level.par} 步，还能更短。`
    byId('next-button').textContent = shared
      ? '返回'
      : selected === LEVELS.length - 1
        ? '选关'
        : '下一关'
  }
  document
    .querySelectorAll<HTMLButtonElement>('button[data-preview]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(Number(button.dataset.preview) === preview))
    )
  byId('hint').textContent = level.hint
  byId('hint').hidden = !hintOpen
  byId('hint-button').setAttribute('aria-expanded', String(hintOpen))
}

function act(action: Action): void {
  const result = move(level, state, action)
  if (!result.changed) {
    if (result.reason === 'ended') return
    announce(result.reason === 'crate' ? '方块后面没有空位。' : '这里不能走。')
    return
  }
  history.push(state)
  if (!shared) progress.attempt.push(action)
  state = result.state
  preview = 1
  const messages = {
    moved: '',
    waited: '',
    pushed: '',
    relay: '',
    caught: '被击中。可撤回上一步。',
    won: ''
  }
  notice = messages[result.reason as keyof typeof messages] ?? ''
  if (state.status === 'won' && !shared) {
    progress.best[level.id] = Math.min(progress.best[level.id] ?? Infinity, state.turn)
  }
  persist()
  render()
  if (state.status === 'won') byId('next-button').focus({ preventScroll: true })
  else if (state.status === 'caught') byId('undo-button').focus({ preventScroll: true })
}
function undo(): void {
  const previous = history.pop()
  if (!previous) return
  state = previous
  if (!shared) progress.attempt.pop()
  persist()
  preview = 1
  notice = ''
  render()
  cells.find((cell) => cell.classList.contains('is-player'))?.focus({ preventScroll: true })
}
function selectLevel(index: number): void {
  if (shared) {
    shared = null
    if (location.hash.startsWith(SHARE_PREFIX))
      window.history.replaceState(null, '', location.pathname + location.search)
  }
  selected = index
  level = LEVELS[index]!
  state = initialState(level)
  history = []
  progress.attempt = []
  preview = 1
  hintOpen = false
  notice = ''
  progress.selected = index
  persist()
  buildBoard()
  render()
}
/** Back from a share link to the campaign run that was in progress. */
function leaveShared(): void {
  shared = null
  if (location.hash.startsWith(SHARE_PREFIX))
    window.history.replaceState(null, '', location.pathname + location.search)
  level = LEVELS[selected]!
  const restored = restoreAttempt(level, progress.attempt)
  state = restored.state
  history = restored.history
  progress.attempt = restored.actions
  preview = 1
  hintOpen = false
  notice = ''
  buildBoard()
  render()
}
function restart(): void {
  if (!shared) return selectLevel(selected)
  state = initialState(shared)
  history = []
  preview = 1
  notice = ''
  render()
}
/** Opens `#level=…` links. Returns false (with a notice) when the link is broken or unsolvable. */
function openSharedLevel(): boolean {
  if (!location.hash.startsWith(SHARE_PREFIX)) return false
  const decoded = decodeLevel(location.hash)
  const path = 'level' in decoded ? solve(decoded.level) : null
  if (!('level' in decoded) || !path) {
    announce('error' in decoded ? decoded.error : '这个分享关卡无解。')
    render()
    return false
  }
  shared = { ...decoded.level, par: path.length }
  level = shared
  state = initialState(level)
  history = []
  preview = 1
  hintOpen = false
  notice = ''
  buildBoard()
  render()
  return true
}
function openDialog(id: string, trigger = document.activeElement as HTMLElement | null): void {
  dialogTrigger = trigger
  if (id === 'levels-dialog') {
    const chapters = [...new Set(LEVELS.map((item) => item.chapter))]
    byId('level-groups').innerHTML = chapters
      .map(
        (chapter) =>
          `<h3 class="chapter-title">${chapter}</h3><div class="level-list">${LEVELS.map(
            (item, index) => {
              if (item.chapter !== chapter) return ''
              const best = progress.best[item.id]
              const current = index === selected && !shared
              if (!isUnlocked(index))
                return `<button class="level-choice" type="button" data-level="${index}" disabled aria-label="${index + 1}，未解锁"><span class="level-index">${index + 1}</span><span class="level-record"></span></button>`
              return `<button class="level-choice ${current ? 'selected' : ''}" type="button" data-level="${index}" title="${item.title}" aria-label="${index + 1}${best ? ` ${best} 步` : ''}，${item.title}" ${current ? 'aria-current="true"' : ''}><span class="level-index">${index + 1}</span><span class="level-record" aria-label="${best ? (best <= item.par ? '已找到最短解' : '已通关') : '未通关'}">${best ? `${best} 步` : ''}</span></button>`
            }
          ).join('')}</div>`
      )
      .join('')
    byId('level-groups')
      .querySelectorAll<HTMLButtonElement>('[data-level]')
      .forEach((button) =>
        button.addEventListener('click', () => {
          selectLevel(Number(button.dataset.level))
          byId<HTMLDialogElement>(id).close()
        })
      )
  }
  if (id === 'help-dialog') byId('share-note').hidden = true
  byId<HTMLDialogElement>(id).showModal()
  byId(id).querySelector<HTMLButtonElement>('button')?.focus()
}
byId('undo-button').addEventListener('click', undo)
byId('wait-button').addEventListener('click', () => act('wait'))
byId('reset-button').addEventListener('click', () => {
  restart()
  byId<HTMLDialogElement>('help-dialog').close()
})
byId('next-button').addEventListener('click', () => {
  if (shared) leaveShared()
  else if (selected === LEVELS.length - 1) openDialog('levels-dialog')
  else {
    selectLevel(selected + 1)
    board.scrollIntoView({ block: 'nearest' })
    cells.find((cell) => cell.classList.contains('is-player'))?.focus({ preventScroll: true })
  }
})
byId('levels-button').addEventListener('click', () =>
  openDialog('levels-dialog', byId('levels-button'))
)
byId('help-button').addEventListener('click', () => openDialog('help-dialog', byId('help-button')))
byId('theme-button').addEventListener('click', () => {
  progress.theme = progress.theme === 'light' ? 'dark' : 'light'
  setTheme()
  persist()
})
byId('assist-button').addEventListener('click', () => {
  progress.assist = !progress.assist
  setAssist()
  persist()
  render()
})
byId('share-button').addEventListener('click', async () => {
  const note = byId('share-note')
  const url = `${location.origin}${location.pathname}${encodeLevel(level)}`
  try {
    await navigator.clipboard.writeText(url)
    note.textContent = '链接已复制。'
  } catch {
    // Clipboard can be blocked; the link is still selectable here.
    note.textContent = url
  }
  note.hidden = false
})
byId('hint-button').addEventListener('click', () => {
  hintOpen = !hintOpen
  render()
})
document.querySelectorAll<HTMLButtonElement>('button[data-preview]').forEach((button) =>
  button.addEventListener('click', () => {
    preview = Number(button.dataset.preview)
    notice = ''
    render()
    byId<HTMLDialogElement>('help-dialog').close()
  })
)
document
  .querySelectorAll<HTMLButtonElement>('[data-close]')
  .forEach((button) =>
    button.addEventListener('click', () => byId<HTMLDialogElement>(button.dataset.close!).close())
  )
document.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
  dialog.addEventListener('close', () => dialogTrigger?.focus({ preventScroll: true }))
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    const buttons = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), summary')]
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement as HTMLElement)
    const next = (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
    event.preventDefault()
    buttons[next]?.focus()
  })
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return
    const bounds = dialog.getBoundingClientRect()
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close()
  })
})
window.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey)
    return
  const actions: Record<string, Action> = {
    ArrowUp: 'up',
    ArrowRight: 'right',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    w: 'up',
    d: 'right',
    s: 'down',
    a: 'left'
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (event.repeat) {
    if (actions[key] || key === ' ') event.preventDefault()
    return
  }
  if (actions[key]) {
    event.preventDefault()
    act(actions[key])
  } else if (
    key === ' ' &&
    (document.activeElement === document.body ||
      (document.activeElement?.classList.contains('cell') &&
        !document.activeElement.classList.contains('turret')))
  ) {
    event.preventDefault()
    act('wait')
  } else if (key === 'z' || key === 'Backspace') {
    event.preventDefault()
    undo()
  } else if (key === 'r') {
    event.preventDefault()
    restart()
  }
})
let touchStart: { x: number; y: number } | null = null
let suppressClick = false
board.addEventListener('pointerdown', (event) => {
  suppressClick = false
  if (event.pointerType === 'touch') touchStart = { x: event.clientX, y: event.clientY }
})
board.addEventListener('pointerup', (event) => {
  if (!touchStart) return
  const dx = event.clientX - touchStart.x,
    dy = event.clientY - touchStart.y
  touchStart = null
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
  suppressClick = true
  act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
})
board.addEventListener('pointercancel', () => {
  touchStart = null
})
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith(SHARE_PREFIX)) openSharedLevel()
  else if (shared) leaveShared()
})
setTheme()
setAssist()
buildBoard()
render()
openSharedLevel()
