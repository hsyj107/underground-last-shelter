import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { BunkerScene } from '../scenes/BunkerScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { COLORS } from '../../ui/styles/theme';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: COLORS.bgTop,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    // 화면 비율을 유지한 채 창 크기에 맞춰 확대/축소 (모바일·PC 공통)
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    activePointers: 2,
  },
  render: {
    antialias: true,
    roundPixels: true,
  },
  scene: [BootScene, PreloadScene, BunkerScene],
};
