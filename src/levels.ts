import type { Level } from './engine'

// Fixed puzzles, one new idea per chapter. Every published par is verified by exhaustive
// breadth-first search; see the "published puzzle quality" tests for the other guarantees.
export const LEVELS: Level[] = [
  {
    id: 'first-wait',
    title: '错开一拍',
    chapter: '节奏',
    description: '红线处下一步会被射击。点“等待”错开它，再到出口。',
    hint: '炮台射一步、停一步。走到中间列旁边时，如果下一步会射击，就原地等一步再穿过去。',
    tutorial: true,
    map: ['###.###', '#.#.#E#', '#.#.#.#', '#S#.#.#', '#.....#', '#.#.#.#', '#######'],
    turrets: [
      {
        id: '1',
        position: {
          x: 3,
          y: 0
        },
        direction: 'down',
        pattern: '10'
      }
    ],
    par: 9
  },
  {
    id: 'the-gap',
    title: '连续通行',
    chapter: '节奏',
    description: '炮台每 4 步开火一次。踩下 A，再到出口。',
    hint: '在通道外等待，利用连续 3 步停火通过通道。',
    tutorial: true,
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
    id: 'two-rhythms',
    title: '两种节奏',
    chapter: '节奏',
    description: '两门炮都打中间这一列，但节奏不同。',
    hint: '一门隔步射击，一门每 3 步停一次，所以每 6 步才同时停火。两次穿过中间列之间正好要走 6 步。',
    map: ['###.###', '##S...#', '#.#.#.#', '#.....#', '#.#..##', '#E....#', '###.###'],
    turrets: [
      {
        id: '1',
        position: {
          x: 3,
          y: 6
        },
        direction: 'up',
        pattern: '10'
      },
      {
        id: '2',
        position: {
          x: 3,
          y: 0
        },
        direction: 'down',
        pattern: '110'
      }
    ],
    par: 16
  },
  {
    id: 'three-guns',
    title: '三门炮',
    chapter: '节奏',
    description: '三门炮，三种节奏。',
    hint: '上方两列的炮一个每 3 步停一次、一个隔步射击。先在起点附近等到能连着穿过两列的那一拍，再绕到下方。',
    map: ['###..##', '##...S#', '#....##', '#.#.#E#', '#......', '#.....#', '#######'],
    turrets: [
      {
        id: '1',
        position: {
          x: 4,
          y: 0
        },
        direction: 'down',
        pattern: '110'
      },
      {
        id: '2',
        position: {
          x: 6,
          y: 4
        },
        direction: 'left',
        pattern: '10'
      },
      {
        id: '3',
        position: {
          x: 3,
          y: 0
        },
        direction: 'down',
        pattern: '01'
      }
    ],
    par: 19
  },
  {
    id: 'two-keys',
    title: '两个开关',
    chapter: '开关',
    description: '踩下 A、B，关掉同字母的炮台，再到出口。',
    hint: '两种顺序都能过，先踩 B 更短。比较先关闭 A 或 B 后的可通行路线。',
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
    id: 'handover',
    title: '交接',
    chapter: '开关',
    description: '踩下 A：A 炮台停火，+A 炮台开始射击。',
    hint: '踩 A 之前下方横线危险，踩 A 之后换成上方横线。先想好踩 A 之后从哪条路回到出口。',
    map: ['#######', '#.E##.#', '.....a#', '#.#...#', '.....##', '#...S##', '####.##'],
    turrets: [
      {
        id: '1',
        position: {
          x: 0,
          y: 4
        },
        direction: 'right',
        pattern: '01',
        relay: 0
      },
      {
        id: '2',
        position: {
          x: 0,
          y: 2
        },
        direction: 'right',
        pattern: '01',
        arm: 0
      },
      {
        id: '3',
        position: {
          x: 4,
          y: 6
        },
        direction: 'up',
        pattern: '110'
      }
    ],
    par: 17
  },
  {
    id: 'switch-order',
    title: '开关顺序',
    chapter: '开关',
    description: 'B 同时关掉一门炮、启动另外两门。',
    hint: '两种顺序都能过，先踩 B 再绕回去踩 A 最短。踩 B 后左侧横炮每 3 步射一次，穿过横排前数好节拍。',
    map: ['#######', '###...#', '#.S.#.#', '#a##..#', '....b..', '##E#...', '#######'],
    turrets: [
      {
        id: '1',
        position: {
          x: 6,
          y: 4
        },
        direction: 'left',
        pattern: '100',
        relay: 1
      },
      {
        id: '2',
        position: {
          x: 0,
          y: 4
        },
        direction: 'right',
        pattern: '001',
        arm: 1
      },
      {
        id: '3',
        position: {
          x: 6,
          y: 5
        },
        direction: 'left',
        pattern: '10',
        arm: 1
      }
    ],
    par: 21
  },
  {
    id: 'moving-cover',
    title: '推动掩体',
    chapter: '方块',
    description: '箱子能推，也能挡炮。',
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
    id: 'pressure',
    title: '压板',
    chapter: '方块',
    description: '箱子或人压住 X，X 炮台就停火。',
    hint: '这门炮一直开火，只能靠压板关掉。把箱子推到 X 上，再从下方绕到出口。',
    map: ['#######', '##..S.#', '#E#.C.#', '...x..#', '#.#.#.#', '#.....#', '#######'],
    turrets: [
      {
        id: '1',
        position: {
          x: 0,
          y: 3
        },
        direction: 'right',
        pattern: '1',
        plate: 0
      }
    ],
    par: 14
  },
  {
    id: 'double-duty',
    title: '一箱两用',
    chapter: '方块',
    description: '一个箱子，两个用处。',
    hint: '出口要等 A 踩下后才开。把下面的箱子推上 X：它既让横排炮停火，也挡住下方竖炮，然后再去踩 A。',
    map: ['####.##', '#....##', '##C..E#', '#a...S.', '#.#.C.#', '##.x#.#', '###.###'],
    turrets: [
      {
        id: '1',
        position: {
          x: 6,
          y: 3
        },
        direction: 'left',
        pattern: '01',
        plate: 0
      },
      {
        id: '2',
        position: {
          x: 3,
          y: 6
        },
        direction: 'up',
        pattern: '10',
        relay: 0
      },
      {
        id: '3',
        position: {
          x: 4,
          y: 0
        },
        direction: 'down',
        pattern: '10'
      }
    ],
    par: 20
  },
  {
    id: 'heavy-floor',
    title: '压住火线',
    chapter: '方块',
    description: '出口一直在火线里。',
    hint: '只有 X 被压住时出口才安全。X 三面是墙，箱子只能从正下方推进去。',
    map: [
      '######.#',
      '#......#',
      '#..##E..',
      '#..#x#.#',
      '#....S##',
      '#..C..##',
      '#.C.....',
      '########'
    ],
    turrets: [
      {
        id: '1',
        position: {
          x: 7,
          y: 2
        },
        direction: 'left',
        pattern: '1',
        plate: 0
      },
      {
        id: '2',
        position: {
          x: 7,
          y: 6
        },
        direction: 'left',
        pattern: '01'
      },
      {
        id: '3',
        position: {
          x: 6,
          y: 0
        },
        direction: 'down',
        pattern: '01'
      }
    ],
    par: 22
  },
  {
    id: 'all-together',
    title: '全部机关',
    chapter: '综合',
    description: '开关、压板、箱子一起上。',
    hint: '左上的箱子推进 X，让横排左炮停火。另一个箱子最后要堵在 +B 炮台的炮口上。',
    map: [
      '########',
      '#.a.#.##',
      '#C#.#..#',
      '#x#....#',
      '##..C.##',
      '#..b#.E#',
      '.....S..',
      '###.#.##'
    ],
    turrets: [
      {
        id: '1',
        position: {
          x: 3,
          y: 7
        },
        direction: 'up',
        pattern: '10',
        relay: 1
      },
      {
        id: '2',
        position: {
          x: 0,
          y: 6
        },
        direction: 'right',
        pattern: '10',
        plate: 0
      },
      {
        id: '3',
        position: {
          x: 5,
          y: 7
        },
        direction: 'up',
        pattern: '010111',
        arm: 1
      },
      {
        id: '4',
        position: {
          x: 7,
          y: 6
        },
        direction: 'left',
        pattern: '10'
      }
    ],
    par: 28
  },
  {
    id: 'last-line',
    title: '最后一线',
    chapter: '综合',
    description: '踩下 A 之后，回出口的路就在火线里。',
    hint: '出口只能从 +A 炮台那一列进去。两个箱子都要推去堵住炮口：一个堵 +A，一个堵右侧横炮。',
    map: [
      '##.###.#',
      '#bS.C..#',
      '##.#....',
      '#a.#.#.#',
      '#.C....#',
      '##.#...#',
      '#..E#..#',
      '########'
    ],
    turrets: [
      {
        id: '1',
        position: {
          x: 2,
          y: 0
        },
        direction: 'down',
        pattern: '011',
        arm: 0
      },
      {
        id: '2',
        position: {
          x: 7,
          y: 2
        },
        direction: 'left',
        pattern: '101'
      },
      {
        id: '3',
        position: {
          x: 6,
          y: 0
        },
        direction: 'down',
        pattern: '10'
      }
    ],
    par: 32
  }
]
