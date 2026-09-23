export type Position = { x: number; y: number }
export type Action = 'up' | 'right' | 'down' | 'left' | 'wait'
export type Direction = Exclude<Action, 'wait'>
export type Turret = {
  id: string
  position: Position
  direction: Direction
  /** Repeats after each action. 1 means firing; 0 means resting. */
  pattern: string
  /** Switch a / b that permanently silences this turret. */
  relay?: number
  /** Switch a / b that starts this turret; it stays silent until then. */
  arm?: number
  /** Plate x / y that silences this turret only while a crate or the player stands on it. */
  plate?: number
}
export type Level = {
  id: string
  title: string
  chapter: string
  description: string
  hint: string
  /** Opening puzzles always show safe / dangerous move markers. */
  tutorial?: boolean
  map: string[]
  turrets: Turret[]
  par: number
}
export type GameState = {
  player: Position
  crates: Position[]
  collected: number
  turn: number
  status: 'playing' | 'caught' | 'won'
}
export type Beam = { turretId: string; cells: Position[]; direction: Direction }
export type MoveResult = {
  state: GameState
  changed: boolean
  reason: 'moved' | 'waited' | 'pushed' | 'relay' | 'wall' | 'crate' | 'ended' | 'caught' | 'won'
}

export const ACTIONS: Action[] = ['up', 'right', 'down', 'left', 'wait']
export const DELTAS: Record<Action, Position> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  wait: { x: 0, y: 0 }
}
export const samePosition = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y
export const positionKey = ({ x, y }: Position): string => `${x},${y}`
export const tileAt = (level: Level, { x, y }: Position): string => level.map[y]?.[x] ?? '#'
export const relayIndex = (tile: string): number =>
  /^[ab]$/.test(tile) ? tile.charCodeAt(0) - 97 : -1
export const plateIndex = (tile: string): number =>
  /^[xy]$/.test(tile) ? tile.charCodeAt(0) - 120 : -1

export function initialState(level: Level): GameState {
  let player: Position | undefined
  const crates: Position[] = []
  level.map.forEach((row, y) =>
    [...row].forEach((tile, x) => {
      if (tile === 'S') player = { x, y }
      if (tile === 'C') crates.push({ x, y })
    })
  )
  if (!player) throw new Error(`Missing start in ${level.id}`)
  return { player, crates, collected: 0, turn: 0, status: 'playing' }
}

export function requiredRelays(level: Level): number {
  return [...level.map.join('')].reduce((mask, tile) => {
    const index = relayIndex(tile)
    return index < 0 ? mask : mask | (1 << index)
  }, 0)
}

/** Plates count as pressed while the player or any crate occupies them. */
export function isPlatePressed(
  level: Level,
  state: Pick<GameState, 'player' | 'crates'>,
  plate: number
): boolean {
  return [state.player, ...state.crates].some(
    (position) => plateIndex(tileAt(level, position)) === plate
  )
}

/** Whether switches and plates currently let this turret fire at all. */
export function isTurretActive(
  level: Level,
  turret: Turret,
  state: Pick<GameState, 'player' | 'crates' | 'collected'>
): boolean {
  if (turret.relay !== undefined && state.collected & (1 << turret.relay)) return false
  if (turret.arm !== undefined && !(state.collected & (1 << turret.arm))) return false
  if (turret.plate !== undefined && isPlatePressed(level, state, turret.plate)) return false
  return true
}

/** The turret's own rhythm, independent of switches and plates. */
export function firesOn(turret: Turret, turn: number): boolean {
  return turret.pattern[(turn - 1) % turret.pattern.length] === '1'
}

function isSolid(level: Level, position: Position): boolean {
  return (
    tileAt(level, position) === '#' || level.turrets.some((t) => samePosition(t.position, position))
  )
}

/** Use the post-move crates, plates and relay mask: push/collect happens before firing. */
export function beamsAt(level: Level, state: GameState, turn = state.turn + 1): Beam[] {
  return level.turrets.flatMap((turret) => {
    if (!firesOn(turret, turn) || !isTurretActive(level, turret, state)) return []
    const cells: Position[] = []
    const delta = DELTAS[turret.direction]
    let position = { x: turret.position.x + delta.x, y: turret.position.y + delta.y }
    while (!isSolid(level, position)) {
      if (state.crates.some((crate) => samePosition(crate, position))) break
      cells.push(position)
      position = { x: position.x + delta.x, y: position.y + delta.y }
    }
    return [{ turretId: turret.id, direction: turret.direction, cells }]
  })
}

