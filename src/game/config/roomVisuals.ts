import type { FacilityType } from '../../types';

/** 생존자가 머물며 일하는 위치. x 는 방 안의 아트 픽셀 좌표. */
export interface Station {
  x: number;
  action: 'work' | 'inspect' | 'rest' | 'idle';
  face: 'left' | 'right';
  /** 이 자리에서 머무는 시간(ms) 범위 */
  duration: [number, number];
  /** 앉기 등으로 몸을 위로 올릴 높이(아트 픽셀) */
  lift?: number;
}

/** 방 안의 빛 번짐. x, y, radius 는 아트 픽셀. */
export interface LightDef {
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha: number;
}

export type FxDef = { kind: 'warn' | 'drip' | 'spark'; x: number; y: number };

export interface RoomVisual {
  stations: Station[];
  lights: LightDef[];
  fx: FxDef[];
}

const warm = 0xffb347;

/**
 * 시설별 조명 / 연출 / 작업 위치. 그림 자체는 src/art/rooms.ts 에 있다.
 * 새 시설을 추가할 때 이 표에 항목만 추가하면 같은 연출 체계가 적용된다.
 */
export const ROOM_VISUALS: Record<FacilityType, RoomVisual> = {
  power_plant: {
    stations: [
      { x: 37, action: 'inspect', face: 'left', duration: [2500, 4000] },
      { x: 46, action: 'work', face: 'right', duration: [3000, 5000] },
      { x: 14, action: 'idle', face: 'right', duration: [1500, 2500] },
    ],
    lights: [
      { x: 16, y: 12, radius: 30, color: warm, alpha: 0.4 },
      { x: 42, y: 12, radius: 30, color: warm, alpha: 0.34 },
      { x: 21, y: 48, radius: 16, color: 0xff8a2c, alpha: 0.26 },
    ],
    fx: [
      { kind: 'warn', x: 18, y: 25 },
      { kind: 'spark', x: 17, y: 28 },
    ],
  },
  water_purifier: {
    stations: [
      { x: 27, action: 'inspect', face: 'right', duration: [2500, 4000] },
      { x: 12, action: 'work', face: 'right', duration: [3000, 4500] },
      { x: 48, action: 'idle', face: 'left', duration: [1500, 2500] },
    ],
    lights: [
      { x: 28, y: 12, radius: 34, color: 0xbfe6ff, alpha: 0.3 },
      { x: 20, y: 48, radius: 12, color: 0x62c8e2, alpha: 0.28 },
    ],
    fx: [{ kind: 'drip', x: 35, y: 56 }],
  },
  farm: {
    stations: [
      { x: 14, action: 'work', face: 'right', duration: [3000, 5000] },
      { x: 28, action: 'work', face: 'right', duration: [3000, 5000] },
      { x: 38, action: 'rest', face: 'right', duration: [3500, 6000], lift: 2 },
    ],
    lights: [
      { x: 28, y: 17, radius: 30, color: 0xd8ffb0, alpha: 0.28 },
      { x: 28, y: 31, radius: 30, color: 0xd8ffb0, alpha: 0.26 },
      { x: 28, y: 45, radius: 30, color: 0xd8ffb0, alpha: 0.24 },
    ],
    fx: [],
  },
  dormitory: {
    stations: [
      { x: 20, action: 'rest', face: 'right', duration: [3000, 5000] },
      { x: 40, action: 'idle', face: 'left', duration: [1500, 2500] },
    ],
    lights: [
      { x: 18, y: 12, radius: 26, color: 0xffd08a, alpha: 0.24 },
      { x: 42, y: 12, radius: 26, color: 0xffd08a, alpha: 0.2 },
    ],
    fx: [],
  },
  medical: {
    stations: [
      { x: 20, action: 'work', face: 'left', duration: [3000, 5000] },
      { x: 36, action: 'work', face: 'right', duration: [3000, 4500] },
      { x: 28, action: 'inspect', face: 'left', duration: [2000, 3500] },
    ],
    lights: [
      { x: 20, y: 12, radius: 28, color: 0xe6f4ff, alpha: 0.28 },
      { x: 44, y: 12, radius: 28, color: 0xe6f4ff, alpha: 0.24 },
    ],
    fx: [],
  },
  workshop: {
    stations: [
      { x: 20, action: 'work', face: 'right', duration: [3000, 5000] },
      { x: 44, action: 'inspect', face: 'right', duration: [2000, 3500] },
    ],
    lights: [
      { x: 18, y: 12, radius: 28, color: 0xffb870, alpha: 0.28 },
      { x: 40, y: 12, radius: 28, color: 0xffb870, alpha: 0.24 },
    ],
    fx: [],
  },
  laboratory: {
    stations: [
      { x: 24, action: 'inspect', face: 'right', duration: [2500, 4000] },
      { x: 50, action: 'work', face: 'left', duration: [3000, 4500] },
    ],
    lights: [
      { x: 20, y: 12, radius: 36, color: 0x9fe8ff, alpha: 0.26 },
      { x: 62, y: 12, radius: 36, color: 0x9fe8ff, alpha: 0.22 },
    ],
    fx: [],
  },
  armory: {
    stations: [
      { x: 25, action: 'inspect', face: 'left', duration: [2500, 4000] },
      { x: 48, action: 'idle', face: 'right', duration: [1500, 3000] },
      { x: 72, action: 'inspect', face: 'left', duration: [2000, 3500] },
    ],
    lights: [
      { x: 22, y: 12, radius: 34, color: 0xfff0c0, alpha: 0.24 },
      { x: 62, y: 12, radius: 34, color: 0xfff0c0, alpha: 0.2 },
    ],
    fx: [],
  },
};
