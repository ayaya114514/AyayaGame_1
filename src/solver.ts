import {
  ACTIONS,
  cycleLength,
  initialState,
  move,
  positionKey,
  type Action,
  type GameState,
  type Level
} from './engine'

const stateKey = (period: number) => (state: GameState) =>
  `${positionKey(state.player)}|${state.crates.map(positionKey).sort().join(';')}|${state.collected}|${state.turn % period}`

/** Breadth-first search across position, movable cover, relays and the joint firing cycle. */
export function solve(
  level: Level,
  start = initialState(level),
  maxStates = 300_000,
  actions: readonly Action[] = ACTIONS
): Action[] | null {
  if (start.status === 'won') return []
  if (start.status !== 'playing') return null
  const key = stateKey(cycleLength(level))
  const nodes: { state: GameState; parent: number; action: Action | null }[] = [
    { state: start, parent: -1, action: null }
  ]
  const visited = new Set([key(start)])
  for (let index = 0; index < nodes.length && nodes.length <= maxStates; index++) {
    const current = nodes[index]!
    for (const action of actions) {
      const result = move(level, current.state, action)
      if (!result.changed || result.state.status === 'caught') continue
      if (result.state.status === 'won') {
        const path: Action[] = [action]
        let back = index
        while (back > 0) {
          const node = nodes[back]!
          path.push(node.action!)
          back = node.parent
        }
        return path.reverse()
      }
      const signature = key(result.state)
      if (visited.has(signature)) continue
      visited.add(signature)
      nodes.push({ state: result.state, parent: index, action })
    }
  }
  return null
}

/** Number of distinct shortest action sequences; a low count means one key idea, not many detours. */
export function countShortestSolutions(level: Level, maxStates = 300_000): number {
  const key = stateKey(cycleLength(level))
  const start = initialState(level)
  const ways = new Map([[key(start), 1]])
  const states = new Map([[key(start), start]])
  let frontier = [key(start)]
  while (frontier.length && ways.size <= maxStates) {
    const next = new Map<string, number>()
    let wins = 0
    for (const signature of frontier) {
      const count = ways.get(signature)!
      for (const action of ACTIONS) {
        const result = move(level, states.get(signature)!, action)
        if (!result.changed || result.state.status === 'caught') continue
        if (result.state.status === 'won') {
          wins += count
          continue
        }
        const child = key(result.state)
        if (ways.has(child) && !next.has(child)) continue
        if (!next.has(child)) states.set(child, result.state)
        next.set(child, (next.get(child) ?? 0) + count)
      }
    }
    if (wins) return wins
    for (const [signature, count] of next) ways.set(signature, count)
    frontier = [...next.keys()]
  }
  return 0
}
