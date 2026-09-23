import type { Level } from './engine'

// Fixed puzzles. Every published par is verified by exhaustive breadth-first search.
export const LEVELS: Level[] = [
  {
    id: 'first-beat',
    title: '交替射击',
    chapter: '基础',
    description: '触发 A 开关，再到出口。',
    hint: '炮台射击一步、停火一步。等停火时通过红线所在列。',
    map: ['#######', '#....E#', '#...a.#', '#.....#', '#.....#', '#S....#', '###.###'],
    turrets: [
      {
        id: '1',
        position: {
          x: 3,
          y: 6
        },
        direction: 'up',
        pattern: '10',
        relay: 0
      }
    ],
    par: 8
  },
  {
    id: 'the-gap',
    title: '连续通行',
    chapter: '基础',
    description: '炮台每 4 步开火一次。通过中间的 3 格通道。',
    hint: '在通道外等待，利用连续 3 步停火通过通道。',
    map: ['#######', '####.E#', '####a##', '.....##', '##.####', '#S.####', '#######'],
    turrets: [
      {
        id: '1',
        position: {
          x: 0,
          y: 3
        },
        direction: 'right',
        pattern: '1000',
        relay: 0
      }
    ],
    par: 11
  },
  {
    id: 'two-keys',
    title: '两个开关',
    chapter: '基础',
    description: '触发 A、B 开关，关闭对应炮台后到达出口。',
    hint: '比较先关闭 A 或 B 后的可通行路线，再决定顺序。',
    map: ['##.####', '#a...E#', '#....##', '##b...#', '##.....', '#S....#', '#######'],
    turrets: [
      {
        id: '1',
        position: {
          x: 2,
          y: 0
        },
        direction: 'down',
        pattern: '10',
        relay: 0
      },
      {
        id: '2',
        position: {
          x: 6,
          y: 4
        },
        direction: 'left',
        pattern: '001',
        relay: 1
      }
    ],
    par: 15
  },
  {
    id: 'moving-cover',
    title: '推动掩体',
    chapter: '进阶',
    description: '把方块推到炮线上，挡住射击。',
    hint: '方块挡住射击后，从背面通过。继续向前推会重新暴露炮线。',
    map: ['#######', '#...aE#', '#.....#', '......#', '#..C..#', '#S....#', '#######'],
    turrets: [
      {
        id: '1',
        position: {
          x: 0,
          y: 3
        },
        direction: 'right',
        pattern: '1',
        relay: 0
      }
    ],
    par: 8
  },
  {
    id: 'make-a-way',
    title: '移开方块',
    chapter: '进阶',
    description: '推开挡路的方块，触发 A 和 B。',
    hint: '把方块推过 B 开关，再等竖向炮台停火。',
    map: ['##.####', '##...E#', '#.a..##', '......#', '##.....', '#SC.b.#', '####.##'],
    turrets: [
      {
        id: '1',
        position: {
          x: 2,
          y: 0
        },
        direction: 'down',
        pattern: '010',
        relay: 0
      },
      {
        id: '2',
        position: {
          x: 6,
          y: 4
        },
        direction: 'left',
        pattern: '10',
        relay: 1
      },
      {
        id: '3',
        position: {
          x: 4,
          y: 6
        },
        direction: 'up',
        pattern: '010'
      },
      {
        id: '4',
        position: {
          x: 0,
          y: 3
        },
        direction: 'right',
        pattern: '001'
      }
    ],
    par: 13
  },
  {
    id: 'crossfire',
    title: '双向射击',
    chapter: '进阶',
    description: '两侧炮台朝同一行射击，需要分别处理。',
    hint: '先横推方块，挡住一侧炮台。通过前再检查另一侧的射击时间。',
    map: ['###.###', '#.#b.E#', '..a....', '#.C...#', '#.....#', '#S...##', '###.###'],
    turrets: [
      {
        id: '1',
        position: {
          x: 3,
          y: 0
        },
        direction: 'down',
        pattern: '10',
        relay: 0
      },
      {
        id: '2',
        position: {
          x: 6,
          y: 2
        },
        direction: 'left',
        pattern: '10',
        relay: 1
      },
      {
        id: '3',
        position: {
          x: 3,
          y: 6
        },
        direction: 'up',
        pattern: '010'
      },
      {
        id: '4',
        position: {
          x: 0,
          y: 2
        },
        direction: 'right',
        pattern: '110'
      }
    ],
    par: 16
  },
  {
    id: 'return-path',
    title: '保留退路',
    chapter: '进阶',
    description: '推动方块后，保留返回开关的路线。',
    hint: '不要把方块推到无法绕行的位置。必要时退回一格等待。',
    map: ['###.###', '#....E#', '.....a#', '#C..b..', '#.#..##', '#S..#.#', '###.###'],
    turrets: [
      {
        id: '1',
        position: {
          x: 3,
          y: 0
        },
        direction: 'down',
        pattern: '001',
        relay: 0
      },
      {
        id: '2',
        position: {
          x: 6,
          y: 3
        },
        direction: 'left',
        pattern: '10',
        relay: 1
      },
      {
        id: '3',
        position: {
          x: 3,
          y: 6
        },
        direction: 'up',
        pattern: '10'
      },
      {
        id: '4',
        position: {
          x: 0,
          y: 2
        },
        direction: 'right',
        pattern: '001'
      }
    ],
    par: 17
  },
  {
    id: 'long-plan',
    title: '两个方块',
    chapter: '挑战',
    description: '用两个方块分别挡住横向和纵向射击。',
    hint: '移动方块前，检查触发开关后能否原路返回。',
    map: [
      '###.####',
      '#.....E#',
      '#.C...C#',
      '#.......',
      '#..#...#',
      '..a..b##',
      '#S..#..#',
      '#####.##'
    ],
    turrets: [
      {
        id: '1',
        position: {
          x: 3,
          y: 0
        },
        direction: 'down',
        pattern: '001',
        relay: 0
      },
      {
        id: '2',
        position: {
          x: 7,
          y: 3
        },
        direction: 'left',
        pattern: '010',
        relay: 1
      },
      {
        id: '3',
        position: {
          x: 5,
          y: 7
        },
        direction: 'up',
        pattern: '110'
      },
      {
        id: '4',
        position: {
          x: 0,
          y: 5
        },
        direction: 'right',
        pattern: '10'
      }
    ],
    par: 23
  },
  {
    id: 'trade-space',
    title: '开关顺序',
    chapter: '挑战',
    description: '触发开关后，仍需避开其他炮台。',
    hint: '先触发 B，再向上移动方块，为触发 A 留出安全位置。',
    map: [
      '####.###',
      '#.C...E#',
      '#..C.#.#',
      '#......#',
      '....a...',
      '#.#....#',
      '#S.b...#',
      '###.####'
    ],
    turrets: [
      {
        id: '1',
        position: {
          x: 4,
          y: 0
        },
        direction: 'down',
        pattern: '110',
        relay: 0
      },
      {
        id: '2',
        position: {
          x: 7,
          y: 4
        },
        direction: 'left',
        pattern: '10',
        relay: 1
      },
      {
        id: '3',
        position: {
          x: 3,
          y: 7
        },
        direction: 'up',
        pattern: '110'
      },
      {
        id: '4',
        position: {
          x: 0,
          y: 4
        },
        direction: 'right',
        pattern: '110'
      }
    ],
    par: 23
  },
  {
    id: 'the-last-line',
    title: '综合关卡',
    chapter: '挑战',
    description: '调整两个方块的位置，触发开关并到达出口。',
    hint: '先向上绕行、移动方块，再返回下方触发开关。',
    map: [
      '#####.##',
      '#.....E#',
      '#C#C...#',
      '#......#',
      '#..a....',
      '..b.#.##',
      '#S.....#',
      '##.#####'
    ],
    turrets: [
      {
        id: '1',
        position: {
          x: 5,
          y: 0
        },
        direction: 'down',
        pattern: '001',
        relay: 0
      },
      {
        id: '2',
        position: {
          x: 7,
          y: 4
        },
        direction: 'left',
        pattern: '001',
        relay: 1
      },
      {
        id: '3',
        position: {
          x: 2,
          y: 7
        },
        direction: 'up',
        pattern: '10'
      },
      {
        id: '4',
        position: {
          x: 0,
          y: 5
        },
        direction: 'right',
        pattern: '001'
      }
    ],
    par: 28
  }
]
