import Phaser from 'phaser';
import { COLORS } from '../../ui/styles/theme';

/** 최소한의 설정만 하고 PreloadScene으로 넘어간다. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bgTop);
    // 터치 2점까지 허용 (이후 핀치 확대 등 대비)
    this.input.addPointer(1);
    this.scene.start('PreloadScene');
  }
}
