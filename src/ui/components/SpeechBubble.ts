import Phaser from 'phaser';
import { GAME_WIDTH } from '../../game/config/layout';
import { createText } from '../styles/theme';

/** 캐릭터 머리 위에 잠깐 뜨는 말풍선. 벙커 레이어 안에 넣어 함께 움직인다. */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.label = createText(scene, 8, 5, '', { size: 13, bold: true, color: '#f1f3f5' });
    this.add([this.bg, this.label]);
    this.setVisible(false);
  }

  /** (x, headY) = 말하는 캐릭터의 머리 위치. ms 뒤에 사라진다. */
  say(x: number, headY: number, text: string, ms: number): void {
    this.label.setText(text);
    const w = Math.ceil(this.label.width) + 16;
    const h = Math.ceil(this.label.height) + 10;
    const left = Phaser.Math.Clamp(x - w / 2, 6, GAME_WIDTH - w - 6);
    const tailX = Phaser.Math.Clamp(x - left, 10, w - 10);

    this.bg.clear();
    this.bg.fillStyle(0x10141a, 0.96).fillRect(0, 0, w, h);
    this.bg.fillTriangle(tailX - 5, h, tailX + 5, h, tailX, h + 6);
    this.bg.lineStyle(1, 0x9aa5b1, 1).strokeRect(0.5, 0.5, w - 1, h - 1);

    this.setPosition(left, headY - h - 12).setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 120 });
    this.timer?.remove(false);
    this.timer = this.scene.time.delayedCall(ms, () => this.hide());
  }

  hide(): void {
    this.timer?.remove(false);
    this.timer = null;
    this.setVisible(false);
  }
}
