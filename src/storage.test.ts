import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadProgress, parseProgress, restoreAttempt, saveProgress } from './storage'
import { LEVELS } from './levels'
import { move } from './engine'
const ids = ['first', 'second']
afterEach(() => vi.unstubAllGlobals())
describe('browser-local progress', () => {
  it.each([null, 'broken json', 'null', '17', '[]'])(
    'survives a missing or corrupt save: %s',
    (raw) => {
      expect(parseProgress(raw, ids)).toEqual({
        selected: 0,
        best: {},
        theme: 'light',
        attempt: []
      })
    }
  )
  it('keeps only known levels, valid scores and a supported theme', () => {
    expect(
      parseProgress(
        JSON.stringify({
          selected: 99,
          theme: 'pink',
          best: { first: 12, second: -1, unknown: 2, __proto__: 1 }
        }),
        ids
      )
    ).toEqual({ selected: 0, best: { first: 12 }, theme: 'light', attempt: [] })
    expect(
      parseProgress(
        JSON.stringify({ selected: 1, theme: 'dark', best: { first: 7.3, second: '2' } }),
        ids
      )
    ).toEqual({ selected: 1, best: {}, theme: 'dark', attempt: [] })
  })
  it('remains playable when access to storage is denied or its quota is full', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Access denied')
      },
      setItem: () => {
        throw new Error('Quota exceeded')
      }
    })
    const progress = loadProgress(ids)
    expect(progress.selected).toBe(0)
    expect(saveProgress(progress)).toBe(false)
  })
})

describe('resuming an unfinished puzzle', () => {
  it('replays actions with a complete undo history', () => {
    const level = LEVELS[0]!
    const restored = restoreAttempt(level, ['up', 'up', 'right'])
    expect(restored.state.turn).toBe(3)
    expect(restored.history).toHaveLength(3)
    expect(move(level, restored.history[2]!, 'right').state).toEqual(restored.state)
  })
  it('rejects an invalid sequence instead of inventing a board state', () => {
    const level = LEVELS[0]!
    expect(restoreAttempt(level, ['left'])).toMatchObject({
      state: { turn: 0 },
      actions: [],
      history: []
    })
  })
  it('validates and bounds stored action sequences', () => {
    expect(
      parseProgress(JSON.stringify({ selected: 1, attempt: ['up', 'wait'] }), ids).attempt
    ).toEqual(['up', 'wait'])
    expect(
      parseProgress(JSON.stringify({ selected: 1, attempt: ['teleport'] }), ids).attempt
    ).toEqual([])
    expect(
      parseProgress(JSON.stringify({ selected: 1, attempt: Array(5000).fill('wait') }), ids).attempt
    ).toEqual([])
  })
})
