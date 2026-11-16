import Phaser from 'phaser';
import type { MenuId, MenuItem } from '../../types';
import { GAME_HEIGHT, GAME_WIDTH, LAYOUT } from '../../game/config/layout';
import { COLORS, TEXT_COLORS, createText } from '../styles/theme';

interface MenuButton {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  indicator: Phaser.GameObjects.Rectangle;
}

/** 화면 하단: 메인 메뉴 5개 */
export class BottomMenu extends Phaser.GameObjects.Container {
  private buttons = new Map<MenuId, MenuButton>();

  constructor(
    scene: Phaser.Scene,
    private readonly items: MenuItem[],
    private readonly onSelect: (id: MenuId) => void,
  ) {
    super(scene, 0, GAME_HEIGHT - LAYOUT.bottomMenuHeight);
    this.build();
    scene.add.existing(this);
  }

  /** 선택된 메뉴를 강조 표시한다. */
  highlight(activeId: MenuId): void {
    this.buttons.forEach((btn, id) => {
      const active = id === activeId;
      btn.icon.setAlpha(active ? 1 : 0.5);
      btn.label.setColor(active ? TEXT_COLORS.accent : TEXT_COLORS.sub);
      btn.indicator.setVisible(active);
    });
  }

  private build(): void {
    const h = LAYOUT.bottomMenuHeight;
    const bg = this.scene.add.rectangle(0, 0, GAME_WIDTH, h, COLORS.barBg).setOrigin(0, 0);
    const line = this.scene.add.rectangle(0, 0, GAME_WIDTH, 2, COLORS.panelBorder).setOrigin(0, 0);
    this.add([bg, line]);

    const cellW = GAME_WIDTH / this.items.length;

    this.items.forEach((item, i) => {
      const cx = cellW * (i + 0.5);

      const indicator = this.scene.add
        .rectangle(cx, 1, cellW - 20, 4, COLORS.accent)
        .setOrigin(0.5, 0.5)
        .setVisible(false);
      const icon = this.scene.add.image(cx, 38, item.iconKey).setDisplaySize(32, 32);
      const label = createText(this.scene, cx, 72, item.label, {
        size: 15,
        bold: true,
        color: TEXT_COLORS.sub,
        originX: 0.5,
        originY: 0.5,
      });

      // 터치 영역: 칸 전체 (모바일에서 누르기 쉽게)
      const hit = this.scene.add
        .zone(cx, h / 2, cellW, h)
        .setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_DOWN, () => this.onSelect(item.id));

      this.add([indicator, icon, label, hit]);
      this.buttons.set(item.id, { icon, label, indicator });
    });
  }
}
