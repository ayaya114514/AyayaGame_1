import { describe, expect, it } from 'vitest'
import {
  beamsAt,
  cycleLength,
  firesOn,
  initialState,
  isPlatePressed,
  isTurretActive,
  move,
  requiredRelays,
  samePosition,
  validateLevel,
  type Action,
  type GameState,
  type Level
} from './engine'
import { LEVELS } from './levels'
import { countShortestSolutions, solve } from './solver'

function fixture(map: string[], turrets: Level['turrets'] = []): Level {
  return { id: 'test', title: '', chapter: '', description: '', hint: '', map, turrets, par: 1 }
}
function replay(level: Level, actions: Action[], start = initialState(level)): GameState {
  return actions.reduce((state, action) => move(level, state, action).state, start)
}

describe('one action, one firing beat', () => {
  const level = fixture(
    ['#####', '#S.E#', '#...#', '#...#', '##.##'],
    [{ id: '1', position: { x: 2, y: 4 }, direction: 'up', pattern: '10' }]
  )
  it('does not charge a turn for a wall or board boundary', () => {
    const state = initialState(level)
    expect(move(level, state, 'up')).toMatchObject({ changed: false, reason: 'wall', state })
    const edge = fixture(['S.E', '...', '...'])
    expect(move(edge, initialState(edge), 'left').changed).toBe(false)
  })
  it('fires after moving, including on the very first turn', () => {
    const result = move(level, initialState(level), 'right')
    expect(result.state).toMatchObject({ turn: 1, status: 'caught', player: { x: 2, y: 1 } })
  })
  it('waiting changes timing, making the same crossing safe', () => {
    const state = replay(level, ['wait', 'right'])
    expect(state).toMatchObject({ turn: 2, status: 'playing', player: { x: 2, y: 1 } })
    expect(move(level, state, 'wait').state.status).toBe('caught')
    expect(move(level, state, 'right').state.status).toBe('won')
  })
  it('cannot continue a caught or won attempt', () => {
    for (const state of [replay(level, ['right']), replay(level, ['wait', 'right', 'right'])]) {
      expect(move(level, state, 'down')).toMatchObject({ changed: false, reason: 'ended', state })
    }
  })
  it('previews use the same phase as actual shots', () => {
    const turret = level.turrets[0]!
    expect([1, 2, 3, 4].map((turn) => firesOn(turret, turn))).toEqual([true, false, true, false])
    expect(beamsAt(level, initialState(level))[0]?.cells).toContainEqual({ x: 2, y: 1 })
  })
  it('uses the joint firing period rather than the longest pattern', () => {
    expect(
      cycleLength({
        ...level,
        turrets: [...level.turrets, { ...level.turrets[0]!, pattern: '100' }]
      })
    ).toBe(6)
  })
})

