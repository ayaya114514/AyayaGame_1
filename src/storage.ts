import { ACTIONS, initialState, move, type Action, type GameState, type Level } from './engine'
export type Progress = {
  selected: number
  best: Record<string, number>
  theme: 'light' | 'dark'
  attempt: Action[]
}
export const STORAGE_KEY = 'ayaya-breach-v4'
const fresh = (): Progress => ({ selected: 0, best: {}, theme: 'light', attempt: [] })

export function parseProgress(raw: string | null, levelIds: string[]): Progress {
  const result = fresh()
  if (raw && raw.length > 100_000) return result
  try {
    const data: unknown = JSON.parse(raw ?? 'null')
    if (!data || typeof data !== 'object') return result
    const value = data as Record<string, unknown>
    const validSelection =
      Number.isInteger(value.selected) &&
      Number(value.selected) >= 0 &&
      Number(value.selected) < levelIds.length
    if (validSelection) result.selected = Number(value.selected)
    if (value.theme === 'dark') result.theme = 'dark'
    if (value.best && typeof value.best === 'object') {
      for (const [id, score] of Object.entries(value.best)) {
        if (levelIds.includes(id) && Number.isInteger(score) && score > 0 && score <= 10000)
          result.best[id] = score
      }
    }
    if (
      validSelection &&
      Array.isArray(value.attempt) &&
      value.attempt.length <= 4096 &&
      value.attempt.every((action) => ACTIONS.includes(action))
    )
      result.attempt = [...value.attempt]
  } catch {
    /* A corrupt save must never prevent playing. */
  }
  return result
}

/** Replay validated actions instead of trusting saved coordinates or an arbitrary win flag. */
export function restoreAttempt(
  level: Level,
  actions: Action[]
): { state: GameState; history: GameState[]; actions: Action[] } {
  let state = initialState(level)
  const history: GameState[] = []
  for (const action of actions) {
    const result = move(level, state, action)
    if (!result.changed) return { state: initialState(level), history: [], actions: [] }
    history.push(state)
    state = result.state
  }
  return { state, history, actions: [...actions] }
}

export function loadProgress(levelIds: string[]): Progress {
  try {
    return parseProgress(localStorage.getItem(STORAGE_KEY), levelIds)
  } catch {
    return fresh()
  }
}

export function saveProgress(progress: Progress): boolean {
  try {
    // Runs normally take 8–28 moves. Keep browser storage bounded even for very long play.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...progress,
        attempt: progress.attempt.length <= 4096 ? progress.attempt : []
      })
    )
    return true
  } catch {
    return false
  }
}
