import { C } from './palette';
import { disc, p, r, speckle, type Ctx } from './pixel';

/** 방 한 칸의 높이(아트 픽셀). 3개 층 × 74 = 222 → 화면 666px (PX=3) */
export const ROOM_ART_H = 74;
/** 바닥 윗면 y. 생존자의 발은 이 줄 위에 선다. */
export const FLOOR_TOP = 66;
/** 생존자가 서는 발 기준 y (셀의 아래 끝) */
export const FEET_Y = FLOOR_TOP + 1;

/**
 * 모든 시설이 공유하는 방 껍데기:
 * 콘크리트 벽 · 철제 기둥 · 천장 배관 · 바닥 철판 · 천장 조명 기구
 * lamps: 천장 조명 기구 x 위치 목록
 */
export function drawShell(ctx: Ctx, w: number, seed: number, lamps: number[]): void {
  // 뒤쪽 벽
  r(ctx, 0, 0, w, ROOM_ART_H, C.wall);
  speckle(ctx, 3, 8, w - 6, 58, [C.wallDark, C.wallLight, C.wallDark], 0.07, seed);

  // 벽 패널 이음매
  for (let x = 17; x < w - 6; x += 16) {
    r(ctx, x, 8, 1, 58, C.wallDark);
    r(ctx, x + 1, 8, 1, 58, C.wallLight);
  }
  // 가로 띠
  r(ctx, 3, 40, w - 6, 1, C.wallDark);
  r(ctx, 3, 41, w - 6, 1, C.wallLight);
  // 아래쪽 그늘(걸레받이)
  r(ctx, 3, 58, w - 6, 8, C.wallDark);
  r(ctx, 3, 58, w - 6, 1, C.wallShade);
  speckle(ctx, 3, 59, w - 6, 7, [C.wallShade], 0.1, seed + 7);

  // 천장 슬래브
  r(ctx, 0, 0, w, 8, C.slab);
  r(ctx, 0, 0, w, 1, C.slabLight);
  r(ctx, 0, 7, w, 1, C.black);
  // 천장 배관
  r(ctx, 3, 3, w - 6, 3, C.steel);
  r(ctx, 3, 3, w - 6, 1, C.steelLight);
  r(ctx, 3, 5, w - 6, 1, C.steelDark);
  for (let x = 9; x < w - 6; x += 14) {
    r(ctx, x, 2, 2, 5, C.steelDark);
    p(ctx, x, 2, C.steelLight);
  }
  // 늘어진 전선
  for (let x = 6; x < w - 8; x += 28) {
    r(ctx, x, 7, 8, 1, C.black);
    r(ctx, x + 1, 8, 6, 1, C.black);
    r(ctx, x + 3, 9, 2, 1, C.black);
  }

  // 양쪽 철제 기둥
  for (const px of [0, w - 3]) {
    r(ctx, px, 0, 3, ROOM_ART_H, C.steel);
    r(ctx, px, 0, 1, ROOM_ART_H, C.steelLight);
    r(ctx, px + 2, 0, 1, ROOM_ART_H, C.steelDeep);
    for (let y = 10; y < 66; y += 9) p(ctx, px + 1, y, C.steelLight);
  }

  // 바닥: 윗면 철판 + 격자 + 슬래브
  r(ctx, 3, FLOOR_TOP, w - 6, 1, '#a5acb5');
  r(ctx, 3, FLOOR_TOP + 1, w - 6, 1, C.steel);
  r(ctx, 3, FLOOR_TOP + 2, w - 6, 2, C.steelDark);
  for (let x = 3; x < w - 3; x += 2) p(ctx, x, FLOOR_TOP + 3, C.steelDeep);
  r(ctx, 0, FLOOR_TOP + 4, w, ROOM_ART_H - FLOOR_TOP - 4, C.slab);
  r(ctx, 0, FLOOR_TOP + 4, w, 1, C.black);
  r(ctx, 0, ROOM_ART_H - 1, w, 1, C.black);

  // 천장 조명 기구
  for (const lx of lamps) {
    r(ctx, lx - 5, 8, 11, 1, C.steelDark);
    r(ctx, lx - 4, 9, 9, 2, C.lamp);
    r(ctx, lx - 2, 9, 5, 1, C.lampCore);
    r(ctx, lx - 4, 11, 9, 1, C.steelDark);
  }
}

/** 노란/검정 경고 줄무늬 */
export function hazard(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  r(ctx, x, y, w, h, C.black);
  for (let i = 0; i < w; i += 4) {
    for (let yy = 0; yy < h; yy++) {
      const sx = x + i + ((yy + 1) % 4);
      r(ctx, sx, y + yy, 2, 1, C.yellow);
    }
  }
}

/** 작은 원형 계기판 */
export function gauge(ctx: Ctx, cx: number, cy: number, needle: number): void {
  disc(ctx, cx, cy, 3, C.steelDark);
  disc(ctx, cx, cy, 2, C.paper);
  p(ctx, cx, cy, C.black);
  p(ctx, cx + needle, cy - 1, C.red);
  p(ctx, cx + needle, cy - 2, C.red);
}

/** 볼트 / 리벳 */
export function rivets(ctx: Ctx, x: number, y: number, w: number, step: number, color: string): void {
  for (let xx = 0; xx < w; xx += step) p(ctx, x + xx, y, color);
}
