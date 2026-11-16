import Phaser from 'phaser';
import type { MenuId } from '../../types';
import { MENU_ITEMS } from '../../data/menus';
import { MOCK_BUNKER_SUMMARY } from '../../data/mockState';
import { GAME_HEIGHT, GAME_WIDTH, LAYOUT } from '../config/layout';
import { BottomMenu } from '../../ui/components/BottomMenu';
import { BunkerCrossSection } from '../../ui/components/BunkerCrossSection';
import { ResourceBar } from '../../ui/components/ResourceBar';
import { COLORS, TEXT_COLORS, createText } from '../../ui/styles/theme';

/** 메인 화면: 상단 자원바 + 중앙 벙커 영역 + 하단 메뉴 */
export class BunkerScene extends Phaser.Scene {
  private resourceBar!: ResourceBar;
  private bottomMenu!: BottomMenu;
  private bunkerView!: BunkerCrossSection;
  private comingSoon!: Phaser.GameObjects.Container;
  private comingSoonText!: Phaser.GameObjects.Text;
  private activeMenu: MenuId = 'bunker';

  constructor() {
    super('BunkerScene');
  }

  create(): void {
    this.drawBackground();

    this.bunkerView = new BunkerCrossSection(this);
    this.comingSoon = this.createComingSoonPanel();

    this.resourceBar = new ResourceBar(this);
    this.bottomMenu = new BottomMenu(this, MENU_ITEMS, (id) => this.selectMenu(id));

    // 임시 데이터로 화면 확인 (6단계에서 서버 데이터로 교체)
    this.resourceBar.setSummary(MOCK_BUNKER_SUMMARY);
    this.selectMenu('bunker');
  }

  private selectMenu(id: MenuId): void {
    this.activeMenu = id;
    this.bottomMenu.highlight(id);

    const isBunker = id === 'bunker';
    this.bunkerView.setVisible(isBunker);
    this.comingSoon.setVisible(!isBunker);

    if (!isBunker) {
      const item = MENU_ITEMS.find((m) => m.id === id);
      const stage = item?.plannedStage ? `${item.plannedStage}단계에서 구현 예정` : '준비 중';
      this.comingSoonText.setText(`${item?.label ?? ''}\n\n${stage}`);
    }
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private createComingSoonPanel(): Phaser.GameObjects.Container {
    const cx = GAME_WIDTH / 2;
    const cy = LAYOUT.contentTop + LAYOUT.contentHeight / 2;
    this.comingSoonText = createText(this, cx, cy, '', {
      size: 22,
      bold: true,
      color: TEXT_COLORS.sub,
      originX: 0.5,
      originY: 0.5,
    }).setAlign('center');
    return this.add.container(0, 0, [this.comingSoonText]).setVisible(false);
  }

  /** 현재 선택된 메뉴 (이후 단계에서 다른 시스템이 참조) */
  getActiveMenu(): MenuId {
    return this.activeMenu;
  }
}