/** Pure, deterministic transition shared by UI, forecasts and the level verifier. */
export function move(level: Level, state: GameState, action: Action): MoveResult {
  const unchanged = (reason: MoveResult['reason']): MoveResult => ({
    state,
    changed: false,
    reason
  })
  if (state.status !== 'playing') return unchanged('ended')
  const delta = DELTAS[action]
  const player = { x: state.player.x + delta.x, y: state.player.y + delta.y }
  if (isSolid(level, player)) return unchanged('wall')
  let crates = state.crates
  let reason: MoveResult['reason'] = action === 'wait' ? 'waited' : 'moved'
  const crateIndex = crates.findIndex((crate) => samePosition(crate, player))
  if (crateIndex >= 0) {
    const destination = { x: player.x + delta.x, y: player.y + delta.y }
    if (isSolid(level, destination) || crates.some((crate) => samePosition(crate, destination))) {
      return unchanged('crate')
    }
    crates = crates.map((crate, index) => (index === crateIndex ? destination : crate))
    reason = 'pushed'
  }
  let collected = state.collected
  const tile = tileAt(level, player)
  const relay = relayIndex(tile)
  if (relay >= 0 && !(collected & (1 << relay))) {
    collected |= 1 << relay
    reason = 'relay'
  }
  const next: GameState = { player, crates, collected, turn: state.turn + 1, status: 'playing' }
  if (
    beamsAt(level, next, next.turn).some((beam) =>
      beam.cells.some((cell) => samePosition(cell, player))
    )
  ) {
    next.status = 'caught'
    reason = 'caught'
  } else if (tile === 'E' && collected === requiredRelays(level)) {
    next.status = 'won'
    reason = 'won'
  }
  return { state: next, changed: true, reason }
}

export function cycleLength(level: Level): number {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  return level.turrets.reduce(
    (cycle, turret) => (cycle * turret.pattern.length) / gcd(cycle, turret.pattern.length),
    1
  )
}

export function validateLevel(level: Level): string[] {
  const errors: string[] = []
  const width = level.map[0]?.length ?? 0
  const flat = level.map.join('')
  if (width < 3 || level.map.length < 3 || level.map.some((row) => row.length !== width))
    errors.push('Invalid dimensions')
  if ([...flat].filter((tile) => tile === 'S').length !== 1) errors.push('Expected one start')
  if ([...flat].filter((tile) => tile === 'E').length !== 1) errors.push('Expected one exit')
  if (/[^.#SECabxy]/.test(flat)) errors.push('Unknown tile')
  for (const letter of ['a', 'b', 'x', 'y'])
    if ([...flat].filter((tile) => tile === letter).length > 1) errors.push('Duplicate switch')
  if (!Number.isInteger(level.par) || level.par < 1) errors.push('Invalid par')
  const ids = new Set<string>()
  const positions = new Set<string>()
  for (const turret of level.turrets) {
    if (!/^[01]{1,6}$/.test(turret.pattern) || !turret.pattern.includes('1'))
      errors.push('Invalid firing pattern')
    if (tileAt(level, turret.position) !== '.') errors.push('Turret must occupy an empty tile')
    if (ids.has(turret.id) || positions.has(positionKey(turret.position)))
      errors.push('Duplicate turret')
    for (const relay of [turret.relay, turret.arm])
      if (relay !== undefined && !(requiredRelays(level) & (1 << relay)))
        errors.push('Missing linked relay')
    if (turret.plate !== undefined && !flat.includes('xy'[turret.plate] ?? '?'))
      errors.push('Missing linked plate')
    if (turret.relay !== undefined && turret.arm !== undefined)
      errors.push('Turret cannot be both stopped and started by switches')
    ids.add(turret.id)
    positions.add(positionKey(turret.position))
  }
  return errors
}
