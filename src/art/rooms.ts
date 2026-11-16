import type { FacilityType } from '../types';
import { C } from './palette';
import { disc, drawGrid, p, r, speckle, type Ctx } from './pixel';
import { drawShell, FLOOR_TOP, gauge, hazard, rivets, ROOM_ART_H } from './roomShell';

export { ROOM_ART_H };

/* ───────────── 발전실 ───────────── */
function drawPowerRoom(ctx: Ctx, w: number): void {
  drawShell(ctx, w, 11, [16, 42]);

  // 배기 파이프 (발전기 → 천장)
  r(ctx, 27, 8, 4, 30, C.steel);
  r(ctx, 27, 8, 1, 30, C.steelLight);
  r(ctx, 30, 8, 1, 30, C.steelDark);
  for (const y of [14, 24, 33]) r(ctx, 26, y, 6, 2, C.steelDark);

  // 발전기 받침 + 경고 줄무늬
  r(ctx, 6, 61, 32, 5, C.steelDark);
  hazard(ctx, 6, 63, 32, 3);

  // 발전기 본체
  r(ctx, 8, 36, 28, 26, C.steel);
  r(ctx, 8, 36, 28, 2, C.steelLight);
  r(ctx, 8, 60, 28, 2, C.steelDark);
  r(ctx, 8, 36, 1, 26, C.steelLight);
  r(ctx, 35, 36, 1, 26, C.steelDeep);
  // 위쪽 엔진 실린더
  r(ctx, 11, 31, 9, 6, C.steelLight);
  r(ctx, 11, 31, 9, 1, C.white);
  r(ctx, 11, 36, 9, 1, C.steelDark);
  r(ctx, 22, 33, 8, 4, C.steel);
  // 환기구 슬릿
  r(ctx, 11, 41, 13, 11, C.steelDeep);
  for (let y = 42; y < 52; y += 2) r(ctx, 12, y, 11, 1, C.steelDark);
  // 노란 띠
  r(ctx, 8, 55, 28, 3, C.yellow);
  r(ctx, 8, 57, 28, 1, C.yellowDark);
  // 계기판 + 상태등
  gauge(ctx, 30, 43, 1);
  p(ctx, 27, 49, C.greenLight);
  p(ctx, 29, 49, C.orange);
  p(ctx, 31, 49, C.steelDeep);
  rivets(ctx, 10, 38, 24, 4, C.steelDark);
  rivets(ctx, 10, 59, 24, 4, C.steelDark);

  // 발전기 ↔ 제어반 전선
  r(ctx, 36, 51, 4, 2, C.black);
  r(ctx, 36, 51, 4, 1, '#34363c');
  r(ctx, 38, 52, 2, 12, C.black);

  // 제어반
  r(ctx, 40, 31, 13, 35, C.steelDark);
  r(ctx, 40, 31, 13, 1, C.steel);
  r(ctx, 40, 31, 1, 35, C.steel);
  r(ctx, 52, 31, 1, 35, C.steelDeep);
  r(ctx, 42, 34, 9, 8, C.black);
  r(ctx, 43, 35, 7, 6, '#0f3a28');
  r(ctx, 44, 36, 4, 1, C.greenLight);
  r(ctx, 44, 38, 5, 1, C.green);
  r(ctx, 44, 40, 2, 1, C.greenLight);
  // 버튼 / 스위치
  for (let i = 0; i < 4; i++) {
    r(ctx, 42 + i * 2.5, 44, 2, 2, [C.red, C.yellow, C.greenLight, C.cyan][i]);
  }
  r(ctx, 42, 49, 9, 7, C.steelDeep);
  for (let i = 0; i < 3; i++) {
    r(ctx, 43 + i * 3, 50, 2, 5, C.steel);
    r(ctx, 43 + i * 3, i % 2 === 0 ? 50 : 53, 2, 2, C.white);
  }
  r(ctx, 42, 58, 9, 4, C.black);
  hazard(ctx, 42, 59, 9, 2);
  // 제어반 → 천장 굵은 케이블
  r(ctx, 46, 8, 3, 23, C.black);
  r(ctx, 46, 8, 1, 23, '#2a2c32');

  // 벽 경고등 받침 (불빛은 fx 스프라이트로 별도 연출)
  r(ctx, 17, 24, 7, 6, C.steelDark);
  r(ctx, 18, 30, 5, 1, C.steelDeep);
  // 벽 비상 표지
  r(ctx, 5, 22, 8, 8, C.yellow);
  r(ctx, 6, 23, 6, 6, C.black);
  r(ctx, 8, 24, 2, 3, C.yellow);
  p(ctx, 8, 28, C.yellow);
  p(ctx, 9, 28, C.yellow);
}

