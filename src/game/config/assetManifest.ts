/**
 * 에셋 목록.
 *
 * - file 이 없으면: 코드가 임시 도형(placeholder)을 자동 생성한다.
 * - 픽셀 아트가 준비되면: file 에 경로만 적으면 그 이미지로 교체된다.
 *   예) file: 'assets/icons/food.png'  (public/ 폴더 기준)
 * - 이미지 파일을 못 불러와도 placeholder 로 대체되어 게임이 멈추지 않는다.
 */
export type PlaceholderShape = 'circle' | 'rect' | 'triangle' | 'diamond';

export interface AssetEntry {
  key: string;
  file?: string;
  placeholder: {
    width: number;
    height: number;
    color: number;
    shape: PlaceholderShape;
  };
}

const icon = (key: string, color: number, shape: PlaceholderShape): AssetEntry => ({
  key,
  placeholder: { width: 32, height: 32, color, shape },
});

export const ASSET_MANIFEST: AssetEntry[] = [
  // 자원 아이콘
  icon('icon-food', 0x6fcf6f, 'circle'),
  icon('icon-water', 0x4aa8e0, 'diamond'),
  icon('icon-power', 0xf2c94c, 'triangle'),
  icon('icon-iron', 0x9aa5b1, 'rect'),
  icon('icon-parts', 0xe08a3c, 'rect'),
  icon('icon-fuel', 0xc0504d, 'diamond'),

  // 하단 메뉴 아이콘
  icon('menu-bunker', 0xd0d7de, 'rect'),
  icon('menu-expedition', 0xd0d7de, 'triangle'),
  icon('menu-survivors', 0xd0d7de, 'circle'),
  icon('menu-world', 0xd0d7de, 'diamond'),
  icon('menu-shop', 0xd0d7de, 'rect'),
];
