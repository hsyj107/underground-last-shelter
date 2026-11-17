import type { Look, Survivor } from '../sim/types';

/**
 * 생존자 모습 그리기 (부품 조합 방식).
 * public/assets/parts2/parts.png 한 장에 몸(머리 제외) / 얼굴 / 머리 / 수염이 들어 있고
 * parts.json 에 각 부품의 위치가 적혀 있다. 코드가 부품을 겹쳐 그리고 피부·머리·옷 색만 바꿔
 * 생존자마다 다른 모습을 만든다. 같은 구성의 그림으로 덮어쓰면 코드는 그대로 쓸 수 있다.
 */

export const SKIN = ['#f3d2b4', '#e8bb90', '#d19d72', '#b57d56', '#9a6a46', '#80553a'];
export const HAIR = ['#1c1612', '#2e2018', '#4a3020', '#6e4a2a', '#8a5a30', '#5a5a60', '#b9b4a8'];
/** 윗옷 색: null 은 그림 원래 색(흰 민소매) 그대로 */
export const CLOTH: (string | null)[] = [null, '#3f6fa5', '#9a3a2c', '#c9a23a', '#6a5a8a', null, '#4a5a66', '#7a4a32', '#4f7a45'];

interface Piece { x: number; y: number; w: number; h: number }
interface Meta { face_m: Piece[]; face_f: Piece[]; hair_m: Piece[]; hair_f: Piece[]; beard: Piece[]; body_m: Piece[]; body_f: Piece[] }
let meta: Meta | null = null;
let sheet: HTMLImageElement | null = null;

export async function loadParts(): Promise<void> {
  try {
    const res = await fetch('assets/parts2/parts.json', { cache: 'no-cache' });
    if (!res.ok) return;
    meta = (await res.json()) as Meta;
    const img = new Image();
    img.src = 'assets/parts2/parts.png';
    await img.decode();
    sheet = img;
  } catch {
    /* 그림이 없으면 아무것도 그리지 않는다 */
  }
}

const FEMALE_SPRITES = new Set(['c_woman1', 'c_woman2', 'c_hijab']);
export const isFemale = (sprite: string): boolean => FEMALE_SPRITES.has(sprite);

export type FigSrc = Pick<Survivor, 'sprite' | 'look'> & Partial<Pick<Survivor, 'status' | 'hp'>>;

const W = 104;
const H = 176;
const CUT = 68; // 몸 그림에서 원래 머리를 잘라 내는 높이

const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx === 0 ? 0 : d / mx, mx / 255];
}

const isSkin = (h: number, s: number, v: number): boolean => (h <= 45 || h >= 340) && s >= 0.1 && s <= 0.75 && v >= 0.6;

/** 부품 한 장을 잘라서 색을 바꾼 캔버스로 만든다. 윤곽선(아주 어두운 점)은 그대로 둔다 */
function part(p: Piece, y0: number, o: { skin?: string; hair?: string; cloth?: string | null; body?: boolean; strip?: [number, number] }): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h - y0;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g || !sheet) return c;
  g.drawImage(sheet, p.x, p.y + y0, p.w, p.h - y0, 0, 0, p.w, p.h - y0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  const sk = o.skin ? hex(o.skin) : null;
  const hr = o.hair ? hex(o.hair) : null;
  const cl = o.cloth ? hex(o.cloth) : null;
  const shirtEnd = (p.h - y0) * 0.5;
  // 머리·수염 부품에 같이 그려진 '빈 얼굴' 살색은 지운다 (얼굴 부품이 따로 있다)
  if (o.strip) {
    const si = (Math.floor(c.height * o.strip[1]) * c.width + Math.floor(c.width * o.strip[0])) * 4;
    const [sr, sg, sb] = [px[si], px[si + 1], px[si + 2]];
    if (px[si + 3] > 0) {
      // 시작점에서 이어진 살색 영역만 지운다 (머리카락 속 하이라이트 점은 남긴다)
      const seen = new Uint8Array(c.width * c.height);
      const stack = [si / 4];
      seen[si / 4] = 1;
      while (stack.length > 0) {
        const n = stack.pop() as number;
        const i = n * 4;
        const dr = px[i] - sr; const dg = px[i + 1] - sg; const db = px[i + 2] - sb;
        if (px[i + 3] === 0 || dr * dr + dg * dg + db * db > 52 * 52) continue;
        px[i + 3] = 0;
        const x = n % c.width;
        const y = (n - x) / c.width;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || ny < 0 || nx >= c.width || ny >= c.height) continue;
          const m = ny * c.width + nx;
          if (!seen[m]) { seen[m] = 1; stack.push(m); }
        }
      }
    }
  }
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const [h, s, v] = hsv(px[i], px[i + 1], px[i + 2]);
    if (v < 0.1) continue;
    const y = Math.floor(i / 4 / c.width);
    const x = (i / 4) % c.width;
    const centre = x > c.width * 0.22 && x < c.width * 0.78;
    let t: [number, number, number] | null = null;
    let ref = 1;
    if (sk && isSkin(h, s, v)) { t = sk; ref = 0.93; }
    else if (hr && v < 0.5 && s < 0.6) { t = hr; ref = 0.3; }
    else if (o.body && s < 0.18 && v >= 0.6 && y < shirtEnd) {
      // 가운데는 윗옷, 양옆(팔)의 하얀 반사광은 피부
      if (centre && cl) { t = cl; ref = 0.92; } else if (!centre && sk) { t = sk; ref = 0.93; }
    }
    if (!t) continue;
    const k = Math.min(1.3, v / ref);
    px[i] = Math.min(255, t[0] * k);
    px[i + 1] = Math.min(255, t[1] * k);
    px[i + 2] = Math.min(255, t[2] * k);
  }
  g.putImageData(d, 0, 0);
  return c;
}

