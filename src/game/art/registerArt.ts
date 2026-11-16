import Phaser from 'phaser';
import { drawDrip, drawGlow, drawRock, drawSpark, drawSurface, drawWarnLight } from '../../art/envArt';
import { drawIcon, ICONS } from '../../art/iconArt';
import type { Ctx } from '../../art/pixel';
import { LAYOUT, PX } from '../config/layout';

/** 텍스처 키 규칙 */
export const roomTextureKey = (type: string): string => `room-${type}`;

type Tex = Phaser.Textures.CanvasTexture;

/**
 * 캔버스에 그려 텍스처로 등록한다.
 * 같은 키의 텍스처가 이미 있으면(= 나중에 PNG 파일로 교체한 경우) 건드리지 않는다.
 */
function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: Ctx) => void,
): Tex | null {
  if (scene.textures.exists(key)) return null;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return null;
  draw(tex.getContext());
  tex.refresh();
  // 확대해도 도트가 뭉개지지 않게 한다.
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return tex;
}

function createAnim(
  scene: Phaser.Scene,
  key: string,
  texture: string,
  frames: string[],
  frameRate: number,
  repeat: number,
): void {
  if (scene.anims.exists(key)) return;
  scene.anims.create({
    key,
    frames: frames.map((frame) => ({ key: texture, frame })),
    frameRate,
    repeat,
  });
}

/** 코드로 그리는 텍스처(아이콘·지상·암반·연출 효과)를 만든다. 방과 캐릭터는 PNG 파일을 쓴다. (PreloadScene 에서 한 번 호출) */
export function registerArt(scene: Phaser.Scene): void {
  // UI 아이콘
  for (const icon of ICONS) {
    canvasTexture(scene, icon.key, 10, 10, (ctx) => drawIcon(ctx, icon));
  }

  // 암반 / 지상
  const rockH = Math.ceil(LAYOUT.contentHeight / PX);
  canvasTexture(scene, 'env-rock', 180, rockH, (ctx) => drawRock(ctx, 180, rockH));
  canvasTexture(scene, 'env-surface', 180, LAYOUT.surfaceHeight / PX, (ctx) =>
    drawSurface(ctx, 180, LAYOUT.surfaceHeight / PX),
  );

  // 빛 번짐
  canvasTexture(scene, 'glow', 64, 64, (ctx) => drawGlow(ctx, 64));

  // 연출 효과(경고등 / 물방울 / 스파크)
  const warn = canvasTexture(scene, 'fx-warn', 12, 6, (ctx) => {
    drawWarnLight(ctx, 0);
    ctx.save();
    ctx.translate(6, 0);
    drawWarnLight(ctx, 1);
    ctx.restore();
  });
  warn?.add('warn_0', 0, 0, 0, 6, 6);
  warn?.add('warn_1', 0, 6, 0, 6, 6);

  const drip = canvasTexture(scene, 'fx-drip', 12, 10, (ctx) => {
    for (let f = 0; f < 4; f++) {
      ctx.save();
      ctx.translate(f * 3, 0);
      drawDrip(ctx, f);
      ctx.restore();
    }
  });
  for (let f = 0; f < 4; f++) drip?.add(`drip_${f}`, 0, f * 3, 0, 3, 10);

  const spark = canvasTexture(scene, 'fx-spark', 21, 7, (ctx) => {
    for (let f = 0; f < 3; f++) {
      ctx.save();
      ctx.translate(f * 7, 0);
      drawSpark(ctx, f);
      ctx.restore();
    }
  });
  for (let f = 0; f < 3; f++) spark?.add(`spark_${f}`, 0, f * 7, 0, 7, 7);

  createAnim(scene, 'fx-drip', 'fx-drip', ['drip_0', 'drip_1', 'drip_2', 'drip_3'], 6, -1);
  createAnim(scene, 'fx-spark', 'fx-spark', ['spark_0', 'spark_1', 'spark_2'], 14, 0);
}
