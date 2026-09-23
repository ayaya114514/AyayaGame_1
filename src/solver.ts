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

/** Breadth-first search across position, movable cover, relays and the joint firing cycle. */
export function solve(
  level: Level,
  start = initialState(level),
  maxStates = 300_000
): Action[] | null {
  if (start.status === 'won') return []
  if (start.status !== 'playing') return null
  const period = cycleLength(level)
  const key = (state: GameState) =>
    `${positionKey(state.player)}|${state.crates.map(positionKey).sort().join(';')}|${state.collected}|${state.turn % period}`
  const nodes: { state: GameState; parent: number; action: Action | null }[] = [
    { state: start, parent: -1, action: null }
  ]
  const visited = new Set([key(start)])
  for (let index = 0; index < nodes.length && nodes.length <= maxStates; index++) {
    const current = nodes[index]!
    for (const action of ACTIONS) {
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
