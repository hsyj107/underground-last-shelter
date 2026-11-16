/**
 * 탐험 지역.
 * ⚠ 시간·보상·확률은 시험용 값이다. (시간은 확인하기 쉽게 아주 짧게 잡았다)
 */
export interface ExpeditionArea {
  id: string;
  name: string;
  description: string;
  /** 필요한 대장 레벨 */
  playerLevel: number;
  /** 걸리는 시간(초) */
  seconds: number;
  xp: number;
  /** 얻는 자원 범위 [최소, 최대] */
  iron: [number, number];
  food: [number, number];
  water: [number, number];
  /** 일반 생존자를 만날 확률 (0~1) */
  survivorChance: number;
}

export const EXPEDITION_AREAS: ExpeditionArea[] = [
  {
    id: 'outskirts', name: '폐허가 된 주택가', description: '벙커 입구 주변. 비교적 조용하다.',
    playerLevel: 1, seconds: 20, xp: 40, iron: [30, 50], food: [10, 25], water: [10, 25], survivorChance: 0.45,
  },
  {
    id: 'market', name: '버려진 시장', description: '먹을 것이 남아 있지만 놈들도 많다.',
    playerLevel: 2, seconds: 45, xp: 70, iron: [40, 70], food: [30, 60], water: [15, 30], survivorChance: 0.5,
  },
  {
    id: 'hospital', name: '시립 병원', description: '약품과 사람을 찾을 수 있을지도 모른다.',
    playerLevel: 4, seconds: 90, xp: 120, iron: [60, 100], food: [20, 40], water: [30, 50], survivorChance: 0.5,
  },
  {
    id: 'factory', name: '공단 지대', description: '고철과 부품이 널려 있다.',
    playerLevel: 6, seconds: 150, xp: 180, iron: [120, 200], food: [20, 40], water: [20, 40], survivorChance: 0.55,
  },
  {
    id: 'checkpoint', name: '군 검문소', description: '무너진 방어선. 가장 위험하다.',
    playerLevel: 8, seconds: 240, xp: 260, iron: [150, 250], food: [40, 70], water: [40, 70], survivorChance: 0.6,
  },
];
