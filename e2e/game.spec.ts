import { test, expect, type Page } from '@playwright/test'
import { LEVELS } from '../src/levels'
import { solve } from '../src/solver'
import { initialState, move } from '../src/engine'
import { encodeLevel } from '../src/share'

const levelIndex = (id: string) => LEVELS.findIndex((level) => level.id === id)
/** Later levels open in order; seed a save that has cleared everything. */
async function unlockAll(page: Page): Promise<void> {
  await page.evaluate(
    (ids) =>
      localStorage.setItem(
        'ayaya-breach-v4',
        JSON.stringify({ selected: 0, best: Object.fromEntries(ids.map((id) => [id, 999])) })
      ),
    LEVELS.map((level) => level.id)
  )
  await page.reload()
}
async function selectLevel(page: Page, index: number): Promise<void> {
  await page.locator('#levels-button').click()
  await page.locator(`[data-level="${index}"]`).click()
  await expect(page.locator('#level-number')).toHaveText(String(index + 1))
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
})

test('every puzzle can be completed in order through the actual board controls', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const [index, level] of LEVELS.entries()) {
    if (index) await page.locator('#next-button').click()
    await expect(page.locator('#level-number')).toHaveText(String(index + 1))
    const boardTop = (await page.locator('#board').boundingBox())!.y
    let state = initialState(level)
    for (const action of solve(level)!) {
      state = move(level, state, action).state
      if (action === 'wait') await page.locator('#wait-button').click()
      else
        await page.locator(`.cell[data-x="${state.player.x}"][data-y="${state.player.y}"]`).click()
      await expect(page.locator('#turn-count')).toHaveText(String(state.turn))
      await expect(page.locator('.is-player')).toHaveAttribute('data-x', String(state.player.x))
      await expect(page.locator('.is-player')).toHaveAttribute('data-y', String(state.player.y))
    }
    await expect(page.locator('#result')).toBeVisible()
    await expect(page.locator('#result-title')).toHaveText('已通关')
    await expect(page.locator('#board')).toHaveAttribute('data-status', 'won')
    await expect(page.locator('#wait-button')).toBeHidden()
    await expect(page.locator('#next-button')).toBeVisible()
    expect(Math.abs((await page.locator('#board').boundingBox())!.y - boardTop)).toBeLessThan(1)
  }
  await expect(page.locator('#completion-count')).toHaveText(`${LEVELS.length} / ${LEVELS.length}`)
  await page.reload()
  await expect(page.locator('#result')).toBeVisible()
  await page.locator('#next-button').click()
  await expect(page.locator('#levels-dialog')).toBeVisible()
  await expect(page.getByLabel('已找到最短解', { exact: true })).toHaveCount(LEVELS.length)
  expect(errors).toEqual([])
})

test('keyboard, death, undo, restart and current-run restoration', async ({ page }) => {
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('#turn-count')).toHaveText('0')
  await expect(page.locator('#board')).toHaveAttribute('data-status', 'playing')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#turn-count')).toHaveText('2')
  // Turn 3 fires down the middle column.
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#board')).toHaveAttribute('data-status', 'caught')
  await expect(page.locator('#feedback')).toContainText('撤回')
  await expect(page.locator('#wait-button')).toBeDisabled()
  await page.locator('#help-button').click()
  for (const button of await page.locator('button[data-preview]').all()) {
    await expect(button).toBeDisabled()
  }
  await page.keyboard.press('Escape')
  await page.keyboard.press('z')
  await expect(page.locator('#board')).toHaveAttribute('data-status', 'playing')
  await expect(page.locator('#turn-count')).toHaveText('2')
  await page.reload()
  await expect(page.locator('#turn-count')).toHaveText('2')
  await expect(page.locator('.is-player')).toHaveAttribute('data-x', '2')
  await page.keyboard.press('z')
  await expect(page.locator('#turn-count')).toHaveText('1')
  await page.locator('#help-button').click()
  await page.locator('#reset-button').click()
  await expect(page.locator('#help-dialog')).not.toBeVisible()
  await expect(page.locator('#turn-count')).toHaveText('0')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('r')
  await expect(page.locator('#turn-count')).toHaveText('0')
  await expect(page.locator('#undo-button')).toBeDisabled()
})

