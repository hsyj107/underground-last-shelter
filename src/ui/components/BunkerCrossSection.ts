import Phaser from 'phaser';
import { FACILITIES, FLOOR_COUNT } from '../../data/facilities';
import { GAME_WIDTH, LAYOUT } from '../../game/config/layout';
import { COLORS, TEXT_COLORS, createText } from '../styles/theme';

/**
 * 벙커 수직 단면 (1단계: 자리 확보용 임시 도형).
 * 지상 1칸 + 지하 3개 층, 시설 8종의 자리를 표시한다.
 * 2단계에서 실제 시설/생존자 연출로 대체한다.
 */
export class BunkerCrossSection extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.build();
    scene.add.existing(this);
  }

  private build(): void {
    const top = LAYOUT.contentTop;
    const surfaceH = LAYOUT.surfaceHeight;
    const margin = LAYOUT.floorMargin;
    const floorH = (LAYOUT.contentHeight - surfaceH) / FLOOR_COUNT;

    // 지상
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.surface, 1);
    g.fillRect(0, top, GAME_WIDTH, surfaceH);
    // 폐허 실루엣
    g.fillStyle(0x10161d, 1);
    g.fillRect(30, top + 20, 40, surfaceH - 26);
    g.fillRect(90, top + 34, 30, surfaceH - 40);
    g.fillRect(380, top + 14, 50, surfaceH - 20);
    g.fillRect(450, top + 30, 36, surfaceH - 36);
    // 지면
    g.fillStyle(COLORS.ground, 1);
    g.fillRect(0, top + surfaceH - 6, GAME_WIDTH, 6);
    this.add(g);
    this.add(
      createText(this.scene, GAME_WIDTH / 2, top + 24, '지상 (위험 지역)', {
        size: 13,
        color: TEXT_COLORS.sub,
        originX: 0.5,
        originY: 0.5,
      }),
    );

    // 지하 층
    for (let floor = 1; floor <= FLOOR_COUNT; floor++) {
      const y = top + surfaceH + (floor - 1) * floorH;
      const panelW = GAME_WIDTH - margin * 2;

      const panel = this.scene.add
        .rectangle(margin, y + 4, panelW, floorH - 8, COLORS.panel)
        .setOrigin(0, 0)
        .setStrokeStyle(2, COLORS.panelBorder);
      this.add(panel);
      this.add(createText(this.scene, margin + 10, y + 12, `지하 ${floor}층`, { size: 13, color: TEXT_COLORS.sub }));

      const facilities = FACILITIES.filter((f) => f.floor === floor).sort((a, b) => a.slot - b.slot);
      const count = facilities.length;
      if (count === 0) continue;

      const gap = 10;
      const boxW = (panelW - gap * (count + 1)) / count;
      const boxH = floorH - 8 - 44;
      const boxY = y + 4 + 34;

      facilities.forEach((facility, i) => {
        const boxX = margin + gap + i * (boxW + gap);
        const box = this.scene.add
          .rectangle(boxX, boxY, boxW, boxH, facility.color, 0.25)
          .setOrigin(0, 0)
          .setStrokeStyle(2, facility.color, 0.9);
        const name = createText(this.scene, boxX + boxW / 2, boxY + boxH / 2, facility.name, {
          size: 16,
          bold: true,
          originX: 0.5,
          originY: 0.5,
        });
        this.add([box, name]);
      });
    }
  }
}
