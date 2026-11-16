import Phaser from 'phaser';
import type { BunkerSummary } from '../../types';
import { VISIBLE_RESOURCES } from '../../data/resources';
import { GAME_WIDTH, LAYOUT } from '../../game/config/layout';
import { COLORS, TEXT_COLORS, createText } from '../styles/theme';

/** 화면 상단: 자원 4종 + 벙커 레벨 / 생존자 수 / 안정도 */
export class ResourceBar extends Phaser.GameObjects.Container {
  private valueTexts = new Map<string, Phaser.GameObjects.Text>();
  private levelText!: Phaser.GameObjects.Text;
  private survivorText!: Phaser.GameObjects.Text;
  private stabilityText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.build();
    scene.add.existing(this);
  }

  /** 표시할 값을 갱신한다. */
  setSummary(summary: BunkerSummary): void {
    for (const res of VISIBLE_RESOURCES) {
      this.valueTexts.get(res.type)?.setText(summary.resources[res.type].toLocaleString('ko-KR'));
    }
    this.levelText.setText(`벙커 Lv.${summary.level}`);
    this.survivorText.setText(`생존자 ${summary.survivors}/${summary.survivorCapacity}`);
    this.stabilityText.setText(`안정도 ${summary.stability}%`);
    this.stabilityText.setColor(summary.stability >= 50 ? TEXT_COLORS.good : TEXT_COLORS.warn);
  }

  private build(): void {
    const h = LAYOUT.topBarHeight;

    const bg = this.scene.add.rectangle(0, 0, GAME_WIDTH, h, COLORS.barBg).setOrigin(0, 0);
    const line = this.scene.add
      .rectangle(0, h - 2, GAME_WIDTH, 2, COLORS.panelBorder)
      .setOrigin(0, 0);
    this.add([bg, line]);

    // 1행: 자원
    const cellW = GAME_WIDTH / VISIBLE_RESOURCES.length;
    VISIBLE_RESOURCES.forEach((res, i) => {
      const x = cellW * i;
      const icon = this.scene.add.image(x + 26, 36, res.iconKey).setDisplaySize(28, 28);
      const label = createText(this.scene, x + 46, 14, res.label, { size: 12, color: TEXT_COLORS.sub });
      const value = createText(this.scene, x + 46, 30, '0', { size: 20, bold: true });
      this.valueTexts.set(res.type, value);
      this.add([icon, label, value]);
    });

    // 구분선
    this.add(this.scene.add.rectangle(16, 72, GAME_WIDTH - 32, 1, COLORS.panelBorder).setOrigin(0, 0));

    // 2행: 벙커 정보 (3등분)
    const infoW = GAME_WIDTH / 3;
    const infoY = 96;
    this.levelText = createText(this.scene, infoW * 0.5, infoY, '', {
      size: 16,
      bold: true,
      color: TEXT_COLORS.accent,
      originX: 0.5,
      originY: 0.5,
    });
    this.survivorText = createText(this.scene, infoW * 1.5, infoY, '', {
      size: 16,
      bold: true,
      originX: 0.5,
      originY: 0.5,
    });
    this.stabilityText = createText(this.scene, infoW * 2.5, infoY, '', {
      size: 16,
      bold: true,
      originX: 0.5,
      originY: 0.5,
    });
    this.add([this.levelText, this.survivorText, this.stabilityText]);
  }
}