test('forecast is read-only; help traps focus and suspends game shortcuts', async ({ page }) => {
  const rhythm = await page.locator('.turret-beats').innerHTML()
  await expect(page.locator('.beam-layer path')).toHaveCount(1)
  await page.locator('#help-button').click()
  await page.keyboard.press('Tab')
  await expect(page.locator('.instructions summary')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.instructions')).toHaveAttribute('open', '')
  await page.locator('button[data-preview="2"]').click()
  await expect(page.locator('#help-dialog')).not.toBeVisible()
  await expect(page.locator('#board-caption')).toContainText('仅预览')
  await expect(page.locator('.beam-layer path')).toHaveCount(0)
  expect(await page.locator('.turret-beats').innerHTML()).toBe(rhythm)
  await expect(page.locator('#turn-count')).toHaveText('0')
  await page.locator('#help-button').click()
  await page.locator('#hint-button').click()
  await expect(page.locator('#hint')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#turn-count')).toHaveText('0')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('#help-dialog')).not.toBeVisible()
  await expect(page.locator('#help-button')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('#turn-count')).toHaveText('1')
  await expect(page.locator('#board-caption')).not.toBeVisible()
  await page.locator('#help-button').click()
  await expect(page.locator('button[data-preview="1"]')).toHaveAttribute('aria-pressed', 'true')
})

test('turret preview supports pointer and keyboard without spending or saving a turn', async ({
  page
}) => {
  const turret = page.locator('.turret')
  const rhythm = await page.locator('.turret-beats').innerHTML()
  const saved = await page.evaluate(() => localStorage.getItem('ayaya-breach-v4'))
  await turret.click()
  await expect(page.locator('#board')).toHaveAttribute('data-preview', '2')
  await expect(page.locator('.beam-layer path')).toHaveCount(0)
  await turret.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#board')).toHaveAttribute('data-preview', '3')
  await expect(turret).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.locator('#board')).toHaveAttribute('data-preview', '1')
  await expect(page.locator('#turn-count')).toHaveText('0')
  await expect(page.locator('#board-caption')).toBeHidden()
  expect(await page.locator('.turret-beats').innerHTML()).toBe(rhythm)
  expect(await page.evaluate(() => localStorage.getItem('ayaya-breach-v4'))).toBe(saved)
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('#turn-count')).toHaveText('1')
})

test('pushing, collecting and undo restore the visible board across reload', async ({ page }) => {
  await unlockAll(page)
  await selectLevel(page, levelIndex('moving-cover'))
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowRight', 'ArrowUp', 'ArrowUp'])
    await page.keyboard.press(key)
  await expect(page.locator('.crate')).toHaveAttribute('data-y', '3')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('.relay-mark.off')).toHaveCount(1)
  await expect(page.locator('.cell[aria-label*="开关，已触发"]')).toHaveCount(1)
  const before = await page.locator('#board').innerHTML()
  await page.reload()
  expect(await page.locator('#board').innerHTML()).toBe(before)
  await page.keyboard.press('z')
  await expect(page.locator('.relay-mark.off')).toHaveCount(0)
  await expect(page.locator('.cell[aria-label*="开关，已触发"]')).toHaveCount(0)
  await expect(page.locator('.crate')).toHaveAttribute('data-x', '3')
})

