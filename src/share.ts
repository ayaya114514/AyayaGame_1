import { validateLevel, type Direction, type Level, type Turret } from './engine'

/**
 * Custom puzzles travel entirely inside the URL hash: `#level=<base64url JSON>`.
 * JSON: { t?: title, m: map rows, g: ["x,y,dir,pattern[,link]"] }
 * dir is u / r / d / l; link is a / b (switch stops it), +a / +b (switch starts it) or x / y (plate).
 */
export const SHARE_PREFIX = '#level='
const DIRECTIONS: Record<string, Direction> = { u: 'up', r: 'right', d: 'down', l: 'left' }
const MAX_SIZE = 10
const MAX_TURRETS = 8

type SharedLevel = { t?: string; m: string[]; g: string[] }

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64Url(text: string): string {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

export function encodeLevel(level: Level): string {
  const shared: SharedLevel = {
    t: level.title,
    m: level.map,
    g: level.turrets.map((turret) => {
      const direction = turret.direction[0]
      const link =
        turret.relay !== undefined
          ? 'ab'[turret.relay]
          : turret.arm !== undefined
            ? `+${'ab'[turret.arm]}`
            : turret.plate !== undefined
              ? 'xy'[turret.plate]
              : ''
      return [turret.position.x, turret.position.y, direction, turret.pattern, link]
        .filter((part) => part !== '')
        .join(',')
    })
  }
  return SHARE_PREFIX + toBase64Url(JSON.stringify(shared))
}

/** Returns a level without par (the caller computes it with the solver), or an error message. */
export function decodeLevel(hash: string): { level: Level } | { error: string } {
  if (!hash.startsWith(SHARE_PREFIX) || hash.length > 4000) return { error: '链接格式不正确。' }
  let data: SharedLevel
  try {
    data = JSON.parse(fromBase64Url(hash.slice(SHARE_PREFIX.length))) as SharedLevel
  } catch {
    return { error: '链接格式不正确。' }
  }
  if (
    !data ||
    !Array.isArray(data.m) ||
    !Array.isArray(data.g) ||
    !data.m.every((row) => typeof row === 'string') ||
    data.m.length > MAX_SIZE ||
    data.m.some((row) => row.length !== data.m.length) ||
    data.g.length > MAX_TURRETS
  )
    return { error: `只支持不超过 ${MAX_SIZE}×${MAX_SIZE} 的方形棋盘。` }
  const turrets: Turret[] = []
  for (const [index, entry] of data.g.entries()) {
    const match =
      typeof entry === 'string' &&
      /^(\d+),(\d+),([urdl]),([01]{1,6})(?:,(\+?[ab]|[xy]))?$/.exec(entry)
    if (!match) return { error: '炮台数据不正确。' }
    const turret: Turret = {
      id: String(index + 1),
      position: { x: Number(match[1]), y: Number(match[2]) },
      direction: DIRECTIONS[match[3]!]!,
      pattern: match[4]!
    }
    const link = match[5]
    if (link?.startsWith('+')) turret.arm = link.charCodeAt(1) - 97
    else if (link === 'a' || link === 'b') turret.relay = link.charCodeAt(0) - 97
    else if (link === 'x' || link === 'y') turret.plate = link.charCodeAt(0) - 120
    turrets.push(turret)
  }
  const title =
    typeof data.t === 'string' && data.t.trim() ? data.t.trim().slice(0, 16) : '分享关卡'
  const level: Level = {
    id: 'shared',
    title,
    chapter: '分享',
    description: '',
    hint: '分享关卡没有提示。',
    map: data.m,
    turrets,
    par: 1
  }
  const errors = validateLevel(level)
  return errors.length ? { error: '关卡数据不完整。' } : { level }
}
