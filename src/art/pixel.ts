/**
 * 픽셀 드로잉 공용 도구 (Phaser 비의존).
 * 모든 좌표는 "아트 픽셀" 단위이며, 화면에는 정수 배(PX)로 확대되어 표시된다.
 */
export type Ctx = CanvasRenderingContext2D;

export function r(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function p(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** 픽셀 원판 */
export function disc(ctx: Ctx, cx: number, cy: number, rad: number, color: string): void {
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy <= rad * rad + rad * 0.6) p(ctx, cx + dx, cy + dy, color);
    }
  }
}

/** 시드 고정 난수 (매번 같은 무늬가 나오도록) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 영역 안에 점무늬(얼룩)를 흩뿌린다 */
export function speckle(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: string[],
  density: number,
  seed: number,
): void {
  const rand = rng(seed);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (rand() < density) p(ctx, x + xx, y + yy, colors[Math.floor(rand() * colors.length)]);
    }
  }
}

/** 문자 격자로 그린 픽셀 스프라이트. '.' 은 투명. */
export function drawGrid(
  ctx: Ctx,
  x: number,
  y: number,
  rows: string[],
  legend: Record<string, string>,
): void {
  rows.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      const color = legend[row[xx]];
      if (color) p(ctx, x + xx, y + yy, color);
    }
  });
}

/** 위 → 아래 세로 그라데이션을 단계(계단)로 칠한다 (도트 느낌 유지) */
export function bands(ctx: Ctx, x: number, y: number, w: number, colors: string[], bandH: number): void {
  colors.forEach((c, i) => r(ctx, x, y + i * bandH, w, bandH, c));
}