const styleEl = (() => {
  const el = document.createElement('style');
  el.id = 'spr-style';
  document.head.appendChild(el);
  return el;
})();
const made = new Map<string, string>();

const mix = (a: number, b: number): number => (Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 40503)) >>> 0;

/** 이름 있는 생존자처럼 외형 값이 없는 경우 그림 이름에서 값을 만든다 */
function fallbackLook(sprite: string): Look {
  let h = 7;
  for (const ch of sprite) h = mix(h, ch.charCodeAt(0));
  return { body: h % 997, hair: (h >> 3) % 997, outfit: (h >> 5) % 997, acc: (h >> 7) % 997, skin: (h >> 9) % 997, hairColor: (h >> 11) % 997, height: 50 };
}

/** 외형 값에 맞는 CSS 클래스 이름을 돌려준다 (처음 보는 조합이면 그림을 만들어 등록) */
function figClass(sprite: string, look: Look): string {
  if (!meta || !sheet) return '';
  const f = isFemale(sprite);
  const faces = f ? meta.face_f : meta.face_m;
  const hairs = f ? meta.hair_f : meta.hair_m;
  const bodies = f ? meta.body_f : meta.body_m;
  const face = mix(look.acc, look.height) % faces.length;
  let hair = look.hair % hairs.length;
  let beard = !f && look.acc % 3 === 0 ? (look.acc >> 2) % meta.beard.length : -1;
  let hairColor = look.hairColor % HAIR.length;
  const body = look.body % bodies.length;
  const skin = look.skin % SKIN.length;
  const cloth = look.outfit % CLOTH.length;
  // 이름 있는 생존자의 특징
  if (sprite === 'c_beard') beard = 6;
  if (sprite === 'c_bald') { hair = -1; beard = -1; }
  if (sprite === 'c_elder') { hair = 3; beard = 9; hairColor = 6; }
  const key = `${f ? 'f' : 'm'}.${face}.${hair}.${beard}.${body}.${skin}.${hairColor}.${cloth}`;
  const found = made.get(key);
  if (found) return found;
  const cls = `p${made.size}`;
  made.set(key, cls);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return cls;
  const b = bodies[body];
  const by = H - 2 - (b.h - CUT);
  g.drawImage(part(b, CUT, { skin: SKIN[skin], cloth: CLOTH[cloth], body: true }), Math.round((W - b.w) / 2), by);
  const fp = faces[face];
  const fy = by + 2 - fp.h;
  g.drawImage(part(fp, 0, { skin: SKIN[skin] }), Math.round((W - fp.w) / 2), fy);
  const hc = hairColor >= 0 ? HAIR[hairColor] : undefined;
  if (beard > 0) {
    const bp = meta.beard[beard];
    g.drawImage(part(bp, 0, { hair: hc, strip: [0.5, 0.06] }), Math.round((W - bp.w) / 2), by - 3 - bp.h);
  }
  if (hair >= 0) {
    const hp = hairs[hair];
    g.drawImage(part(hp, 0, { hair: hc, strip: [0.5, 0.86] }), Math.round((W - hp.w) / 2), by + 2 - hp.h);
  }
  styleEl.appendChild(document.createTextNode(`.${cls} .spr{background-image:url(${c.toDataURL()})}\n`));
  return cls;
}

/** 둥근 초상화 (머리와 어깨만 잘라서 보여 준다). 그림이 바뀌면 이 함수 안만 고치면 된다 */
export function avatarHtml(s: FigSrc, extra = ''): string {
  return `<div class="ava ${extra}">${figureHtml(s, '200%')}</div>`;
}

/** 생존자 한 명의 모습. height 는 CSS 길이(px 또는 %) */
export function figureHtml(s: FigSrc, height = '100%'): string {
  const look = s.look ?? fallbackLook(s.sprite);
  const scale = 0.96 + (look.height % 100) * 0.0009;
  return `<div class="fig ${figClass(s.sprite, look)}" style="height:${height};aspect-ratio:${W} / ${H};scale:1 ${scale.toFixed(3)}"><i class="spr"></i></div>`;
}