/* ───────────── 정수실 ───────────── */
function drawWaterRoom(ctx: Ctx, w: number): void {
  drawShell(ctx, w, 23, [28]);

  // 큰 저장 탱크
  r(ctx, 5, 24, 21, 38, C.blue);
  r(ctx, 7, 22, 17, 2, C.blue);
  r(ctx, 9, 21, 13, 1, C.blueDark);
  r(ctx, 5, 24, 3, 38, C.blueLight);
  r(ctx, 5, 24, 1, 38, '#a9cbe6');
  r(ctx, 24, 24, 2, 38, C.blueDark);
  for (const y of [32, 44, 56]) {
    r(ctx, 5, y, 21, 2, C.blueDark);
    r(ctx, 5, y, 21, 1, C.steel);
  }
  // 수위 확인창
  r(ctx, 17, 27, 6, 29, C.steelDeep);
  r(ctx, 18, 28, 4, 27, '#0e2733');
  r(ctx, 18, 40, 4, 15, C.cyan);
  r(ctx, 18, 40, 4, 1, C.cyanLight);
  for (const y of [30, 34, 38]) p(ctx, 17, y, C.paper);
  // 다리
  r(ctx, 7, 62, 3, 4, C.steelDark);
  r(ctx, 21, 62, 3, 4, C.steelDark);
  // 탱크 → 천장 파이프
  r(ctx, 13, 8, 3, 14, C.steel);
  r(ctx, 13, 8, 1, 14, C.steelLight);
  r(ctx, 12, 20, 5, 2, C.steelDark);

  // 탱크 → 필터 연결 파이프
  r(ctx, 26, 49, 4, 3, C.steel);
  r(ctx, 26, 49, 4, 1, C.steelLight);
  // 필터 캐니스터 3개
  const bands: string[] = [C.cyan, C.greenLight, C.yellow];
  [30, 37, 44].forEach((x, i) => {
    r(ctx, x, 38, 6, 24, C.steel);
    r(ctx, x, 38, 1, 24, C.steelLight);
    r(ctx, x + 5, 38, 1, 24, C.steelDark);
    r(ctx, x + 1, 36, 4, 2, C.steelDark);
    r(ctx, x, 45, 6, 3, C.steelDeep);
    r(ctx, x + 1, 46, 4, 1, bands[i]);
    r(ctx, x + 1, 54, 4, 1, C.steelDark);
    r(ctx, x + 1, 62, 4, 2, C.steelDark);
  });
  // 필터 상단 연결 배관
  r(ctx, 31, 33, 18, 2, C.steel);
  r(ctx, 31, 33, 18, 1, C.steelLight);
  for (const x of [32, 39, 46]) r(ctx, x, 34, 2, 3, C.steelDark);
  // 압력계
  gauge(ctx, 47, 28, -1);

  // 우측 벽 밸브 휠
  r(ctx, 49, 14, 2, 8, C.steel);
  disc(ctx, 50, 18, 3, C.red);
  disc(ctx, 50, 18, 1, C.redDark);
  p(ctx, 50, 18, C.black);

  // 바닥 물웅덩이
  r(ctx, 33, FLOOR_TOP, 10, 1, '#2f7d9e');
  r(ctx, 35, FLOOR_TOP, 4, 1, C.cyanLight);
  // 이끼/얼룩
  speckle(ctx, 5, 24, 21, 38, [C.blueDark], 0.04, 31);
}

/* ───────────── 식량 재배실 ───────────── */
function plant(ctx: Ctx, x: number, y: number, seed: number): void {
  const tall = 3 + (seed % 3);
  r(ctx, x + 2, y - tall, 1, tall, C.greenDark);
  r(ctx, x + 1, y - tall - 1, 3, 2, C.green);
  p(ctx, x, y - tall, C.greenLight);
  p(ctx, x + 4, y - tall + 1, C.greenLight);
  p(ctx, x + 2, y - tall - 2, C.greenLight);
  if (seed % 4 === 0) {
    p(ctx, x + 3, y - 2, C.red);
  }
}

