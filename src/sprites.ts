// 코드로 그리는 도트 그림: 물건 아이콘, 생존자, 좀비, 고양이, 작은 글자.
import { ITEM_BY_ID, PROF_BY_ID, SURV_BY_ID } from './data.ts';
import type { Look, Pal } from './data.ts';
import { SHAPES } from './shapes.ts';

type Ctx = CanvasRenderingContext2D;

const OUTLINE = '#2b1d14';
const WHITE = '#f4efe4';
const DARK = '#3a2d33';

function paletteColor(ch: string, pal: Pal): string | null {
  switch (ch) {
    case 'o': return OUTLINE;
    case 'm': return pal.m;
    case 'l': return pal.l;
    case 'a': return pal.a;
    case 'w': return WHITE;
    case 'k': return DARK;
    default: return null;
  }
}

// ---------- 물건 아이콘 ----------

const iconCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** 8x8 아이콘 캔버스 (silhouette 이면 아직 못 찾은 물건처럼 어두운 그림자) */
export function iconCanvas(itemId: string, silhouette = false): HTMLCanvasElement {
  const key = `${itemId}|${silhouette ? 's' : 'n'}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const it = ITEM_BY_ID[itemId];
  const c = makeCanvas(8, 8);
  const ctx = c.getContext('2d') as Ctx;
  const rows = it ? SHAPES[it.shape] : undefined;
  if (it && rows) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const col = paletteColor(rows[y][x], it.pal);
        if (!col) continue;
        ctx.fillStyle = silhouette ? '#3a322a' : col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  iconCache.set(key, c);
  return c;
}

export function iconURL(itemId: string, silhouette = false): string {
  const key = `${itemId}|${silhouette ? 's' : 'n'}`;
  let u = urlCache.get(key);
  if (!u) {
    u = iconCanvas(itemId, silhouette).toDataURL();
    urlCache.set(key, u);
  }
  return u;
}

// ---------- 작은 글자 (3x5) ----------

const GLYPHS: Record<string, string[]> = {
  O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'],
  E: ['111', '100', '110', '100', '111'],
  N: ['101', '111', '111', '111', '101'],
  B: ['110', '101', '110', '101', '110'],
  '7': ['111', '001', '010', '010', '010'],
};

export function drawText(ctx: Ctx, text: string, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (g) {
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '1') ctx.fillRect(cx + c, y + r, 1, 1);
    }
    cx += 4;
  }
}

// ---------- 사람 ----------

export interface PoseOpts {
  frame: number;
  moving: boolean;
  dir: 1 | -1;
  silhouette?: boolean;
}

const W = 12;

/** fx: 가운데 x, fy: 발끝 y. 키는 어른 17, 아이 14 */
export function drawPerson(ctx: Ctx, look: Look, fx: number, fy: number, o: PoseOpts): void {
  const kid = !!look.kid;
  const legY = kid ? 11 : 12;
  const legH = kid ? 2 : 4;
  const H = legY + legH + 1;
  const top = Math.round(fy) - H;
  const left = Math.round(fx) - W / 2;
  const sil = o.silhouette ? '#1a1410' : null;
  const rect = (x: number, y: number, w: number, h: number, c: string): void => {
    ctx.fillStyle = sil ?? c;
    const px = o.dir > 0 ? left + x : left + W - x - w;
    ctx.fillRect(px, top + y, w, h);
  };
  const f = o.frame % 2;
  const bob = !o.moving && f === 1 ? 1 : 0;

  // 다리
  const lh = o.moving && f === 0 ? legH - 1 : legH;
  const rh = o.moving && f === 1 ? legH - 1 : legH;
  rect(3, legY, 2, lh, look.pants);
  rect(7, legY, 2, rh, look.pants);
  rect(3, legY + lh, 2, 1, look.shoes);
  rect(7, legY + rh, 2, 1, look.shoes);

  // 치마 (여성): 다리 윗부분을 치마 색으로 덮는다
  if (look.skirt) {
    rect(2, legY - 1, 8, 3, look.pants);
    rect(2, legY + 1, 8, 1, look.top2);
  }

  // 몸통과 팔
  const bodyH = legY - 7;
  const swing = o.moving ? (f === 0 ? 1 : -1) : 0;
  rect(3, 7 + bob, 6, bodyH - bob, look.top);
  rect(2, 7 + bob + (swing > 0 ? 1 : 0), 1, bodyH - 1, look.top2);
  rect(9, 7 + bob + (swing < 0 ? 1 : 0), 1, bodyH - 1, look.top2);
  rect(2, 7 + bodyH - 1 + bob + (swing > 0 ? 1 : 0), 1, 1, look.skin);
  rect(9, 7 + bodyH - 1 + bob + (swing < 0 ? 1 : 0), 1, 1, look.skin);

  // 얼굴
  const hb = bob;
  const acc = look.acc;
  if (acc.includes('hood')) {
    rect(1, -1 + hb, 10, 2, look.top2);
    rect(1, 0 + hb, 1, 8, look.top2);
    rect(10, 0 + hb, 1, 8, look.top2);
  }
  rect(2, 0 + hb, 8, 7, look.skin);
  // 머리카락
  const hair = look.hair;
  if (!acc.includes('beret') && !acc.includes('chefhat') && !acc.includes('nursecap') && !acc.includes('cap')) {
    switch (look.style) {
      case 'short':
        rect(2, 0 + hb, 8, 2, hair);
        rect(2, 2 + hb, 1, 2, hair);
        rect(9, 2 + hb, 1, 2, hair);
        break;
      case 'long':
        rect(2, 0 + hb, 8, 2, hair);
        rect(2, 2 + hb, 1, 6, hair);
        rect(9, 2 + hb, 1, 6, hair);
        rect(3, 2 + hb, 2, 1, hair);
        break;
      case 'bun':
        rect(2, 0 + hb, 8, 2, hair);
        rect(2, 2 + hb, 1, 2, hair);
        rect(9, 2 + hb, 1, 2, hair);
        rect(5, -2 + hb, 3, 2, hair);
        break;
      case 'tuft':
        rect(2, 0 + hb, 8, 2, hair);
        rect(2, 2 + hb, 1, 1, hair);
        rect(9, 2 + hb, 1, 1, hair);
        rect(6, -1 + hb, 1, 1, hair);
        rect(7, -1 + hb, 1, 1, hair);
        break;
      case 'bald':
        rect(5, 0 + hb, 2, 1, '#ffffff55');
        break;
    }
  } else if (look.style === 'long') {
    rect(2, 2 + hb, 1, 6, hair);
    rect(9, 2 + hb, 1, 6, hair);
  } else if (look.style === 'bun') {
    rect(2, 2 + hb, 1, 2, hair);
    rect(9, 2 + hb, 1, 2, hair);
  }
  // 눈, 볼
  rect(4, 3 + hb, 1, 2, '#2a1a14');
  rect(7, 3 + hb, 1, 2, '#2a1a14');
  rect(3, 5 + hb, 1, 1, '#f08a7a');
  rect(8, 5 + hb, 1, 1, '#f08a7a');
  if (look.f) {
    // 속눈썹과 입술
    rect(3, 3 + hb, 1, 1, '#2a1a14');
    rect(8, 3 + hb, 1, 1, '#2a1a14');
    rect(5, 6 + hb, 2, 1, '#d8506a');
    // 머리 리본
    if ((look.style === 'long' || look.style === 'bun') && !acc.includes('cap') && !acc.includes('beret') && !acc.includes('chefhat') && !acc.includes('nursecap')) {
      rect(8, 0 + hb, 2, 2, '#e86a9a');
      rect(8, 0 + hb, 1, 1, '#ffb0cc');
    }
  }

  // 장신구
  for (const a of acc) {
    switch (a) {
      case 'chefhat':
        rect(2, -1 + hb, 8, 2, '#f4efe4');
        rect(3, -4 + hb, 6, 3, '#ffffff');
        break;
      case 'apron':
        rect(3, 8 + bob, 6, bodyH - 1 - bob, '#f4efe4');
        rect(3, 8 + bob, 1, 1, '#d8d0c0');
        break;
      case 'glasses':
        rect(3, 3 + hb, 3, 2, '#bfe3ff');
        rect(6, 3 + hb, 3, 2, '#bfe3ff');
        rect(4, 3 + hb, 1, 2, '#2a1a14');
        rect(7, 3 + hb, 1, 2, '#2a1a14');
        rect(3, 3 + hb, 6, 1, '#223');
        break;
      case 'beret':
        rect(1, -1 + hb, 9, 3, '#3b5a2a');
        rect(5, -2 + hb, 2, 1, '#2a4a1a');
        break;
      case 'scar':
        rect(8, 3 + hb, 1, 3, '#b45a4a');
        break;
      case 'camo':
        rect(4, 8 + bob, 1, 1, '#3a4a1a');
        rect(7, 9 + bob, 1, 1, '#8a9a5a');
        rect(5, 10 + bob, 2, 1, '#3a4a1a');
        break;
      case 'nursecap':
        rect(2, -2 + hb, 8, 3, '#ffffff');
        rect(5, -2 + hb, 2, 3, '#e04a4a');
        rect(4, -1 + hb, 4, 1, '#e04a4a');
        break;
      case 'headphones':
        rect(2, -1 + hb, 8, 1, '#333344');
        rect(1, 2 + hb, 2, 4, '#333344');
        rect(9, 2 + hb, 2, 4, '#333344');
        rect(1, 3 + hb, 1, 2, '#e84a8a');
        break;
      case 'beard':
        rect(3, 5 + hb, 6, 3, '#eeeeee');
        rect(4, 7 + hb, 4, 1, '#eeeeee');
        break;
      case 'cane':
        rect(11, 9, 1, H - 9, '#7a4a2a');
        rect(10, 8, 2, 1, '#7a4a2a');
        break;
      case 'vest':
        rect(3, 7 + bob, 2, bodyH - bob, '#ff9a3c');
        rect(7, 7 + bob, 2, bodyH - bob, '#ff9a3c');
        rect(7, 8 + bob, 1, 1, '#ffffff');
        break;
      case 'cap':
        rect(2, -1 + hb, 8, 3, look.top);
        rect(7, 1 + hb, 4, 1, look.top2);
        break;
    }
  }
}

// ---------- 고양이 ----------

export function drawCat(ctx: Ctx, fx: number, fy: number, t: number, dir: 1 | -1, moving: boolean, silhouette = false): void {
  const Wc = 13;
  const left = Math.round(fx) - Math.floor(Wc / 2);
  const top = Math.round(fy) - 8;
  const fur = silhouette ? '#1a1410' : '#e8944a';
  const dark = silhouette ? '#1a1410' : '#b8662a';
  const rect = (x: number, y: number, w: number, h: number, c: string): void => {
    ctx.fillStyle = c;
    const px = dir > 0 ? left + x : left + Wc - x - w;
    ctx.fillRect(px, top + y, w, h);
  };
  const wag = Math.floor(t / 300) % 2;
  const f = moving ? Math.floor(t / 160) % 2 : 0;
  rect(0, 1 + wag, 1, 3, fur);
  rect(1, 3 + wag, 1, 1, fur);
  rect(1, 3, 8, 4, fur);
  rect(3, 3, 1, 2, dark);
  rect(5, 3, 1, 2, dark);
  rect(2 + f, 7, 1, 1, dark);
  rect(4 - f, 7, 1, 1, dark);
  rect(6 + f, 7, 1, 1, dark);
  rect(8 - f, 7, 1, 1, dark);
  rect(8, 1, 5, 5, fur);
  rect(8, 0, 1, 1, fur);
  rect(12, 0, 1, 1, fur);
  if (!silhouette) {
    rect(9, 3, 1, 1, '#2a4a2a');
    rect(11, 3, 1, 1, '#2a4a2a');
    rect(10, 4, 1, 1, '#f08a8a');
    rect(9, 5, 3, 1, '#ffd34d');
  }
}

// ---------- 좀비 ----------

export function drawZombie(ctx: Ctx, fx: number, fy: number, t: number, dir: 1 | -1, seed: number): void {
  const left = Math.round(fx) - 6;
  const top = Math.round(fy) - 16;
  const rect = (x: number, y: number, w: number, h: number, c: string): void => {
    ctx.fillStyle = c;
    const px = dir > 0 ? left + x : left + 12 - x - w;
    ctx.fillRect(px, top + y, w, h);
  };
  const f = Math.floor(t / 420 + seed) % 2;
  const skin = '#8fb07a';
  rect(3, 12, 2, 3 + (f ? 1 : 0), '#3a3f55');
  rect(6, 12, 2, 4 - (f ? 1 : 0), '#3a3f55');
  rect(3, 6, 6, 6, '#5a5560');
  rect(4, 9, 1, 1, skin);
  rect(7, 7, 1, 1, '#3a3540');
  rect(9, 6 + f, 3, 2, skin);
  rect(9, 8 + f, 3, 1, skin);
  rect(3, 0, 6, 6, skin);
  rect(3, 0, 6, 1, '#3a3a2a');
  rect(2, 1, 1, 2, '#3a3a2a');
  rect(4, 2, 1, 1, '#e03a3a');
  rect(7, 2, 1, 1, '#e03a3a');
  rect(5, 4, 2, 1, '#2a3a2a');
}

// ---------- 배낭 ----------

export function drawBag(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#2b1d14';
  ctx.fillRect(x + 1, y, 8, 1);
  ctx.fillRect(x, y + 1, 10, 9);
  ctx.fillStyle = '#c86a3a';
  ctx.fillRect(x + 1, y + 1, 8, 8);
  ctx.fillStyle = '#e89060';
  ctx.fillRect(x + 1, y + 1, 8, 2);
  ctx.fillStyle = '#7a3a1a';
  ctx.fillRect(x + 2, y + 5, 6, 3);
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(x + 4, y + 6, 2, 1);
}

// ---------- 초상화 (목록·모달용) ----------

const portraitCache = new Map<string, string>();

export function portraitURL(survId: string, silhouette = false): string {
  const key = `${survId}|${silhouette ? 's' : 'n'}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const d = SURV_BY_ID[survId];
  const c = makeCanvas(24, 26);
  const ctx = c.getContext('2d') as Ctx;
  if (d) {
    ctx.fillStyle = silhouette ? '#201a14' : '#3a2e24';
    ctx.fillRect(0, 0, 24, 26);
    ctx.fillStyle = silhouette ? '#2a221a' : '#4a3c2e';
    ctx.fillRect(0, 20, 24, 6);
    if (d.look.cat) drawCat(ctx, 12, 22, 0, 1, false, silhouette);
    else drawPerson(ctx, d.look, 12, 23, { frame: 0, moving: false, dir: 1, silhouette });
  }
  const url = c.toDataURL();
  portraitCache.set(key, url);
  return url;
}

