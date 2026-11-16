import Phaser from 'phaser';
import { ASSET_MANIFEST, type AssetEntry } from '../config/assetManifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { COLORS, TEXT_COLORS, createText } from '../../ui/styles/theme';

/** 에셋 로딩 + 임시 도형(placeholder) 생성 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    this.drawLoadingBar();

    // 이미지 파일이 지정된 에셋만 실제로 불러온다.
    for (const asset of ASSET_MANIFEST) {
      if (asset.file) {
        this.load.image(asset.key, asset.file);
      }
    }

    // 파일 하나가 실패해도 게임이 멈추지 않는다. (create에서 placeholder로 대체)
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[에셋 로드 실패] ${file.key} → 임시 도형으로 대체합니다.`);
    });
  }

  create(): void {
    for (const asset of ASSET_MANIFEST) {
      if (this.textures.exists(asset.key)) {
        // 실제 픽셀 아트는 선명하게(도트 유지) 표시한다.
        this.textures.get(asset.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      } else {
        this.createPlaceholder(asset);
      }
    }
    this.scene.start('BunkerScene');
  }

  private drawLoadingBar(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const barW = 300;

    createText(this, cx, cy - 40, 'UNDERGROUND: LAST SHELTER', {
      size: 20,
      bold: true,
      color: TEXT_COLORS.accent,
      originX: 0.5,
      originY: 0.5,
    });

    const frame = this.add.rectangle(cx, cy, barW, 14, COLORS.panel).setStrokeStyle(2, COLORS.panelBorder);
    const fill = this.add.rectangle(cx - barW / 2 + 2, cy, 0, 10, COLORS.accent).setOrigin(0, 0.5);
    frame.setDepth(0);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      fill.width = (barW - 4) * value;
    });
  }

  private createPlaceholder(asset: AssetEntry): void {
    const { width, height, color, shape } = asset.placeholder;
    const g = this.make.graphics({}, false);
    g.fillStyle(color, 1);

    switch (shape) {
      case 'circle':
        g.fillCircle(width / 2, height / 2, Math.min(width, height) / 2 - 1);
        break;
      case 'triangle':
        g.fillTriangle(width / 2, 1, width - 1, height - 1, 1, height - 1);
        break;
      case 'diamond':
        g.fillPoints(
          [
            new Phaser.Geom.Point(width / 2, 1),
            new Phaser.Geom.Point(width - 1, height / 2),
            new Phaser.Geom.Point(width / 2, height - 1),
            new Phaser.Geom.Point(1, height / 2),
          ],
          true,
        );
        break;
      case 'rect':
      default:
        g.fillRect(2, 2, width - 4, height - 4);
        break;
    }

    g.generateTexture(asset.key, width, height);
    g.destroy();
  }
}
