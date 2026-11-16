import { C } from './palette';
import { bands, p, r, rng, speckle, type Ctx } from './pixel';

/** 벙커 뒤쪽 암반 (전체 콘텐츠 영역을 덮는다) */
export function drawRock(ctx: Ctx, w: number, h: number): void {
  r(ctx, 0, 0, w, h, '#2a2724');
  speckle(ctx, 0, 0, w, h, ['#35302b', '#211f1d', '#3d372f'], 0.18, 5);
  const rand = rng(9);
  // 지층 줄무늬
  for (let y = 6; y < h; y += 9 + Math.floor(rand() * 5)) {
    r(ctx, 0, y, w, 1, '#1e1c1a');
    for (let x = 0; x < w; x += 7 + Math.floor(rand() * 6)) p(ctx, x, y + 1, '#3f3932');
  }
  // 바위 덩어리
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const rw = 3 + Math.floor(rand() * 5);
    r(ctx, x, y, rw, 2, '#3a342e');
    r(ctx, x, y, rw, 1, '#4a433a');
  }
}

/** 지상: 무너진 도시 실루엣 + 흐린 하늘 + 흙 */
export function drawSurface(ctx: Ctx, w: number, h: number): void {
  // 하늘 (탁한 주황-회색 노을)
  bands(ctx, 0, 0, w, ['#2b2f38', '#353a45', '#454751', '#5a4f4f', '#6e5a50', '#80634f'], 3);
  // 먼지 낀 해
  r(ctx, 138, 7, 8, 8, '#a3745a');
  r(ctx, 140, 5, 4, 12, '#a3745a');
  r(ctx, 139, 8, 6, 6, '#c99070');

  // 원경 건물 실루엣
  const far = '#242830';
  const farBlocks: [number, number, number][] = [
    [6, 8, 12], [20, 4, 9], [30, 10, 8], [44, 6, 11], [62, 9, 9], [78, 3, 12],
    [96, 8, 10], [114, 5, 9], [150, 7, 11], [166, 10, 8],
  ];
  for (const [x, top, bw] of farBlocks) r(ctx, x, top, bw, h - top - 3, far);
  // 근경 건물 (창문 / 무너진 윗부분)
  const near = '#1a1d23';
  const nearBlocks: [number, number, number][] = [
    [12, 11, 14], [58, 9, 16], [102, 12, 12], [128, 8, 18], [160, 11, 14],
  ];
  for (const [x, top, bw] of nearBlocks) {
    r(ctx, x, top, bw, h - top - 3, near);
    r(ctx, x + 2, top - 1, 3, 1, near);
    for (let wy = top + 3; wy < h - 6; wy += 4) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
        if ((wx + wy) % 3 !== 0) p(ctx, wx, wy, '#2d323b');
      }
    }
  }
  // 죽은 나무
  r(ctx, 90, 12, 1, 8, '#120f0e');
  r(ctx, 88, 13, 2, 1, '#120f0e');
  r(ctx, 91, 15, 2, 1, '#120f0e');

  // 흙 + 잔디 + 벙커 해치
  r(ctx, 0, h - 4, w, 4, '#3b2f25');
  r(ctx, 0, h - 4, w, 1, '#55493a');
  speckle(ctx, 0, h - 3, w, 3, ['#2a211a', '#4a3d30'], 0.25, 13);
  r(ctx, 76, h - 7, 28, 3, C.steelDark);
  r(ctx, 76, h - 7, 28, 1, C.steelLight);
  r(ctx, 80, h - 9, 20, 2, C.steel);
  r(ctx, 86, h - 8, 8, 1, C.yellow);
}

/** 부드러운 원형 빛 번짐용 (흰색 → 투명). 색은 Phaser 쪽에서 tint 한다. */
export function drawGlow(ctx: Ctx, size: number): void {
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
}

/** 경고등 2프레임 (6x6): 켜짐 / 꺼짐 */
export function drawWarnLight(ctx: Ctx, f: number): void {
  const on = f === 0;
  r(ctx, 1, 0, 4, 1, C.steelDark);
  r(ctx, 0, 1, 6, 4, on ? C.red : C.redDark);
  if (on) {
    r(ctx, 1, 2, 2, 2, '#ff9a80');
    p(ctx, 1, 2, '#ffe0d6');
  }
  r(ctx, 1, 5, 4, 1, C.steelDark);
}

/** 물방울 4프레임 (3x10): 맺힘 → 떨어짐 */
export function drawDrip(ctx: Ctx, f: number): void {
  const ys = [0, 2, 5, 8];
  const y = ys[f] ?? 0;
  if (f < 3) {
    r(ctx, 1, y, 1, 2, C.cyan);
    p(ctx, 1, y, C.cyanLight);
  } else {
    r(ctx, 0, 9, 3, 1, C.cyan);
    p(ctx, 1, 8, C.cyanLight);
  }
}

/** 전기 스파크 3프레임 (7x7) */
export function drawSpark(ctx: Ctx, f: number): void {
  const col = f === 1 ? C.lampCore : C.yellow;
  if (f === 0) {
    p(ctx, 3, 3, col);
    p(ctx, 2, 2, C.orange);
    p(ctx, 4, 4, C.orange);
  } else if (f === 1) {
    p(ctx, 3, 3, col);
    r(ctx, 1, 3, 5, 1, C.yellow);
    r(ctx, 3, 1, 1, 5, C.yellow);
    p(ctx, 1, 1, C.orange);
    p(ctx, 5, 5, C.orange);
  } else {
    p(ctx, 1, 1, C.orange);
    p(ctx, 5, 2, C.yellow);
    p(ctx, 2, 5, C.orange);
  }
}