describe('switches, cover and resolution order', () => {
  it('collects a relay before the linked gun fires on that same square', () => {
    const level = fixture(
      ['#####', '#SaE#', '#...#', '#...#', '##.##'],
      [{ id: '1', position: { x: 2, y: 4 }, direction: 'up', pattern: '1', relay: 0 }]
    )
    const result = move(level, initialState(level), 'right')
    expect(result.state).toMatchObject({ status: 'playing', collected: 1 })
    expect(beamsAt(level, result.state)).toEqual([])
  })
  it('collecting one relay does not disable another gun', () => {
    const level = fixture(
      ['#####', '#Sab#', '#...#', '#..E#', '##.##'],
      [{ id: '1', position: { x: 2, y: 4 }, direction: 'up', pattern: '1', relay: 1 }]
    )
    expect(move(level, initialState(level), 'right').state.status).toBe('caught')
  })
  it('requires all relays and a safe arrival at the exit', () => {
    const level = fixture(['#######', '#SE.ab#', '#######'])
    expect(requiredRelays(level)).toBe(3)
    expect(replay(level, ['right']).status).toBe('playing')
    expect(replay(level, ['right', 'right', 'right', 'right', 'left', 'left', 'left']).status).toBe(
      'won'
    )
    const exposed = fixture(
      ['#####', '#SE.#', '#...#', '#...#', '##.##'],
      [{ id: '1', position: { x: 2, y: 4 }, direction: 'up', pattern: '1' }]
    )
    expect(move(exposed, initialState(exposed), 'right').state.status).toBe('caught')
  })
  it('pushing a shield into the beam protects its shadow immediately', () => {
    const level = LEVELS.find((item) => item.id === 'moving-cover')!
    const state = replay(level, ['right', 'right', 'up'])
    expect(state.crates).toContainEqual({ x: 3, y: 3 })
    const cells = beamsAt(level, state).flatMap((beam) => beam.cells)
    expect(cells).toContainEqual({ x: 2, y: 3 })
    expect(cells).not.toContainEqual({ x: 4, y: 3 })
    expect(replay(level, ['right', 'up'], state).status).toBe('playing')
  })
  it('pushing the same shield out of the beam exposes the player immediately', () => {
    const level = LEVELS.find((item) => item.id === 'moving-cover')!
    expect(replay(level, ['right', 'right', 'up', 'up']).status).toBe('caught')
  })
  it('cannot push two crates, a wall, or a turret', () => {
    for (const level of [
      fixture(['#######', '#SCC.E#', '#######']),
      fixture(['#######', '#SC#.E#', '#######']),
      fixture(
        ['#######', '#SC..E#', '#######'],
        [{ id: '1', position: { x: 3, y: 1 }, direction: 'right', pattern: '1' }]
      )
    ]) {
      expect(move(level, initialState(level), 'right')).toMatchObject({
        changed: false,
        reason: 'crate'
      })
    }
  })
  it('a switch can start a turret instead of stopping it', () => {
    const level = fixture(
      ['#######', '#Sa..E#', '#.....#', '#######'],
      [{ id: '1', position: { x: 4, y: 3 }, direction: 'up', pattern: '1', arm: 0 }]
    )
    expect(beamsAt(level, initialState(level))).toEqual([])
    const armed = replay(level, ['right'])
    expect(armed).toMatchObject({ collected: 1, status: 'playing' })
    expect(beamsAt(level, armed)[0]?.cells).toContainEqual({ x: 4, y: 1 })
    expect(replay(level, ['right', 'right', 'right']).status).toBe('caught')
    expect(validateLevel({ ...level, turrets: [{ ...level.turrets[0]!, arm: 1 }] })).toContain(
      'Missing linked relay'
    )
  })
  it('plates silence their turret only while the player or a crate stands on them', () => {
    const level = fixture(
      ['#######', '#SxC.E#', '#.....#', '#######'],
      [{ id: '1', position: { x: 4, y: 3 }, direction: 'up', pattern: '1', plate: 0 }]
    )
    const start = initialState(level)
    expect(isPlatePressed(level, start, 0)).toBe(false)
    const onPlate = replay(level, ['right'])
    expect(isPlatePressed(level, onPlate, 0)).toBe(true)
    expect(beamsAt(level, onPlate)).toEqual([])
    // Stepping off lets the turret fire again on the very same beat.
    expect(replay(level, ['right', 'down', 'right', 'right']).status).toBe('caught')
    const crateOnPlate = { ...start, crates: [{ x: 2, y: 1 }] }
    expect(isTurretActive(level, level.turrets[0]!, crateOnPlate)).toBe(false)
    expect(validateLevel({ ...level, turrets: [{ ...level.turrets[0]!, plate: 1 }] })).toContain(
      'Missing linked plate'
    )
  })
  it('a covered relay remains collectible when the crate is pushed off it', () => {
    const level = fixture(['#######', '#S.a.E#', '#######'])
    const start = { ...initialState(level), crates: [{ x: 2, y: 1 }] }
    const after = replay(level, ['right', 'right'], start)
    expect(after.collected).toBe(1)
    expect(after.crates).toEqual([{ x: 4, y: 1 }])
  })
  it('keeps previous snapshots intact so undo restores cover, keys and firing phase', () => {
    const level = LEVELS.find((item) => item.id === 'double-duty')!
    const state = initialState(level)
    Object.freeze(state.player)
    state.crates.forEach(Object.freeze)
    Object.freeze(state.crates)
    Object.freeze(state)
    const before = JSON.stringify(state)
    const after = replay(level, solve(level)!, state)
    expect(after.status).toBe('won')
    expect(JSON.stringify(state)).toBe(before)
    expect(move(level, state, 'right')).toEqual(move(level, initialState(level), 'right'))
  })
})

