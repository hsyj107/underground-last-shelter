import { ROOM_ART_H } from '../../art/roomShell';
import { FACILITIES, FLOOR_COUNT } from '../../data/facilities';
import type { FacilityDef } from '../../types';
import { LAYOUT, PX } from './layout';

/** 벙커 몸체의 폭(아트 픽셀). 168 × 3 = 504px, 좌우 여백 18px */
export const BUNKER_ART_W = 168;
export const BUNKER_X = 18;

/** 방 하나의 화면상 위치/크기 (x, y, w, h는 화면 px / artW, artH는 아트 픽셀) */
export interface RoomRect {
  facility: FacilityDef;
  x: number;
  y: number;
  w: number;
  h: number;
  artW: number;
  artH: number;
}

/** data/facilities.ts 의 층·순서 정의로 모든 방의 위치를 계산한다. */
export function computeRoomRects(): RoomRect[] {
  const top = LAYOUT.contentTop + LAYOUT.surfaceHeight;
  const rects: RoomRect[] = [];

  for (let floor = 1; floor <= FLOOR_COUNT; floor++) {
    const list = FACILITIES.filter((f) => f.floor === floor).sort((a, b) => a.slot - b.slot);
    if (list.length === 0) continue;
    const artW = Math.floor(BUNKER_ART_W / list.length);

    list.forEach((facility, i) => {
      rects.push({
        facility,
        x: BUNKER_X + i * artW * PX,
        y: top + (floor - 1) * ROOM_ART_H * PX,
        w: artW * PX,
        h: ROOM_ART_H * PX,
        artW,
        artH: ROOM_ART_H,
      });
    });
  }
  return rects;
}
