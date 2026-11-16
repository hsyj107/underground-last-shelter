import type { BunkerSummary } from '../types';

/**
 * ⚠ 임시 데이터 (1단계 화면 확인용).
 * 실제 서버(Supabase) 데이터가 아니며, 6단계에서 서버 데이터로 교체한다.
 */
export const MOCK_BUNKER_SUMMARY: BunkerSummary = {
  level: 1,
  survivors: 5,
  survivorCapacity: 10,
  stability: 80,
  resources: {
    food: 500,
    water: 500,
    power: 300,
    iron: 200,
    parts: 0,
    fuel: 0,
  },
};
