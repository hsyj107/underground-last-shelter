import type { FacilityType } from '../types';

export interface FacilityInfo {
  description: string;
  /** 생산 또는 기능 설명 */
  effect: string;
  /** 소비 설명 */
  consume: string;
}

/**
 * 시설 상세 패널에 표시되는 설명.
 * ⚠ 생산·소비 수치는 개발 지시서의 "테스트용 초기값"이며 확정 밸런스가 아니다.
 * 3단계(자원/건설)에서 실제 설정 데이터로 교체한다.
 */
export const FACILITY_INFO: Record<FacilityType, FacilityInfo> = {
  power_plant: {
    description: '벙커 전체에 전력을 공급하는 대형 발전기.',
    effect: '전력 +100 /시간',
    consume: '연료 -10 /시간',
  },
  water_purifier: {
    description: '오염된 물을 걸러 식수로 만드는 정수 시설.',
    effect: '물 +100 /시간',
    consume: '전력 -15 /시간',
  },
  farm: {
    description: '조명 아래에서 작물을 키우는 수경재배실.',
    effect: '식량 +100 /시간',
    consume: '물 -30 · 전력 -10 /시간',
  },
  dormitory: {
    description: '생존자들이 쉬고 잠자는 공간.',
    effect: '생존자 수용',
    consume: '—',
  },
  medical: {
    description: '부상과 감염을 치료하는 의료 시설.',
    effect: '부상·감염 치료',
    consume: '—',
  },
  workshop: {
    description: '장비와 물품을 만드는 작업 공간.',
    effect: '장비·아이템 제작',
    consume: '—',
  },
  laboratory: {
    description: '생존 기술을 연구하는 실험실.',
    effect: '기술 연구',
    consume: '—',
  },
  armory: {
    description: '무기와 방어 장비를 보관하는 창고.',
    effect: '장비 보관·관리',
    consume: '—',
  },
};