describe('published puzzle quality', () => {
  it.each(LEVELS)('$id is valid, solvable and has an exact minimum of $par moves', (level) => {
    expect(validateLevel(level)).toEqual([])
    const solution = solve(level)
    expect(solution).not.toBeNull()
    expect(solution).toHaveLength(level.par)
    const before = JSON.stringify(level)
    expect(replay(level, solution!).status).toBe('won')
    expect(JSON.stringify(level)).toBe(before)
    expect(replay(level, solution!)).toEqual(replay(level, solution!))
  })
  it('makes movable cover necessary in its introductory puzzle', () => {
    const original = LEVELS.find((level) => level.id === 'moving-cover')!
    const fixedCover = { ...original, map: original.map.map((row) => row.replaceAll('C', '#')) }
    expect(solve(fixedCover)).toBeNull()
  })
  it('rhythm puzzles cannot be solved by walking alone', () => {
    for (const level of LEVELS.filter((item) => item.chapter === '节奏'))
      expect(
        solve(level, undefined, undefined, ['up', 'right', 'down', 'left']),
        level.id
      ).toBeNull()
  })
  it('switches that start turrets and plates each carry their puzzle', () => {
    for (const level of LEVELS) {
      if (level.turrets.some((turret) => turret.arm !== undefined)) {
        const unarmed = { ...level, turrets: level.turrets.filter((t) => t.arm === undefined) }
        expect(solve(unarmed)!.length, level.id).toBeLessThan(level.par)
      }
      if (level.turrets.some((turret) => turret.plate !== undefined)) {
        const noPlates = {
          ...level,
          map: level.map.map((row) => row.replace(/[xy]/g, '.')),
          turrets: level.turrets.map(({ plate: _, ...turret }) => turret)
        }
        expect(solve(noPlates), level.id).toBeNull()
      }
    }
  })
  it('past the tutorials each puzzle has one key idea, not many equal detours', () => {
    for (const level of LEVELS.filter((item) => !item.tutorial))
      expect(countShortestSolutions(level), level.id).toBeLessThanOrEqual(4)
  })
  it('advanced puzzles require meaningful detours and shield movement', () => {
    for (const level of LEVELS.filter((item) => item.chapter === '综合')) {
      const path = solve(level)!
      const unguarded = {
        ...level,
        turrets: level.turrets.map((turret) => ({ ...turret, pattern: '0' }))
      }
      expect(path.length - solve(unguarded)!.length).toBeGreaterThanOrEqual(10)
      let state = initialState(level),
        pushes = 0
      for (const action of path) {
        const result = move(level, state, action)
        if (result.reason === 'pushed') pushes++
        state = result.state
      }
      expect(pushes).toBeGreaterThanOrEqual(3)
    }
  })
  it('no published turret is decorative or permanently blocked on its first square', () => {
    for (const level of LEVELS) {
      for (const turret of level.turrets) {
        // Switch-started turrets are judged once their switch is down.
        const state = {
          ...initialState(level),
          collected: turret.arm === undefined ? 0 : 1 << turret.arm
        }
        expect(
          Array.from({ length: cycleLength(level) }, (_, index) => beamsAt(level, state, index + 1))
            .flat()
            .some((beam) => beam.turretId === turret.id && beam.cells.length >= 2),
          `${level.id} turret ${turret.id}`
        ).toBe(true)
      }
    }
  })
  it('preserves predictable previews through every solution', () => {
    for (const level of LEVELS) {
      let state = initialState(level)
      for (const action of solve(level)!) {
        const result = move(level, state, action)
        const actual = beamsAt(level, result.state, result.state.turn)
        expect(
          actual.some((beam) => beam.cells.some((cell) => samePosition(cell, result.state.player)))
        ).toBe(false)
        state = result.state
      }
    }
  })
})
