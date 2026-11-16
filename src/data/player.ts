import type { PlayerProfile } from '../types';

/** 처음 서 있는 위치 (지하 1층, 방 왼쪽 기준 x) */
export const PLAYER_START_X = 330;

/**
 * 성별·연령대에 따른 메인 캐릭터 그림.
 * ⚠ 지금 가진 캐릭터 그림 안에서 고른 것이다. (여성 50대 이상은 전용 그림이 아직 없다)
 */
export function playerSprite(profile: PlayerProfile | null): string {
  if (!profile) return 'c_man_red';
  if (profile.gender === 'male') {
    return { young: 'c_man_red', middle: 'c_glasses', senior: 'c_elder' }[profile.age];
  }
  return { young: 'c_woman2', middle: 'c_woman1', senior: 'c_woman1' }[profile.age];
}

export const GENDER_LABEL = { male: '남성', female: '여성' } as const;
export const AGE_LABEL = { young: '20대', middle: '30~40대', senior: '50대 이상' } as const;
