import Phaser from 'phaser';

/** 숫자 색상: 도형 채우기용 / 문자열 색상: 텍스트용 */
export const COLORS = {
  bgTop: 0x0b0e12,
  bgBottom: 0x151b22,
  panel: 0x121820,
  panelBorder: 0x2a3340,
  barBg: 0x0e1218,
  accent: 0xf2a93b,
  ground: 0x3a2f25,
  surface: 0x1b2430,
} as const;

export const TEXT_COLORS = {
  main: '#e8edf2',
  sub: '#8b98a7',
  accent: '#f2a93b',
  good: '#6fcf6f',
  warn: '#ff6b6b',
} as const;

export const FONT_FAMILY =
  '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif';

export interface TextOptions {
  size?: number;
  color?: string;
  bold?: boolean;
  originX?: number;
  originY?: number;
}

/** 고해상도 화면에서도 글자가 흐려지지 않는 텍스트 생성 헬퍼 */
export function createText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const { size = 16, color = TEXT_COLORS.main, bold = false, originX = 0, originY = 0 } = options;
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      resolution: Math.max(2, Math.ceil(window.devicePixelRatio || 1)),
    })
    .setOrigin(originX, originY);
}