function drawFarmRoom(ctx: Ctx, w: number): void {
  drawShell(ctx, w, 37, [28]);

  // 수경재배 선반 3단
  const trays = [29, 43, 57];
  // 세로 기둥
  for (const x of [5, 27, 49]) {
    r(ctx, x, 12, 2, 52, C.steelDark);
    r(ctx, x, 12, 1, 52, C.steel);
  }
  trays.forEach((y, ti) => {
    // 재배 트레이
    r(ctx, 5, y, 47, 4, C.steelDark);
    r(ctx, 5, y, 47, 1, C.steelLight);
    r(ctx, 6, y + 1, 45, 2, '#2d4a3a');
    // 식물
    for (let i = 0; i < 8; i++) plant(ctx, 7 + i * 5.5, y, i + ti * 3);
    // 재배용 조명 바 (트레이 위쪽)
    r(ctx, 6, y - 13, 45, 3, C.steelDeep);
    r(ctx, 7, y - 11, 43, 1, '#e8ffd2');
    r(ctx, 7, y - 10, 43, 1, C.greenLight);
    // 급수 튜브
    r(ctx, 6, y + 4, 45, 1, C.blueDark);
  });
  // 세로 급수관
  r(ctx, 50, 8, 2, 56, C.blue);
  r(ctx, 50, 8, 1, 56, C.blueLight);
  for (const y of [20, 34, 48]) r(ctx, 49, y, 4, 2, C.steelDark);

  // 의자(휴식용) + 작은 상자
  r(ctx, 34, 61, 9, 2, C.wood);
  r(ctx, 34, 61, 9, 1, '#a87c52');
  r(ctx, 35, 63, 1, 3, C.woodDark);
  r(ctx, 41, 63, 1, 3, C.woodDark);
  r(ctx, 12, 60, 8, 6, C.woodDark);
  r(ctx, 12, 60, 8, 1, C.wood);
  r(ctx, 13, 62, 6, 1, C.wood);
}

/* ───────────── 나머지 시설 (같은 디자인 시스템의 1차 간단 버전) ───────────── */
function drawDormRoom(ctx: Ctx, w: number): void {
  drawShell(ctx, w, 41, [18, 42]);
  // 2층 침대
  r(ctx, 6, 36, 2, 30, C.steelDark);
  r(ctx, 26, 36, 2, 30, C.steelDark);
  for (const y of [42, 56]) {
    r(ctx, 6, y, 22, 2, C.steel);
    r(ctx, 7, y - 3, 20, 3, '#5c6f8a');
    r(ctx, 7, y - 3, 7, 3, C.paper);
  }
  // 사물함
  r(ctx, 33, 32, 11, 34, C.steelDark);
  r(ctx, 33, 32, 11, 1, C.steel);
  for (let i = 0; i < 2; i++) {
    r(ctx, 34 + i * 5, 34, 4, 30, C.steel);
    r(ctx, 35 + i * 5, 36, 2, 3, C.steelDeep);
    p(ctx, 36 + i * 5, 48, C.yellow);
  }
  r(ctx, 47, 46, 4, 6, C.rustDark);
  r(ctx, 47, 46, 4, 1, C.wood);
}

function drawMedicalRoom(ctx: Ctx, w: number): void {
  drawShell(ctx, w, 53, [20, 44]);
  // 병상
  r(ctx, 6, 54, 24, 3, C.paper);
  r(ctx, 6, 54, 24, 1, C.white);
  r(ctx, 6, 57, 24, 1, C.steelDark);
  r(ctx, 7, 58, 2, 8, C.steel);
  r(ctx, 27, 58, 2, 8, C.steel);
  r(ctx, 6, 51, 6, 3, C.white);
  // 링거대
  r(ctx, 34, 36, 1, 30, C.steelLight);
  r(ctx, 32, 36, 5, 1, C.steelLight);
  r(ctx, 32, 37, 3, 5, '#bfe4ee');
  r(ctx, 33, 42, 1, 6, C.cyanLight);
  r(ctx, 32, 66, 5, 1, C.steelDark);
  // 약품장
  r(ctx, 40, 32, 12, 34, '#b9c2c2');
  r(ctx, 40, 32, 12, 1, C.white);
  r(ctx, 40, 32, 1, 34, C.white);
  r(ctx, 51, 32, 1, 34, '#7f8a8a');
  r(ctx, 43, 36, 6, 1, C.red);
  r(ctx, 45, 34, 2, 5, C.red);
  for (const y of [44, 52, 60]) {
    r(ctx, 41, y, 10, 1, '#7f8a8a');
    r(ctx, 42, y - 4, 2, 4, '#7ab0a0');
    r(ctx, 45, y - 3, 2, 3, '#d9a64a');
    r(ctx, 48, y - 4, 2, 4, '#cfd8d8');
  }
}

