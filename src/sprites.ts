/** Small board pieces use the same pixel grid and theme palette. */
const shapes = {
  player:
    '<path fill="currentColor" d="M7 2h6v2h2v8h-2v2h2v4h-4v-4H9v4H5v-4h2v-2H5V4h2z"/><path fill="var(--face)" d="M7 5h6v6H7z"/><path fill="currentColor" d="M8 7h1v2H8zm3 0h1v2h-1z"/>',
  crate:
    '<path fill="currentColor" d="M2 2h16v16H2z"/><path fill="var(--crate-fill)" d="M4 4h12v12H4z"/><path fill="currentColor" d="M4 4h3l9 9v3h-3L4 7z"/>',
  turret:
    '<path fill="currentColor" d="M7 1h6v10h3v6H4v-6h3zM5 17h3v2H5zm7 0h3v2h-3z"/><path fill="var(--paper)" d="M9 2h2v5H9z"/>',
  switch: '<path fill="currentColor" d="M4 13h12v4H4zM8 8h4v5H8zM6 5h8v4H6z"/>',
  switchOn: '<path fill="currentColor" d="M4 13h12v4H4zM6 10h8v4H6z"/>',
  exit: '<path fill="currentColor" d="M4 2h12v17H4z"/><path fill="var(--door)" d="M7 5h6v12H7z"/><path fill="currentColor" d="M8 10h2v2H8z"/>',
  exitOpen: '<path fill="currentColor" d="M4 2h12v3H7v12H4zM13 5h3v12h-3zM4 17h12v2H4z"/>'
}

export function sprite(name: keyof typeof shapes, rotation = 0): string {
  return `<svg viewBox="0 0 20 20" aria-hidden="true" class="piece-svg" shape-rendering="crispEdges"><g transform="rotate(${rotation} 10 10)">${shapes[name]}</g></svg>`
}
