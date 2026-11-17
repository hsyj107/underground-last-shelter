import type { Look, Survivor } from '../sim/types';

/**
 * 생존자 모습 그리기.
 * public/assets/chars/atlas.png 한 장(남/여 × 앞·옆·뒤 × 5프레임)을 불러와서,
 * 외형 값(피부·머리색·옷색)에 맞게 색만 바꿔 한 사람당 앞/옆/뒤 걷기 줄(strip)을 만든다.
 * 그림 파일을 같은 칸 구성으로 바꿔 끼우면 코드는 그대로 쓸 수 있다.
 */

export const SKIN = ['#f6d7b8', '#ebbd93', '#d19d72', '#b57d56', '#8c5b3c', '#6b4229'];
export const HAIR = ['#1c1612', '#3a281c', '#5e3d22', '#94693a', '#c9c4b8', '#8a3524', '#2a3644'];
/** 옷 색: null 은 그림 원래 색 그대로 */
export const CLOTH: (string | null)[] = [null, '#3f6fa5', '#9a3a2c', '#c9a23a', '#6a5a8a', null, '#4a5a66', '#7a4a32'];

interface AtlasInfo { cw: number; ch: number; cols: number; rows: string[] }
let info: AtlasInfo | null = null;
let atlas: HTMLImageElement | null = null;

export async function loadParts(): Promise<void> {
  try {
    const res = await fetch('assets/chars/atlas.json', { cache: 'no-cache' });
    if (!res.ok) return;
    info = (await res.json()) as AtlasInfo;
    const img = new Image();
    img.src = 'assets/chars/atlas.png';
    await img.decode();
    atlas = img;
  } catch {
    /* 그림이 없으면 아무것도 그리지 않는다 */
  }
}

const FEMALE_SPRITES = new Set(['c_woman1', 'c_woman2', 'c_hijab']);
export const isFemale = (sprite: string): boolean => FEMALE_SPRITES.has(sprite);

export type FigSrc = Pick<Survivor, 'sprite' | 'look'> & Partial<Pick<Survivor, 'status' | 'hp'>>;

const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function toHsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
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

/** 한 칸(캐릭터 한 프레임)의 색을 바꾼다. 머리 / 몸통 / 다리 구간은 실제 그려진 높이로 나눈다 */
function recolor(d: ImageData, x0: number, w: number, skin: string, hair: string, cloth: string | null): void {
  const { data, width, height } = d;
  let top = height;
  let bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
  }
  if (bottom <= top) return;
  const h = bottom - top;
  const headEnd = top + h * 0.45;
  const torsoEnd = top + h * 0.74;
  const sk = hex(skin);
  const hr = hex(hair);
  const cl = cloth ? hex(cloth) : null;
  for (let y = top; y <= bottom; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [hue, sat, val] = toHsv(r, g, b);
      let target: [number, number, number] | null = null;
      let ref = 1;
      const skinish = hue >= 8 && hue <= 42 && sat >= 0.18 && sat <= 0.72 && val >= 0.55;
      if (y <= headEnd) {
        if (skinish) { target = sk; ref = 0.86; }
        else if (val < 0.5 && val > 0.1 && sat < 0.45) { target = hr; ref = 0.22; }
      } else if (y <= torsoEnd) {
        if (skinish && sat >= 0.3) { target = sk; ref = 0.86; }
        else if (cl && val >= 0.13) { target = cl; ref = 0.5; }
      } else if (skinish && sat >= 0.3) { target = sk; ref = 0.86; }
      if (!target) continue;
      const k = val / ref;
      data[i] = Math.min(255, target[0] * k);
      data[i + 1] = Math.min(255, target[1] * k);
      data[i + 2] = Math.min(255, target[2] * k);
    }
  }
}

const styleEl = (() => {
  const el = document.createElement('style');
  el.id = 'spr-style';
  document.head.appendChild(el);
  return el;
})();
const made = new Map<string, string>();

/** 외형 값에 맞는 CSS 클래스 이름을 돌려준다 (처음 보는 조합이면 그림 줄 3개를 만들어 등록) */
function sheetClass(female: boolean, look: Look | undefined): string {
  if (!info || !atlas) return '';
  const si = look ? look.skin % SKIN.length : 1;
  const hi = look ? look.hairColor % HAIR.length : 0;
  const ci = look ? look.outfit % CLOTH.length : 0;
  const key = `${female ? 'f' : 'm'}${si}${hi}${ci}`;
  const found = made.get(key);
  if (found) return found;
  const cls = `p${made.size}`;
  made.set(key, cls);
  const { cw, ch, cols, rows } = info;
  const out: string[] = [];
  for (const view of ['front', 'side', 'back']) {
    const row = rows.indexOf(`${female ? 'f' : 'm'}_${view}`);
    if (row < 0) continue;
    const c = document.createElement('canvas');
    c.width = cw * cols;
    c.height = ch;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) continue;
    g.drawImage(atlas, 0, row * ch, cw * cols, ch, 0, 0, cw * cols, ch);
    const d = g.getImageData(0, 0, c.width, c.height);
    for (let f = 0; f < cols; f++) recolor(d, f * cw, cw, SKIN[si], HAIR[hi], CLOTH[ci]);
    g.putImageData(d, 0, 0);
    out.push(`.${cls} .spr.${view}{background-image:url(${c.toDataURL()})}`);
  }
  styleEl.appendChild(document.createTextNode(out.join('\n')));
  return cls;
}

/** 둥근 초상화 (머리와 어깨만 잘라서 보여 준다). 그림이 바뀌면 이 함수 안만 고치면 된다 */
export function avatarHtml(s: FigSrc, extra = ''): string {
  return `<div class="ava ${extra}">${figureHtml(s, '225%')}</div>`;
}

/** 생존자 한 명의 모습. height 는 CSS 길이(px 또는 %) */
export function figureHtml(s: FigSrc, height = '100%'): string {
  const look = s.look;
  const scale = look ? 0.95 + (look.height % 100) * 0.001 : 1;
  const cls = sheetClass(isFemale(s.sprite), look);
  const ratio = info ? `${info.cw} / ${info.ch}` : '91 / 148';
  return `<div class="fig ${cls}" style="height:${height};aspect-ratio:${ratio};scale:1 ${scale.toFixed(3)}">` +
    '<i class="spr front"></i><i class="spr side"></i><i class="spr back"></i></div>';
}
