import type { FacilityType } from '../../types';

/** 생존자가 머물며 일하는 위치. x 는 방 왼쪽 기준 화면 px. */
export interface Station {
  x: number;
  action: 'work' | 'inspect' | 'rest' | 'idle';
  face: 'left' | 'right';
  /** 이 자리에서 머무는 시간(ms) 범위 */
  duration: [number, number];
}

export type FxDef = { kind: 'warn' | 'drip' | 'spark'; x: number; y: number };

export interface RoomVisual {
  stations: Station[];
  /** 천장 조명 x 위치 (은은한 깜빡임 연출용) */
  lamps: number[];
  lampColor: number;
  fx: FxDef[];
}

/**
 * 시설별 작업 위치 / 조명 / 연출.
 * 방 그림은 public/assets/rooms 의 PNG 이며, 소품 배치는 tools/asset-pipeline/build.py 에 있다.
 */
export const ROOM_VISUALS: Record<FacilityType, RoomVisual> = {
  power_plant: {
    stations: [
      { x: 192, action: 'work', face: 'left', duration: [3000, 5000] },
      { x: 258, action: 'inspect', face: 'left', duration: [2500, 4000] },
      { x: 410, action: 'idle', face: 'left', duration: [1500, 2500] },
    ],
    lamps: [96, 270, 444],
    lampColor: 0xffb060,
    fx: [
      { kind: 'warn', x: 160, y: 70 },
      { kind: 'spark', x: 150, y: 150 },
    ],
  },
  water_purifier: {
    stations: [
      { x: 108, action: 'inspect', face: 'left', duration: [2500, 4000] },
      { x: 222, action: 'work', face: 'left', duration: [3000, 4500] },
      { x: 320, action: 'inspect', face: 'right', duration: [2500, 4000] },
    ],
    lamps: [96, 270, 444],
    lampColor: 0xbfe2ff,
    fx: [{ kind: 'drip', x: 262, y: 150 }],
  },
  farm: {
    stations: [
      { x: 100, action: 'work', face: 'left', duration: [3000, 5000] },
      { x: 250, action: 'work', face: 'left', duration: [3000, 5000] },
      { x: 396, action: 'work', face: 'left', duration: [3000, 5000] },
      { x: 478, action: 'rest', face: 'left', duration: [2500, 4000] },
    ],
    lamps: [96, 270, 444],
    lampColor: 0xd6ffb0,
    fx: [],
  },
  dormitory: {
    stations: [
      { x: 140, action: 'rest', face: 'left', duration: [3000, 5000] },
      { x: 362, action: 'idle', face: 'left', duration: [1500, 2500] },
      { x: 476, action: 'rest', face: 'right', duration: [2500, 4000] },
    ],
    lamps: [96, 270, 444],
    lampColor: 0xffce8c,
    fx: [],
  },
  medical: {
    stations: [
      { x: 128, action: 'work', face: 'left', duration: [3000, 5000] },
      { x: 282, action: 'work', face: 'left', duration: [3000, 5000] },
      { x: 376, action: 'inspect', face: 'left', duration: [2500, 4000] },
    ],
    lamps: [96, 270, 444],
    lampColor: 0xe2f0ff,
    fx: [],
  },
  workshop: {
    stations: [
      { x: 112, action: 'work', face: 'left', duration: [3000, 5000] },
      { x: 250, action: 'inspect', face: 'left', duration: [2000, 3500] },
      { x: 400, action: 'idle', face: 'left', duration: [1500, 2500] },
    ],
    lamps: [96, 270, 444],
    lampColor: 0xffbe78,
    fx: [],
  },
  laboratory: {
    stations: [
      { x: 132, action: 'inspect', face: 'left', duration: [2500, 4000] },
      { x: 250, action: 'work', face: 'left', duration: [3000, 4500] },
      { x: 450, action: 'idle', face: 'right', duration: [1500, 2500] },
    ],
    lamps: [96, 270, 444],
    lampColor: 0xb0e8ff,
    fx: [],
  },
  armory: {
    stations: [
      { x: 146, action: 'inspect', face: 'left', duration: [2500, 4000] },
      { x: 300, action: 'idle', face: 'right', duration: [1500, 3000] },
      { x: 376, action: 'inspect', face: 'left', duration: [2000, 3500] },
    ],
    lamps: [96, 270, 444],
    lampColor: 0xffecbe,
    fx: [],
  },
};
