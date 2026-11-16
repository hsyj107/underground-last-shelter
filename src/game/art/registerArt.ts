import Phaser from 'phaser';
import { drawDrip, drawGlow, drawRock, drawSpark, drawSurface, drawWarnLight } from '../../art/envArt';
import { drawIcon, ICONS } from '../../art/iconArt';
import { drawRoom } from '../../art/rooms';
import { ROOM_ART_H } from '../../art/roomShell';
import {
  CELL_H,
  CELL_W,
  drawSurvivorSheet,
  frameRects,
  LOOKS,
  POSE_FRAMES,
  POSE_ORDER,
  TOTAL_FRAMES,
  frameName,
  type Pose,
} from '../../art/survivorArt';
import type { Ctx } from '../../art/pixel';
import { computeRoomRects } from '../config/bunkerLayout';
import { LAYOUT, PX } from '../config/layout';

/** 텍스처 키 규칙 */
export const roomTextureKey = (type: string): string => `room-${type}`;
export const survivorTextureKey = (look: string): string => `surv-${look}`;
export const survivorAnimKey = (look: string, pose: Pose): string => `${look}-${pose}`;

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

const POSE_RATE: Record<Pose, number> = { idle: 2, walk: 8, work: 6, inspect: 2, rest: 1.5 };

/** 모든 픽셀 아트 텍스처와 애니메이션을 만든다. (PreloadScene 에서 한 번 호출) */
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

  // 시설 방
  for (const rect of computeRoomRects()) {
    canvasTexture(scene, roomTextureKey(rect.facility.type), rect.artW, ROOM_ART_H, (ctx) =>
      drawRoom(rect.facility.type, ctx, rect.artW),
    );
  }

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

  // 생존자 시트 + 애니메이션
  const frames = frameRects();
  for (const [look, def] of Object.entries(LOOKS)) {
    const key = survivorTextureKey(look);
    const tex = canvasTexture(scene, key, CELL_W * TOTAL_FRAMES, CELL_H, (ctx) => drawSurvivorSheet(ctx, def));
    if (!tex) continue;
    for (const f of frames) tex.add(f.name, 0, f.x, 0, CELL_W, CELL_H);

    for (const pose of POSE_ORDER) {
      const names: string[] = [];
      for (let i = 0; i < POSE_FRAMES[pose]; i++) names.push(frameName(pose, i));
      createAnim(scene, survivorAnimKey(look, pose), key, names, POSE_RATE[pose], -1);
    }
  }
}
