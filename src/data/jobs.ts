import type { JobType } from '../types';

/** 직업 표시 이름과 외형(look) 키. 외형 정의는 src/art/survivorArt.ts */
export const JOBS: Record<JobType, { label: string; look: string }> = {
  engineer: { label: '기술자', look: 'engineer' },
  medic: { label: '의무병', look: 'medic' },
  farmer: { label: '농업 전문가', look: 'farmer' },
  scout: { label: '정찰병', look: 'scout' },
  guard: { label: '경비병', look: 'guard' },
};
