import { drawGrid, type Ctx } from './pixel';

/** 10x10 픽셀 아이콘. 문자 → 색 대응표(legend)로 그린다. */
export interface IconDef {
  key: string;
  rows: string[];
  legend: Record<string, string>;
}

const K = '#16171b';
const W = '#e6e8ea';
const G = '#9aa3ad';
const D = '#5d656f';

export const ICONS: IconDef[] = [
  {
    key: 'icon-food',
    legend: { k: K, r: '#d9443a', d: '#9a2a24', g: '#5fae4a', w: '#f4a79c' },
    rows: [
      '....kg....',
      '...kgg....',
      '..kkkkkk..',
      '.krrkrrrk.',
      'krrrrrrrdk',
      'krwrrrrrdk',
      'krwrrrrrdk',
      '.krrrrrdk.',
      '..kdrrdk..',
      '...kkkk...',
    ],
  },
  {
    key: 'icon-water',
    legend: { k: K, b: '#3f86c9', l: '#a8e0ff', d: '#2b5f94' },
    rows: [
      '....kk....',
      '....kk....',
      '...kbbk...',
      '..kbbbbk..',
      '.kblbbbbk.',
      '.kblbbbdk.',
      '.kbbbbbdk.',
      '..kbbbdk..',
      '...kkkk...',
      '..........',
    ],
  },
  {
    key: 'icon-power',
    legend: { k: K, y: '#f2c744', o: '#d98a1f', w: '#fff1b0' },
    rows: [
      '.....kkk..',
      '....kyyk..',
      '...kyywk..',
      '..kyyyk...',
      '.kyyyyyyk.',
      '.kkkyyyok.',
      '...kyyok..',
      '...kyok...',
      '..kyok....',
      '..kkk.....',
    ],
  },
  {
    key: 'icon-iron',
    legend: { k: K, s: '#b8c0c9', g: '#7d8791', d: '#59616b' },
    rows: [
      '..........',
      '...kkkkkk.',
      '..ksssssdk',
      '.kssssssdk',
      '.kkkkkkkk.',
      '.kkkkkkkk.',
      'kssssssdk.',
      'kgggggggdk',
      '.kkkkkkkk.',
      '..........',
    ],
  },
  {
    key: 'menu-bunker',
    legend: { w: W, g: G, d: D },
    rows: [
      '...wwww...',
      '..wwwwww..',
      '.wwwwwwwg.',
      'wwwwwwwwwg',
      'wwwdddwwwg',
      'wwwdwgdwwg',
      'wwwdwwdwwg',
      'wwwdwwdwwg',
      'wwwdddddwg',
      'gggggggggg',
    ],
  },
  {
    key: 'menu-expedition',
    legend: { w: W, g: G, d: D },
    rows: [
      '...gggg...',
      '..gwwwwg..',
      '.gwwwdwwg.',
      'gwwwwddwwg',
      'gwwwdwwdwg',
      'gwwdwwwwwg',
      'gwwwwwwwwg',
      '.gwwwwwwg.',
      '..gwwwwg..',
      '...gggg...',
    ],
  },
  {
    key: 'menu-survivors',
    legend: { w: W, g: G, d: D },
    rows: [
      '...wwww...',
      '...wwww...',
      '...wwww...',
      '....ww....',
      '..wwwwww..',
      '.wwwwwwww.',
      '.wwwwwwwg.',
      '.wwwggwwg.',
      '.wwwg.wwg.',
      '.ggg...gg.',
    ],
  },
  {
    key: 'menu-world',
    legend: { w: W, g: G, d: D },
    rows: [
      '...gggg...',
      '..gwwddg..',
      '.gwwwddwg.',
      'gwdddwwwwg',
      'gwdddwwdwg',
      'gwwwwwddwg',
      '.gwwwwddg.',
      '.gwwwwwwg.',
      '..gwwwwg..',
      '...gggg...',
    ],
  },
  {
    key: 'menu-shop',
    legend: { w: W, g: G, d: D },
    rows: [
      '..........',
      '..dddddd..',
      '.dwwwwwwd.',
      'dwwwwwwwwd',
      'dggggggggd',
      'dwwwwwwwwd',
      'dwwwddwwwd',
      'dwwwwwwwwd',
      'dwwwwwwwwd',
      '.dddddddd.',
    ],
  },
];

export function drawIcon(ctx: Ctx, def: IconDef): void {
  drawGrid(ctx, 0, 0, def.rows, def.legend);
}
