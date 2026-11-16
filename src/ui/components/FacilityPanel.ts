import Phaser from 'phaser';
import { JOBS } from '../../data/jobs';
import { FACILITY_INFO } from '../../data/facilityInfo';
import { GAME_WIDTH, LAYOUT } from '../../game/config/layout';
import type { FacilityDef, SurvivorProfile } from '../../types';
import { TEXT_COLORS, createText } from '../styles/theme';

const PANEL_W = GAME_WIDTH - 32;
const PANEL_H = 176;
const AMBER = 0xf2a93b;

/** 시설을 선택하면 나타나는 상세 패널 (아래쪽, 아래층을 선택했을 때는 위쪽에 표시) */
export class FacilityPanel extends Phaser.GameObjects.Container {
  private readonly title: Phaser.GameObjects.Text;
  private readonly level: Phaser.GameObjects.Text;
  private readonly desc: Phaser.GameObjects.Text;
  private readonly effect: Phaser.GameObjects.Text;
  private readonly consume: Phaser.GameObjects.Text;
  private readonly workers: Phaser.GameObjects.Text;
  private readonly upgradeLabel: Phaser.GameObjects.Text;
  private readonly assignLabel: Phaser.GameObjects.Text;
  private flashTimer: Phaser.Time.TimerEvent | null = null;
  private open = false;

  constructor(scene: Phaser.Scene, private readonly onClose: () => void) {
    super(scene, 16, 0);

    // 배경: 어두운 금속 판 + 위쪽 호박색 선
    const bg = scene.add.graphics();
    bg.fillStyle(0x0d1015, 0.97).fillRect(0, 0, PANEL_W, PANEL_H);
    bg.fillStyle(0x1a1f26, 1).fillRect(3, 3, PANEL_W - 6, PANEL_H - 6);
    bg.lineStyle(2, 0x3a4048, 1).strokeRect(1, 1, PANEL_W - 2, PANEL_H - 2);
    bg.fillStyle(AMBER, 1).fillRect(3, 3, PANEL_W - 6, 3);
    for (const [rx, ry] of [[8, 12], [PANEL_W - 10, 12], [8, PANEL_H - 10], [PANEL_W - 10, PANEL_H - 10]]) {
      bg.fillStyle(0x59616b, 1).fillRect(rx, ry, 3, 3);
    }
    this.add(bg);

    // 패널 뒤의 방이 눌리지 않도록 터치를 막는다.
    const blocker = scene.add.zone(PANEL_W / 2, PANEL_H / 2, PANEL_W, PANEL_H).setInteractive();
    this.add(blocker);

    this.title = createText(scene, 16, 14, '', { size: 20, bold: true, color: TEXT_COLORS.accent });
    this.level = createText(scene, 0, 20, 'Lv.1', { size: 13, bold: true, color: TEXT_COLORS.sub });
    this.desc = createText(scene, 16, 42, '', { size: 13, color: TEXT_COLORS.sub });
    this.desc.setWordWrapWidth(PANEL_W - 32);

    const label = (text: string, y: number): Phaser.GameObjects.Text =>
      createText(scene, 16, y, text, { size: 13, color: TEXT_COLORS.sub });
    this.effect = createText(scene, 78, 68, '', { size: 14, bold: true, color: TEXT_COLORS.good });
    this.consume = createText(scene, 78, 90, '', { size: 14, bold: true, color: '#e8a27a' });
    this.workers = createText(scene, 78, 112, '', { size: 14, bold: true });
    this.workers.setWordWrapWidth(PANEL_W - 94);
    this.add([
      this.title, this.level, this.desc,
      label('효과', 69), label('소비', 91), label('작업자', 113),
      this.effect, this.consume, this.workers,
    ]);

    // 닫기 버튼
    const close = createText(scene, PANEL_W - 28, 6, '×', { size: 30, bold: true, color: TEXT_COLORS.sub });
    const closeHit = scene.add.zone(PANEL_W - 22, 22, 48, 44).setInteractive({ useHandCursor: true });
    closeHit.on(Phaser.Input.Events.POINTER_DOWN, () => this.onClose());
    this.add([close, closeHit]);

    // 버튼 2개 (건설/배치 기능은 이후 단계에서 연결)
    this.upgradeLabel = this.makeButton(scene, 16, '업그레이드', '3단계에서 구현 예정');
    this.assignLabel = this.makeButton(scene, PANEL_W / 2 + 4, '생존자 배치', '4단계에서 구현 예정');

    this.setDepth(50).setVisible(false);
    scene.add.existing(this);
  }

  /** 화면 좌표가 열려 있는 패널 위인지 (벙커 터치와 겹치지 않게 할 때 사용) */
  containsPoint(x: number, y: number): boolean {
    return this.open && x >= this.x && x <= this.x + PANEL_W && y >= this.y - 14 && y <= this.y + PANEL_H + 14;
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(facility: FacilityDef, workers: SurvivorProfile[], placeTop: boolean): void {
    const info = FACILITY_INFO[facility.type];
    this.title.setText(facility.name);
    this.level.setX(16 + this.title.width + 10);
    this.desc.setText(info.description);
    this.effect.setText(info.effect);
    this.consume.setText(info.consume);
    this.workers.setText(
      workers.length > 0
        ? workers.map((w) => `${w.name} (${JOBS[w.job].label})`).join(', ')
        : '배치된 생존자 없음',
    );
    this.workers.setColor(workers.length > 0 ? TEXT_COLORS.main : TEXT_COLORS.sub);
    this.resetButtons();

    const y = placeTop ? LAYOUT.contentTop + 4 : LAYOUT.contentBottom - PANEL_H - 4;
    const slide = placeTop ? -14 : 14;
    this.open = true;
    this.setVisible(true).setAlpha(0).setY(y + slide);
    this.scene.tweens.add({ targets: this, alpha: 1, y, duration: 140, ease: 'Sine.easeOut' });
  }

  hide(): void {
    this.open = false;
    this.flashTimer?.remove(false);
    this.flashTimer = null;
    this.setVisible(false);
  }

  private resetButtons(): void {
    this.upgradeLabel.setText('업그레이드');
    this.assignLabel.setText('생존자 배치');
    this.upgradeLabel.setColor(TEXT_COLORS.sub);
    this.assignLabel.setColor(TEXT_COLORS.sub);
  }

  private makeButton(scene: Phaser.Scene, x: number, text: string, notice: string): Phaser.GameObjects.Text {
    const w = PANEL_W / 2 - 20;
    const h = 36;
    const y = 134;
    const g = scene.add.graphics();
    g.fillStyle(0x252b33, 1).fillRect(x, y, w, h);
    g.fillStyle(0x3a4048, 1).fillRect(x, y, w, 2);
    g.lineStyle(2, 0x3a4048, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
    const label = createText(scene, x + w / 2, y + h / 2, text, {
      size: 15,
      bold: true,
      color: TEXT_COLORS.sub,
      originX: 0.5,
      originY: 0.5,
    });
    const hit = scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.POINTER_DOWN, () => {
      label.setText(notice).setColor(TEXT_COLORS.accent);
      this.flashTimer?.remove(false);
      this.flashTimer = scene.time.delayedCall(1400, () => {
        label.setText(text).setColor(TEXT_COLORS.sub);
      });
    });
    this.add([g, label, hit]);
    return label;
  }
}
