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
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
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

/** 사람 그림 한 장의 가로 크기 (윤곽선 포함) */
export const PERSON_W = 18;
/** 모자·상투 자리를 위한 위쪽 여백 */
const OY = 2;
const OUT = '#1f1611';

/** 발끝에서 정수리(모자 포함)까지 높이. 어른 31, 아이 27 */
export function personHeight(look: Look): number {
  return look.kid ? 27 : 31;
}

function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const c = (v: number): string => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** 안경테 색은 외형에서 정해져 늘 같다: 검정, 금색, 은색 */
const GLASS_COLORS = ['#1c1c22', '#d9a21b', '#c9d0da'];
function glassColor(look: Look): string {
  let h = 0;
  for (const ch of look.hair + look.top + look.pants + look.skin) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GLASS_COLORS[h % 3];
}

const personCache = new WeakMap<Look, Map<string, HTMLCanvasElement>>();

/** 윤곽선과 두 가지 음영이 있는 사람 한 컷을 만든다 (정면, 오른쪽을 보는 기준) */
function buildPerson(look: Look, f: number, moving: boolean, sil: boolean): HTMLCanvasElement {
  const kid = !!look.kid;
  const torsoH = kid ? 6 : 8;
  const legH = kid ? 2 : 4;
  const legY = 15 + torsoH;
  const artBottom = legY + legH + 1; // 신발 마지막 줄
  const Hc = OY + artBottom + 2; // 아래 윤곽선 한 줄 포함
  const buf: (string | null)[] = new Array(PERSON_W * Hc).fill(null);
  const put = (x: number, y: number, c: string): void => {
    y += OY;
    if (x >= 0 && x < PERSON_W && y >= 0 && y < Hc) buf[y * PERSON_W + x] = c;
  };
  const rect = (x: number, y: number, w: number, h: number, c: string): void => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c);
  };
  /** 한 면: 기본색, 오른쪽 한 줄은 어둡게, 위쪽 한 줄은 밝게 */
  const box = (x: number, y: number, w: number, h: number, c: string): void => {
    rect(x, y, w, h, c);
    rect(x + w - 1, y, 1, h, shadeHex(c, 0.78));
    if (h > 2) rect(x, y, w - 1, 1, shadeHex(c, 1.12));
  };
  const acc = look.acc;
  const bob = !moving && f === 1 ? 1 : 0;
  const swing = moving ? (f === 0 ? 1 : -1) : 0;
  const has = (a: string): boolean => acc.includes(a);
  const hatted = has('beret') || has('chefhat') || has('nursecap') || has('cap');

  // 다리와 신발
  const lh = moving && f === 0 ? legH - 1 : legH;
  const rh = moving && f === 1 ? legH - 1 : legH;
  box(5, legY, 4, lh, look.pants);
  box(9, legY, 4, rh, look.pants);
  box(4, legY + lh, 5, 2, look.shoes);
  box(9, legY + rh, 5, 2, look.shoes);
  if (look.skirt) {
    box(3, legY - 2, 12, 4, look.pants);
    rect(3, legY + 1, 12, 1, look.top2);
  }

  // 몸통과 팔
  box(4, 15 + bob, 10, torsoH, look.top);
  box(2, 16 + bob + (swing > 0 ? 1 : 0), 2, torsoH - 2, look.top2);
  box(14, 16 + bob + (swing < 0 ? 1 : 0), 2, torsoH - 2, look.top2);
  rect(2, 16 + bob + (swing > 0 ? 1 : 0) + torsoH - 2, 2, 2, look.skin);
  rect(14, 16 + bob + (swing < 0 ? 1 : 0) + torsoH - 2, 2, 2, look.skin);
  rect(4, legY - 1 + bob, 10, 1, shadeHex(look.pants, 0.7)); // 허리띠
  rect(7, 14 + bob, 4, 1, shadeHex(look.skin, 0.88)); // 목

  // 옷에 덧입는 것
  if (has('vest')) {
    box(4, 15 + bob, 3, torsoH, '#f2c230');
    box(11, 15 + bob, 3, torsoH, '#f2c230');
    rect(12, 17 + bob, 1, 1, '#fff7d0');
  }
  if (has('apron')) {
    box(6, 17 + bob, 6, torsoH - 1, '#f4efe4');
    rect(6, 17 + bob, 6, 1, '#d8d0c0');
  }
  if (has('labcoat')) {
    const coatH = torsoH + 3;
    box(4, 15 + bob, 3, coatH, '#f4efe4');
    box(11, 15 + bob, 3, coatH, '#f4efe4');
    box(2, 16 + bob + (swing > 0 ? 1 : 0), 2, torsoH - 2, '#f4efe4');
    box(14, 16 + bob + (swing < 0 ? 1 : 0), 2, torsoH - 2, '#f4efe4');
    rect(4, 15 + bob + coatH - 1, 3, 1, '#d8d0c0');
    rect(11, 15 + bob + coatH - 1, 3, 1, '#d8d0c0');
  }
  if (has('tie')) {
    rect(8, 15 + bob, 2, 1, '#f4efe4');
    rect(8, 16 + bob, 2, 5, '#b8302a');
  }
  if (has('badge')) {
    rect(5, 17 + bob, 2, 1, '#f4efe4');
    rect(5, 18 + bob, 2, 1, '#6a8ab8');
  }
  if (has('toolbelt')) {
    rect(4, legY - 2 + bob, 10, 1, '#6a4a2a');
    rect(10, legY - 1 + bob, 1, 2, '#b8b0a0');
  }
  if (has('camo')) {
    rect(6, 16 + bob, 2, 1, '#3a4a1a');
    rect(10, 18 + bob, 2, 1, '#8a9a5a');
    rect(7, 20 + bob, 3, 1, '#3a4a1a');
  }
  if (has('cane')) {
    rect(16, 17, 1, artBottom - 17, '#7a4a2a');
    rect(15, 16, 2, 1, '#7a4a2a');
  }

  // 머리: 후드 → 얼굴 → 머리카락 → 모자
  const hb = bob;
  if (has('hood')) {
    box(2, 1 + hb, 14, 3, look.top2);
    rect(1, 3 + hb, 1, 9, look.top2);
    rect(16, 3 + hb, 1, 9, look.top2);
  }
  box(2, 3 + hb, 14, 11, look.skin);
  rect(2, 12 + hb, 14, 2, look.skin);
  rect(15, 3 + hb, 1, 11, shadeHex(look.skin, 0.86));
  const hair = look.hair;
  if (!hatted) {
    switch (look.style) {
      case 'short':
        box(1, 1 + hb, 16, 4, hair);
        rect(1, 5 + hb, 2, 4, hair);
        rect(15, 5 + hb, 2, 4, shadeHex(hair, 0.8));
        break;
      case 'long':
        box(1, 1 + hb, 16, 4, hair);
        rect(1, 5 + hb, 3, 15, hair);
        rect(14, 5 + hb, 3, 15, shadeHex(hair, 0.8));
        break;
      case 'bun':
        box(1, 1 + hb, 16, 4, hair);
        rect(1, 5 + hb, 2, 4, hair);
        rect(15, 5 + hb, 2, 4, shadeHex(hair, 0.8));
        box(7, -1 + hb, 5, 3, hair);
        break;
      case 'tuft':
        box(1, 1 + hb, 16, 4, hair);
        rect(1, 5 + hb, 2, 3, hair);
        rect(15, 5 + hb, 2, 3, shadeHex(hair, 0.8));
        rect(8, -1 + hb, 2, 2, hair);
        rect(10, 0 + hb, 2, 1, hair);
        break;
      case 'bald':
        rect(5, 3 + hb, 3, 1, '#ffffff66');
        break;
    }
    if (look.style !== 'bald') rect(4, 2 + hb, 5, 1, shadeHex(hair, 1.25));
  } else if (look.style === 'long') {
    rect(1, 5 + hb, 3, 15, hair);
    rect(14, 5 + hb, 3, 15, shadeHex(hair, 0.8));
  } else if (look.style === 'bun') {
    rect(1, 5 + hb, 2, 4, hair);
    rect(15, 5 + hb, 2, 4, shadeHex(hair, 0.8));
  }
  if (has('chefhat')) {
    box(1, 2 + hb, 16, 3, '#f4efe4');
    box(3, -1 + hb, 12, 4, '#ffffff');
    rect(3, 2 + hb, 12, 1, '#dcd6c8');
  }
  if (has('beret')) {
    box(1, 2 + hb, 16, 3, '#3b5a2a');
    rect(8, 1 + hb, 2, 1, '#2a4a1a');
  }
  if (has('nursecap')) {
    box(4, 1 + hb, 10, 4, '#ffffff');
    rect(8, 2 + hb, 2, 2, '#e04a4a');
  }
  if (has('cap')) {
    box(1, 2 + hb, 16, 3, look.top);
    rect(10, 4 + hb, 7, 1, shadeHex(look.top, 0.8));
  }
  if (has('headphones')) {
    rect(1, 1 + hb, 16, 1, '#333344');
    rect(1, 5 + hb, 2, 5, '#333344');
    rect(15, 5 + hb, 2, 5, '#333344');
    rect(1, 6 + hb, 1, 3, '#e84a8a');
  }

  // 얼굴: 작은 눈, 볼, 입 (눈에 하이라이트는 없다)
  rect(4, 8 + hb, 2, 2, '#2a1a14');
  rect(12, 8 + hb, 2, 2, '#2a1a14');
  rect(3, 10 + hb, 2, 1, '#f08a7a');
  rect(13, 10 + hb, 2, 1, '#f08a7a');
  rect(8, 11 + hb, 2, 1, look.f ? '#d8506a' : '#a04a3a');
  if (look.f) {
    // 속눈썹: 눈 바깥쪽 끝에서 위로 살짝 치켜 올린다. 입술은 장밋빛.
    rect(3, 7 + hb, 3, 1, '#2a1a14');
    rect(12, 7 + hb, 3, 1, '#2a1a14');
    rect(3, 8 + hb, 1, 1, '#2a1a14');
    rect(14, 8 + hb, 1, 1, '#2a1a14');
    if (!hatted && look.style !== 'bald') {
      // 앞머리: 이마 한쪽을 비스듬히 덮는다
      rect(2, 5 + hb, 7, 2, hair);
      rect(2, 5 + hb, 6, 1, shadeHex(hair, 1.15));
    }
    if ((look.style === 'long' || look.style === 'bun') && !hatted) {
      rect(13, 1 + hb, 3, 3, '#e86a9a');
      rect(13, 1 + hb, 1, 1, '#ffb0cc');
    }
  }
  if (has('scar')) rect(13, 6 + hb, 1, 4, '#b45a4a');
  if (has('glasses')) {
    const fr = glassColor(look);
    rect(2, 7 + hb, 6, 1, fr);
    rect(2, 10 + hb, 6, 1, fr);
    rect(2, 8 + hb, 1, 2, fr);
    rect(7, 8 + hb, 1, 2, fr);
    rect(10, 7 + hb, 6, 1, fr);
    rect(10, 10 + hb, 6, 1, fr);
    rect(10, 8 + hb, 1, 2, fr);
    rect(15, 8 + hb, 1, 2, fr);
    rect(8, 8 + hb, 2, 1, fr);
  }
  if (has('beard')) {
    // 수염은 머리색을 따른다 (어르신은 머리가 하얘서 흰 수염)
    rect(6, 10 + hb, 6, 1, hair);
    rect(3, 11 + hb, 2, 2, hair);
    rect(13, 11 + hb, 2, 2, hair);
    rect(4, 12 + hb, 10, 2, hair);
  }

  // 윤곽선
  const c = makeCanvas(PERSON_W, Hc);
  const g = c.getContext('2d') as Ctx;
  const filled = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < PERSON_W && y < Hc && buf[y * PERSON_W + x] !== null;
  for (let y = 0; y < Hc; y++) {
    for (let x = 0; x < PERSON_W; x++) {
      const v = buf[y * PERSON_W + x];
      if (v) {
        g.fillStyle = sil ? '#1a1410' : v;
        g.fillRect(x, y, 1, 1);
      } else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
        g.fillStyle = sil ? '#1a1410' : OUT;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

/** fx: 가운데 x, fy: 발바닥 y(윤곽선 바로 아래). 키는 어른 31, 아이 27 */
export function drawPerson(ctx: Ctx, look: Look, fx: number, fy: number, o: PoseOpts): void {
  const f = o.frame % 2;
  const key = `${f}|${o.moving ? 1 : 0}|${o.silhouette ? 1 : 0}|${look.top}|${look.top2}|${look.pants}|${look.shoes}|${look.acc.join(',')}|${look.hair}|${look.style}|${look.skin}|${look.f ? 1 : 0}|${look.skirt ? 1 : 0}|${look.kid ? 1 : 0}`;
  let m = personCache.get(look);
  if (!m) {
    m = new Map();
    personCache.set(look, m);
  }
  let img = m.get(key);
  if (!img) {
    img = buildPerson(look, f, o.moving, !!o.silhouette);
    m.set(key, img);
  }
  const top = Math.round(fy) - img.height;
  const left = Math.round(fx) - PERSON_W / 2;
  if (o.dir > 0) {
    ctx.drawImage(img, left, top);
  } else {
    ctx.save();
    ctx.translate(left + PERSON_W, top);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
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
    else drawPerson(ctx, d.look, 12, personHeight(d.look) - 1, { frame: 0, moving: false, dir: 1, silhouette });
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
  else drawPerson(ctx, pr.look, 12, personHeight(pr.look) - 1, { frame: 0, moving: false, dir: 1, silhouette: true });
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
  drawPerson(ctx, look, 12, personHeight(look) - 1, { frame: 0, moving: false, dir: 1 });
  return c.toDataURL();
}
