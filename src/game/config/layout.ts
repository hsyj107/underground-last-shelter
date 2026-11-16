/**
 * 논리 해상도: 모바일 세로 화면 기준 540 x 960.
 * Phaser의 Scale.FIT이 실제 화면 크기에 맞게 확대/축소한다.
 * (PC에서는 가운데에 세로 화면으로 표시된다.)
 */
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

/** 픽셀 아트 1칸이 화면에서 차지하는 크기(정수 배율 → 도트가 선명하게 유지된다) */
export const PX = 3;

export const LAYOUT = {
  topBarHeight: 120,
  bottomMenuHeight: 100,
  /** 지상(지표면) 영역 높이 */
  surfaceHeight: 69,
  /** 벙커 층 사이드 여백 */
  floorMargin: 16,
  get contentTop(): number {
    return this.topBarHeight;
  },
  get contentBottom(): number {
    return GAME_HEIGHT - this.bottomMenuHeight;
  },
  get contentHeight(): number {
    return this.contentBottom - this.contentTop;
  },
};
