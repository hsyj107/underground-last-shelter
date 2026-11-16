import type { SurvivorProfile } from '../types';

/**
 * ⚠ 임시 데이터 (화면 확인용). 4단계(생존자 시스템)에서 실제 모집/배치 데이터로 교체한다.
 * MOCK_BUNKER_SUMMARY.survivors 의 숫자와 맞춰 두었다.
 */
export const MOCK_SURVIVORS: SurvivorProfile[] = [
  { id: 's1', name: '한도윤', job: 'engineer', facility: 'power_plant', sprite: 'c_beard' },
  { id: 's2', name: '서지우', job: 'engineer', facility: 'water_purifier', sprite: 'c_strong' },
  { id: 's3', name: '박민재', job: 'farmer', facility: 'farm', sprite: 'c_glasses' },
  { id: 's4', name: '최하은', job: 'medic', facility: 'medical', sprite: 'c_woman1' },
  { id: 's5', name: '이강훈', job: 'guard', facility: 'armory', sprite: 'c_big' },
];
