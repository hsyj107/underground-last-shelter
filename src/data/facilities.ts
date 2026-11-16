import type { FacilityDef } from '../types';

/**
 * 시설 8종의 배치 정의 (데이터 기반).
 * 한 층에 시설 하나. floor 가 지하 층 번호이며, 순서를 바꾸면 화면에 그대로 반영된다.
 */
export const FACILITIES: FacilityDef[] = [
  { type: 'power_plant', name: '발전실', floor: 1, slot: 0, color: 0xf2c94c },
  { type: 'water_purifier', name: '정수실', floor: 2, slot: 0, color: 0x4aa8e0 },
  { type: 'farm', name: '식량 재배실', floor: 3, slot: 0, color: 0x6fcf6f },
  { type: 'dormitory', name: '숙소', floor: 4, slot: 0, color: 0xb28dff },
  { type: 'medical', name: '의료실', floor: 5, slot: 0, color: 0xff6b6b },
  { type: 'workshop', name: '작업실', floor: 6, slot: 0, color: 0xe08a3c },
  { type: 'laboratory', name: '연구실', floor: 7, slot: 0, color: 0x4fd1c5 },
  { type: 'armory', name: '무기고', floor: 8, slot: 0, color: 0x9aa5b1 },
];

export const FLOOR_COUNT = FACILITIES.length;
