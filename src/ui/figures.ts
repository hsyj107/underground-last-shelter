import type { Look, Survivor } from '../sim/types';

/**
 * 생존자 모습 그리기.
 * public/assets/parts/manifest.json 에 파츠 개수가 적혀 있으면 그림 파츠를 겹쳐서 조합하고,
 * 없으면 임시 그림 한 장(assets/characters)에 색감만 조금 바꿔서 쓴다.
 * 그림 파일이 늘어나도 코드는 바꿀 필요가 없다.
 */

export const SKIN = ['#f3d2b3', '#e6b98f', '#cf9a70', '#b27b55', '#8a5a3b', '#6a4129'];
export const HAIR = ['#17120e', '#2f1f14', '#5a3a20', '#8e6030', '#b9b4a8', '#7a2e22', '#27323f'];

interface Manifest { body: number; outfit: number; hair: number; acc: number; overlays: string[] }
let parts: Manifest = { body: 0, outfit: 0, hair: 0, acc: 0, overlays: [] };

export async function loadParts(): Promise<void> {
  try {
    const res = await fetch('assets/parts/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const m = (await res.json()) as Partial<Manifest>;
    parts = {
      body: Number(m.body) || 0, outfit: Number(m.outfit) || 0, hair: Number(m.hair) || 0, acc: Number(m.acc) || 0,
      overlays: Array.isArray(m.overlays) ? m.overlays.map(String) : [],
    };
  } catch {
    /* 파츠가 없으면 임시 그림을 쓴다 */
  }
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const num = (n: number): string => String(n).padStart(2, '0');
const pickIdx = (v: number, count: number): number => (v % count) + 1;

function tinted(file: string, color: string): string {
  return `<i class="pl tint" style="--img:url(${file});--c:${color}"></i>`;
}

function layered(look: Look, s: Survivor): string {
  const out: string[] = [];
  out.push(tinted(`assets/parts/body_${num(pickIdx(look.body, parts.body))}.png`, SKIN[look.skin % SKIN.length]));
  if (parts.outfit > 0) out.push(`<img class="pl" src="assets/parts/outfit_${num(pickIdx(look.outfit, parts.outfit))}.png" alt="">`);
  if (parts.hair > 0) out.push(tinted(`assets/parts/hair_${num(pickIdx(look.hair, parts.hair))}.png`, HAIR[look.hairColor % HAIR.length]));
  if (parts.acc > 0 && look.acc % 3 === 0) out.push(`<img class="pl" src="assets/parts/acc_${num(pickIdx(look.acc, parts.acc))}.png" alt="">`);
  const ov = s.status === 'sick' || s.status === 'critical' ? 'sick' : s.status === 'injured' ? 'hurt' : s.hp < 40 ? 'hungry' : '';
  if (ov && parts.overlays.includes(ov)) out.push(`<img class="pl" src="assets/parts/ov_${ov}.png" alt="">`);
  return out.join('');
}

/** 생존자 한 명의 모습. height 는 CSS 길이(px 또는 %) */
export function figureHtml(s: Survivor, height = '100%'): string {
  const look = s.look;
  const scale = look ? 0.94 + (look.height % 100) * 0.0012 : 1;
  const sc = `scale:1 ${scale.toFixed(3)};`;
  if (look && parts.body > 0) {
    return `<div class="fig layered" style="height:${height};${sc}">${layered(look, s)}</div>`;
  }
  // 임시 그림: 색감만 살짝 바꿔서 같은 그림끼리도 구분되게 한다
  const tint = look ? `--tint:hue-rotate(${((look.skin * 7 + look.hairColor * 13) % 40) - 20}deg) brightness(${(0.92 + (look.outfit % 20) * 0.01).toFixed(2)});` : '';
  return `<div class="fig" style="height:${height};${sc}${tint}"><img src="assets/characters/${esc(s.sprite)}.png" alt=""></div>`;
}
