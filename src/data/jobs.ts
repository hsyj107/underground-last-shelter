import type { JobType } from '../types';

/** 직업 표시 이름 */
export const JOBS: Record<JobType, { label: string }> = {
  engineer: { label: '기술자' },
  medic: { label: '의무병' },
  farmer: { label: '농업 전문가' },
  scout: { label: '정찰병' },
  guard: { label: '경비병' },
  caretaker: { label: '살림꾼' },
  mechanic: { label: '기계공' },
  researcher: { label: '연구원' },
};
