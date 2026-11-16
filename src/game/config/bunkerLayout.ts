import { FACILITIES, FLOOR_COUNT } from '../../data/facilities';
import type { FacilityDef } from '../../types';
import { LAYOUT } from './layout';

/** 한 층의 높이(화면 px). 방 배경 PNG 의 높이와 같다. */
export const FLOOR_H = 220;
/** 한 층의 너비 = 화면 너비. 한 층에 시설 하나가 가로로 길게 들어간다. */
export const WORLD_W = 540;
/** 지상 + 모든 층을 합친 벙커 전체 높이. 화면보다 길어서 위아래로 끌어서 본다. */
export const WORLD_H = LAYOUT.surfaceHeight + FLOOR_COUNT * FLOOR_H;
/** 방 안에서 캐릭터 발이 닿는 y (방 위쪽 기준) */
export const FEET_Y = 200;

/** 층 사이를 오르내리는 사다리의 x (방 왼쪽 기준). 메인 캐릭터가 이 사다리로 층을 옮긴다. */
export const SHAFT_X = 524;

/** 방 하나의 위치/크기 (벙커 전체 기준 좌표, 화면 px) */
export interface RoomRect {
  facility: FacilityDef;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** data/facilities.ts 의 층·순서 정의로 모든 방의 위치를 계산한다. */
export function computeRoomRects(): RoomRect[] {
  const top = LAYOUT.contentTop + LAYOUT.surfaceHeight;
  const rects: RoomRect[] = [];

  for (let floor = 1; floor <= FLOOR_COUNT; floor++) {
    const list = FACILITIES.filter((f) => f.floor === floor).sort((a, b) => a.slot - b.slot);
    if (list.length === 0) continue;
    const w = Math.floor(WORLD_W / list.length);
    list.forEach((facility, i) => {
      rects.push({ facility, x: i * w, y: top + (floor - 1) * FLOOR_H, w, h: FLOOR_H });
    });
  }
  return rects;
}