function drawWorkshopRoom(ctx: Ctx, w: number): void {
  drawShell(ctx, w, 61, [18, 40]);
  // 공구 걸이판
  r(ctx, 6, 24, 28, 16, C.woodDark);
  r(ctx, 6, 24, 28, 1, C.wood);
  for (let i = 0; i < 6; i++) {
    r(ctx, 9 + i * 4, 27, 1, 8, C.steelLight);
    r(ctx, 8 + i * 4, 26, 3, 2, i % 2 ? C.rust : C.steel);
  }
  // 작업대
  r(ctx, 5, 52, 32, 3, C.wood);
  r(ctx, 5, 52, 32, 1, '#a87c52');
  r(ctx, 7, 55, 3, 11, C.woodDark);
  r(ctx, 32, 55, 3, 11, C.woodDark);
  r(ctx, 7, 60, 28, 1, C.woodDark);
  r(ctx, 28, 48, 5, 4, C.steelDark);
  r(ctx, 11, 49, 8, 3, C.steel);
  // 부품 보관 선반
  r(ctx, 40, 28, 12, 38, C.steelDark);
  for (const y of [32, 44, 56]) {
    r(ctx, 41, y + 8, 10, 1, C.steel);
    r(ctx, 42, y + 2, 4, 6, C.rust);
    r(ctx, 47, y + 3, 3, 5, C.steelLight);
  }
}

function drawLabRoom(ctx: Ctx, w: number): void {
  drawShell(ctx, w, 71, [20, 62]);
  // 실험 테이블
  r(ctx, 6, 52, 40, 3, '#8a929a');
  r(ctx, 6, 52, 40, 1, C.white);
  r(ctx, 8, 55, 3, 11, C.steelDark);
  r(ctx, 41, 55, 3, 11, C.steelDark);
  // 모니터
  r(ctx, 10, 38, 14, 11, C.steelDeep);
  r(ctx, 11, 39, 12, 9, '#0a2a32');
  r(ctx, 12, 41, 8, 1, C.cyan);
  r(ctx, 12, 43, 5, 1, C.cyanLight);
  r(ctx, 12, 45, 9, 1, C.cyan);
  r(ctx, 16, 49, 2, 3, C.steelDark);
  // 비커
  r(ctx, 30, 46, 5, 6, '#a9d8e0');
  r(ctx, 31, 49, 3, 3, C.green);
  r(ctx, 38, 48, 4, 4, '#a9d8e0');
  r(ctx, 39, 50, 2, 2, C.orange);
  // 서버 랙
  r(ctx, 58, 22, 20, 44, C.steelDark);
  r(ctx, 58, 22, 20, 1, C.steel);
  for (let y = 25; y < 63; y += 5) {
    r(ctx, 60, y, 16, 3, C.steelDeep);
    p(ctx, 61, y + 1, C.greenLight);
    p(ctx, 63, y + 1, y % 10 === 0 ? C.orange : C.cyan);
  }
}

function drawArmoryRoom(ctx: Ctx, w: number): void {
  drawShell(ctx, w, 83, [22, 62]);
  // 무기 걸이대
  r(ctx, 8, 28, 34, 22, C.steelDeep);
  r(ctx, 8, 28, 34, 1, C.steel);
  for (let i = 0; i < 4; i++) {
    const y = 32 + i * 5;
    r(ctx, 11, y, 28, 1, C.steelDark);
    r(ctx, 12, y - 1, 12, 2, C.black);
    r(ctx, 24, y - 1, 3, 2, C.woodDark);
    r(ctx, 27, y, 8, 1, C.black);
  }
  // 탄약 상자
  r(ctx, 50, 52, 14, 14, '#5d5c3a');
  r(ctx, 50, 52, 14, 2, '#76744a');
  r(ctx, 53, 57, 8, 1, C.yellow);
  r(ctx, 53, 60, 5, 1, C.yellow);
  r(ctx, 66, 58, 10, 8, '#4a4a30');
  r(ctx, 66, 58, 10, 1, '#6a6a44');
  // 방어 장비(방탄복 마네킹)
  r(ctx, 60, 30, 1, 22, C.steelDark);
  r(ctx, 56, 32, 9, 10, '#3b4233');
  r(ctx, 57, 33, 7, 3, '#4a5240');
  r(ctx, 58, 28, 5, 4, '#2e3328');
  // 벽 경고 표시
  drawGrid(ctx, 70, 24, ['..yy..', '.yyyy.', 'yykkyy', 'yykkyy'], { y: C.yellow, k: C.black });
}

/** 시설 종류별 방 그림 (w: 방 폭, 아트 픽셀) */
export function drawRoom(type: FacilityType, ctx: Ctx, w: number): void {
  switch (type) {
    case 'power_plant':
      return drawPowerRoom(ctx, w);
    case 'water_purifier':
      return drawWaterRoom(ctx, w);
    case 'farm':
      return drawFarmRoom(ctx, w);
    case 'dormitory':
      return drawDormRoom(ctx, w);
    case 'medical':
      return drawMedicalRoom(ctx, w);
    case 'workshop':
      return drawWorkshopRoom(ctx, w);
    case 'laboratory':
      return drawLabRoom(ctx, w);
    case 'armory':
      return drawArmoryRoom(ctx, w);
  }
}