test('a crate on a plate silences its turret until it is undone', async ({ page }) => {
  await unlockAll(page)
  await selectLevel(page, levelIndex('pressure'))
  await expect(page.locator('.turret-mark.off')).toHaveCount(0)
  for (const key of ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft'])
    await page.keyboard.press(key)
  await expect(page.locator('.cell[aria-label*="压着 X 压板"]')).toHaveCount(1)
  await expect(page.locator('.turret-mark.off')).toHaveCount(1)
  await expect(page.locator('.beam-layer path')).toHaveCount(0)
  await page.keyboard.press('z')
  await expect(page.locator('.turret-mark.off')).toHaveCount(0)
  await expect(page.locator('.plate-mark')).toHaveCount(1)
})

test('levels unlock in order and safety markers stay in the tutorials unless enabled', async ({
  page
}) => {
  await page.locator('#levels-button').click()
  await expect(page.locator('[data-level="0"]')).toBeEnabled()
  await expect(page.locator('[data-level="1"]')).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.locator('.move-dot').first()).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  // Tutorial: the step into the firing column is marked.
  await expect(page.locator('.cell.risky-move')).toHaveCount(1)
  await unlockAll(page)
  await selectLevel(page, levelIndex('two-rhythms'))
  await page.locator('#wait-button').click()
  await expect(page.locator('.move-dot').first()).toBeVisible()
  await expect(page.locator('.move-dot.risky')).toHaveCount(0)
  await expect(page.locator('.cell.risky-move')).toHaveCount(0)
  await page.locator('#help-button').click()
  await page.locator('#assist-button').click()
  await expect(page.locator('#assist-button')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.locator('.cell.risky-move')).toHaveCount(1)
})

test('a shared link opens a solver-checked puzzle without touching campaign progress', async ({
  page
}) => {
  const level = LEVELS.find((item) => item.id === 'handover')!
  await page.keyboard.press('ArrowDown')
  const saved = await page.evaluate(() => localStorage.getItem('ayaya-breach-v4'))
  await page.goto(`./${encodeLevel(level)}`)
  await expect(page.locator('#levels-button')).toHaveText('分享关卡')
  await expect(page.locator('#par-inline')).toHaveText(String(level.par))
  let state = initialState(level)
  for (const action of solve(level)!) {
    state = move(level, state, action).state
    if (action === 'wait') await page.locator('#wait-button').click()
    else
      await page.keyboard.press(
        { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' }[action]
      )
    await expect(page.locator('#turn-count')).toHaveText(String(state.turn))
  }
  await expect(page.locator('#board')).toHaveAttribute('data-status', 'won')
  expect(await page.evaluate(() => localStorage.getItem('ayaya-breach-v4'))).toBe(saved)
  await page.locator('#next-button').click()
  await expect(page.locator('#level-number')).toHaveText('1')
  await expect(page.locator('#turn-count')).toHaveText('1')
  expect(await page.evaluate(() => location.hash)).toBe('')
  await page.goto('./#level=broken')
  await expect(page.locator('#feedback')).toContainText('链接')
  await expect(page.locator('#level-number')).toHaveText('1')
})

test('light and dark layouts stay reachable at small, portrait and landscape sizes', async ({
  page
}) => {
  await unlockAll(page)
  await selectLevel(page, LEVELS.length - 1)
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1366, 768]
  ]) {
    await page.setViewportSize({ width: width!, height: height! })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const board = await page.locator('#board').boundingBox()
    expect(board!.width).toBeGreaterThan(250)
    expect(Math.abs(board!.width - board!.height)).toBeLessThan(1)
    await page.locator('#wait-button').scrollIntoViewIfNeeded()
    await expect(page.locator('#wait-button')).toBeInViewport()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.locator('#help-button').click()
    await page.locator('#theme-button').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.locator('#theme-button').click()
    await page.locator('[data-close="help-dialog"]').click()
  }
  await page.locator('#help-button').click()
  await page.locator('#theme-button').click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('storage failures and malformed saved data never blank the game', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage unavailable')
      }
    })
  })
  await page.reload()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('#turn-count')).toHaveText('1')
  await expect(page.locator('#save-warning')).toBeVisible()
  await expect(page.locator('#save-warning')).toContainText('无法保存')
})

test('touch swipe advances once and does not also trigger a cell click', async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, 'Touch gesture applies to the mobile project')
  const cell = page.locator('.is-player')
  const box = (await cell.boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await cell.dispatchEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    clientX: start.x,
    clientY: start.y
  })
  await cell.dispatchEvent('pointerup', {
    pointerId: 1,
    pointerType: 'touch',
    clientX: start.x,
    clientY: start.y + 35
  })
  await page.locator('.is-player').dispatchEvent('click', { detail: 1 })
  await expect(page.locator('#turn-count')).toHaveText('1')
  await page.locator('#board').dispatchEvent('pointercancel', { pointerId: 1 })
})
