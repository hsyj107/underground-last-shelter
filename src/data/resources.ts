import type { ResourceDef } from '../types';

/** 자원 정의. 부품/연료는 visible=false → 관련 기능이 열릴 때 true로 변경한다. */
export const RESOURCE_DEFS: ResourceDef[] = [
  { type: 'food', label: '식량', visible: true, iconKey: 'icon-food' },
  { type: 'water', label: '물', visible: true, iconKey: 'icon-water' },
  { type: 'power', label: '전력', visible: true, iconKey: 'icon-power' },
  { type: 'iron', label: '철', visible: true, iconKey: 'icon-iron' },
  { type: 'parts', label: '부품', visible: false, iconKey: 'icon-parts' },
  { type: 'fuel', label: '연료', visible: false, iconKey: 'icon-fuel' },
];

export const VISIBLE_RESOURCES = RESOURCE_DEFS.filter((r) => r.visible);
