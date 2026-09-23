import './style.css'
import {
  beamsAt,
  DELTAS,
  firesOn,
  initialState,
  isTurretDisabled,
  move,
  positionKey,
  relayIndex,
  requiredRelays,
  samePosition,
  tileAt,
  type Action,
  type GameState
} from './engine'
import { LEVELS } from './levels'
import { sprite } from './sprites'
import { loadProgress, restoreAttempt, saveProgress } from './storage'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing app root')
const progress = loadProgress(LEVELS.map((level) => level.id))
let selected = progress.selected
let level = LEVELS[selected]!
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
    <h1 class="game-title">破阵</h1>
    <div id="board" class="board" role="group" aria-label="棋盘；方向键移动，空格等待，Z 撤回，点炮台预览火力" aria-describedby="board-instructions"></div>
    <div class="play-toolbar">
      <button id="levels-button" type="button" title="选择关卡">第 <span id="level-number">1</span> 关</button>
      <span class="step-count"><span id="turn-count">0</span> 步</span>
      <button id="undo-button" type="button" title="撤回 · Z">撤回</button>
      <div class="turn-action">
        <button id="wait-button" type="button">等待<span class="wait-warning" aria-hidden="true" hidden>!</span></button>
        <button id="next-button" type="button" hidden>下一关</button>
      </div>
      <button id="help-button" type="button" aria-label="更多：说明、提示与设置">更多</button>
    </div>
    <div class="status-line">
      <p id="board-instructions" class="board-instructions">点相邻位置移动，触发 A 后到出口。</p>
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
    <div id="level-list" class="level-list"></div>
  </dialog>
  <dialog id="help-dialog" class="dialog" aria-labelledby="help-title">
    <div class="dialog-top"><h2 id="help-title"><span id="level-title"></span></h2><button type="button" data-close="help-dialog" aria-label="返回棋盘">返回</button></div>
    <p class="menu-note">最少 <span id="par-count">8</span> 步<span id="best-score"></span></p>
    <details class="instructions">
      <summary>怎么玩</summary>
      <p>点相邻格移动，点小人等待。踩下全部开关，再走到出口。</p>
      <p>红线是下步射击。点炮台可预览后两步，不消耗步数。下方三个点始终表示未来三步：实心射击，空心停火。</p>
      <p>箱子能推，不能拉，可以挡炮。墙块不能通过。走错可以撤回。</p>
      <p class="menu-note">方向键移动，空格等待，Z 撤回，R 重来。</p>
    </details>
    <div class="menu-actions"><button id="hint-button" type="button" aria-expanded="false" aria-controls="hint">提示</button><button id="reset-button" type="button" title="重来 · R">重来</button><button id="theme-button" type="button" aria-label="切换为深色">深色</button></div>
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
  byId('level-number').textContent = `${selected + 1}`
  byId('level-title').textContent = level.title
  byId('turn-count').textContent = String(state.turn)
  byId('par-count').textContent = String(level.par)
  const introductory = selected === 0 || level.id === 'moving-cover'
  byId('board-instructions').textContent =
    level.id === 'moving-cover' ? '箱子能推，也能挡炮。' : '点相邻格移动，踩下 A，再到出口。'
  byId('board-instructions').hidden =
    !introductory || state.turn !== 0 || !!progress.best[level.id] || preview !== 1 || !!notice
  byId('completion-count').textContent = `${Object.keys(progress.best).length} / ${LEVELS.length}`
  byId('board-caption').hidden = preview === 1 || ended
  byId('board-caption').textContent = `第 ${state.turn + preview} 步射击 · 仅预览`
  const best = progress.best[level.id]
  byId('best-score').textContent = best ? `，个人最佳 ${best} 步` : ''

  const focusWasOnPlayer = document.activeElement?.classList.contains('is-player')
  for (const cell of cells) {
    const position = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) }
    const tile = tileAt(level, position)
    const turret = level.turrets.find((t) => samePosition(t.position, position))
    const crate = state.crates.some((c) => samePosition(c, position))
    const player = samePosition(position, state.player)
    const relay = relayIndex(tile)
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
    const disabled = turret ? isTurretDisabled(turret, state.collected) : false
    let content = ''
    let name = '空地'
    if (tile === '#') {
      content = ''
      name = '墙'
    } else if (turret) {
      const rotation = { up: 0, right: 90, down: 180, left: 270 }[turret.direction]
      const letter = turret.relay === undefined ? '' : String.fromCharCode(65 + turret.relay)
      const upcoming = Array.from({ length: 3 }, (_, index) =>
        firesOn(turret, state.turn + index + 1, state.collected)
      )
      content = `<span class="turret-mark ${disabled ? 'off' : ''} ${firesOn(turret, shownTurn, state.collected) ? 'firing' : ''}">${sprite('turret', rotation)}<small>${letter}</small></span>${disabled || ended ? '' : `<span class="turret-beats" aria-hidden="true">${upcoming.map((fires) => `<i class="${fires ? 'fire' : ''}"></i>`).join('')}</span>`}`
      name = `${letter || turret.id} 炮台${disabled ? '，已关闭' : ended ? '' : `，未来三步：${upcoming.map((fires) => (fires ? '射击' : '停火')).join('、')}`}`
    } else if (crate) {
      content = `<span class="crate-mark">${sprite('crate')}</span>`
      name = '可推动的掩体'
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
      content += `<span class="move-dot ${safe ? '' : 'risky'} ${tile === 'E' || relay >= 0 || crate ? 'corner' : ''}">${safe ? '' : '×'}</span>`
    const edge =
      position.x === 0 ||
      position.y === 0 ||
      position.x === level.map[0]!.length - 1 ||
      position.y === level.map.length - 1
    cell.className = `cell ${(position.x + position.y) % 2 ? 'shade' : ''} ${tile === '#' ? `wall ${edge ? 'outer-wall' : ''}` : ''} ${turret ? 'turret' : ''} ${crate ? 'crate' : ''} ${player ? 'is-player' : ''} ${danger ? 'danger' : ''} ${available ? 'reachable' : ''} ${available && !safe ? 'risky-move' : ''}`
    cell.innerHTML = content
    cell.tabIndex = player || (turret && !ended) ? 0 : -1
    cell.title = turret && !ended ? '点按切换火力预览，不计步数' : ''
    cell.setAttribute(
      'aria-label',
      `${position.y + 1} 行 ${position.x + 1} 列，${name}${turret && !ended ? '，可切换火力预览' : ''}${danger ? '，预览火线经过' : ''}${available ? (safe ? '，这一步可安全到达' : '，这一步会被击中') : ''}`
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
  const unsafeWait = !ended && move(level, state, 'wait').state.status === 'caught'
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
      state.turn <= level.par ? '已达最少步数。' : `最少 ${level.par} 步。`
    byId('next-button').textContent = selected === LEVELS.length - 1 ? '选关' : '下一关'
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
  progress.attempt.push(action)
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
  if (state.status === 'won') {
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
  progress.attempt.pop()
  persist()
  preview = 1
  notice = ''
  render()
  cells.find((cell) => cell.classList.contains('is-player'))?.focus({ preventScroll: true })
}
function selectLevel(index: number): void {
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
function openDialog(id: string, trigger = document.activeElement as HTMLElement | null): void {
  dialogTrigger = trigger
  if (id === 'levels-dialog') {
    byId('level-list').innerHTML = LEVELS.map((item, index) => {
      const best = progress.best[item.id]
      return `<button class="level-choice ${index === selected ? 'selected' : ''}" type="button" data-level="${index}" title="${item.title}" aria-label="${index + 1}${best ? ` ${best} 步` : ''}，${item.title}" ${index === selected ? 'aria-current="true"' : ''}><span class="level-index">${index + 1}</span><span class="level-record" aria-label="${best ? (best <= item.par ? '已找到最短解' : '已通关') : '未通关'}">${best ? `${best} 步` : ''}</span></button>`
    }).join('')
    byId('level-list')
      .querySelectorAll<HTMLButtonElement>('[data-level]')
      .forEach((button) =>
        button.addEventListener('click', () => {
          selectLevel(Number(button.dataset.level))
          byId<HTMLDialogElement>(id).close()
        })
      )
  }
  byId<HTMLDialogElement>(id).showModal()
  byId(id).querySelector<HTMLButtonElement>('button')?.focus()
}
byId('undo-button').addEventListener('click', undo)
byId('wait-button').addEventListener('click', () => act('wait'))
byId('reset-button').addEventListener('click', () => {
  selectLevel(selected)
  byId<HTMLDialogElement>('help-dialog').close()
})
byId('next-button').addEventListener('click', () => {
  if (selected === LEVELS.length - 1) openDialog('levels-dialog')
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
    selectLevel(selected)
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
setTheme()
buildBoard()
render()
