import type { MenuItem } from '../types';

export const MENU_ITEMS: MenuItem[] = [
  { id: 'bunker', label: '벙커', iconKey: 'menu-bunker' },
  { id: 'expedition', label: '탐험', iconKey: 'menu-expedition' },
  { id: 'survivors', label: '생존자', iconKey: 'menu-survivors' },
  { id: 'world', label: '월드', iconKey: 'menu-world', plannedStage: 7 },
  { id: 'shop', label: '상점', iconKey: 'menu-shop', plannedStage: 8 },
];
