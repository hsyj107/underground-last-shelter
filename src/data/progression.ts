import type { FacilityType } from '../types';

/**
 * 성장 규칙.
 * ⚠ 모든 숫자는 시험용 값이다. 해 보면서 조절한다.
 */

/** 시설 최고 레벨 */
export const MAX_FACILITY_LEVEL = 5;

export interface UnlockRule {
  /** 필요한 대장(주인공) 레벨 */
  playerLevel: number;
  /** 필요한 이전 시설과 그 레벨 */
  prev?: { type: FacilityType; level: number };
  /** 개방에 드는 철 */
  iron: number;
}

/** 시설을 개방하는 조건: 대장 레벨 + 바로 위층 시설의 레벨 + 철 */
export const UNLOCK_RULES: Record<FacilityType, UnlockRule> = {
  power_plant: { playerLevel: 1, iron: 0 },
  water_purifier: { playerLevel: 2, prev: { type: 'power_plant', level: 2 }, iron: 50 },
  farm: { playerLevel: 3, prev: { type: 'water_purifier', level: 2 }, iron: 100 },
  dormitory: { playerLevel: 4, prev: { type: 'farm', level: 2 }, iron: 150 },
  medical: { playerLevel: 5, prev: { type: 'dormitory', level: 2 }, iron: 200 },
  workshop: { playerLevel: 6, prev: { type: 'medical', level: 2 }, iron: 300 },
  laboratory: { playerLevel: 8, prev: { type: 'workshop', level: 3 }, iron: 400 },
  armory: { playerLevel: 10, prev: { type: 'laboratory', level: 3 }, iron: 500 },
};

/** 시설을 다음 레벨로 올리는 데 드는 철 (현재 레벨 기준) */
export const upgradeCost = (level: number): number => 40 * level;

/** 대장이 다음 레벨이 되는 데 필요한 경험치 (현재 레벨 기준) */
export const xpToNext = (level: number): number => 60 * level;

/** 받아들일 수 있는 생존자 수 (대장 제외). 숙소 레벨이 오르면 늘어난다. */
export const survivorCapacity = (dormitoryLevel: number): number => 3 + dormitoryLevel * 3;

/** 시설 하나에 배치할 수 있는 인원 (지금은 1명. 이후 시설 레벨에 따라 늘린다) */
export const FACILITY_SLOTS = 1;