/** 아직 만나지 못한 직업의 실루엣 */
export function profPortraitURL(profId: string): string {
  const key = `prof|${profId}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const pr = PROF_BY_ID[profId];
  const c = makeCanvas(24, 26);
  const ctx = c.getContext('2d') as Ctx;
  ctx.fillStyle = '#201a14';
  ctx.fillRect(0, 0, 24, 26);
  ctx.fillStyle = '#2a221a';
  ctx.fillRect(0, 20, 24, 6);
  if (pr.look.cat) drawCat(ctx, 12, 22, 0, 1, false, true);
  else drawPerson(ctx, pr.look, 12, 23, { frame: 0, moving: false, dir: 1, silhouette: true });
  const url = c.toDataURL();
  portraitCache.set(key, url);
  return url;
}

/** 시작 화면 미리보기: 아직 저장되지 않은 외형을 그린다 */
export function lookPortraitURL(look: Look): string {
  const c = makeCanvas(24, 26);
  const ctx = c.getContext('2d') as Ctx;
  ctx.fillStyle = '#3a2e24';
  ctx.fillRect(0, 0, 24, 26);
  ctx.fillStyle = '#4a3c2e';
  ctx.fillRect(0, 20, 24, 6);
  drawPerson(ctx, look, 12, 23, { frame: 0, moving: false, dir: 1 });
  return c.toDataURL();
}
