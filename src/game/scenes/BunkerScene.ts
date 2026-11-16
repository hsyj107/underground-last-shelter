import Phaser from 'phaser';
import type { MenuId } from '../../types';
import { MENU_ITEMS } from '../../data/menus';
import { MOCK_BUNKER_SUMMARY } from '../../data/mockState';
import { MOCK_SURVIVORS } from '../../data/mockSurvivors';
import { BottomMenu } from '../../ui/components/BottomMenu';
import { FacilityPanel } from '../../ui/components/FacilityPanel';
import { ResourceBar } from '../../ui/components/ResourceBar';
import { COLORS, TEXT_COLORS, createText } from '../../ui/styles/theme';
import { computeRoomRects } from '../config/bunkerLayout';
import { GAME_HEIGHT, GAME_WIDTH, LAYOUT, PX } from '../config/layout';
import { FacilityRoom } from '../entities/FacilityRoom';
import { SurvivorSystem } from '../systems/SurvivorSystem';

/** 메인 화면: 상단 자원바 + 중앙 픽셀 아트 벙커 단면 + 하단 메뉴 */
export class BunkerScene extends Phaser.Scene {
  private resourceBar!: ResourceBar;
  private bottomMenu!: BottomMenu;
  private panel!: FacilityPanel;
  private bunkerLayer!: Phaser.GameObjects.Container;
  private backgroundZone!: Phaser.GameObjects.Zone;
  private rooms: FacilityRoom[] = [];
  private survivors!: SurvivorSystem;
  private selectedRoom: FacilityRoom | null = null;
  private comingSoon!: Phaser.GameObjects.Container;
  private comingSoonText!: Phaser.GameObjects.Text;
  private activeMenu: MenuId = 'bunker';

  constructor() {
    super('BunkerScene');
  }

  create(): void {
    this.drawBackground();
    this.createBunker();
    this.comingSoon = this.createComingSoonPanel();

    this.panel = new FacilityPanel(this, () => this.selectRoom(null));
    this.resourceBar = new ResourceBar(this);
    this.bottomMenu = new BottomMenu(this, MENU_ITEMS, (id) => this.selectMenu(id));

    // 임시 데이터로 화면 확인 (6단계에서 서버 데이터로 교체)
    this.resourceBar.setSummary(MOCK_BUNKER_SUMMARY);
    this.selectMenu('bunker');
  }

  /** 암반 · 지상 · 시설 방 · 생존자를 한 레이어에 쌓는다 (추가한 순서대로 위에 그려진다). */
  private createBunker(): void {
    this.bunkerLayer = this.add.container(0, 0);
    const layer = this.bunkerLayer;

    layer.add(
      this.add.image(0, LAYOUT.contentTop, 'env-rock').setOrigin(0, 0).setScale(PX),
    );
    layer.add(
      this.add.image(0, LAYOUT.contentTop, 'env-surface').setOrigin(0, 0).setScale(PX),
    );

    // 빈 곳을 누르면 선택 해제
    this.backgroundZone = this.add
      .zone(GAME_WIDTH / 2, LAYOUT.contentTop + LAYOUT.contentHeight / 2, GAME_WIDTH, LAYOUT.contentHeight)
      .setInteractive();
    this.backgroundZone.on(Phaser.Input.Events.POINTER_DOWN, () => this.selectRoom(null));
    layer.add(this.backgroundZone);

    this.rooms = computeRoomRects().map((rect) => new FacilityRoom(this, rect, layer, (room) => this.selectRoom(room)));
    this.survivors = new SurvivorSystem(this, this.rooms, layer, MOCK_SURVIVORS);
    for (const room of this.rooms) room.addOverlay(layer);
  }

  private selectRoom(room: FacilityRoom | null): void {
    // 같은 방을 다시 누르면 닫는다.
    const next = room === this.selectedRoom ? null : room;
    this.selectedRoom?.setSelected(false);
    this.selectedRoom = next;

    if (!next) {
      this.panel.hide();
      return;
    }
    next.setSelected(true);
    const facility = next.rect.facility;
    this.panel.show(facility, this.survivors.getWorkers(facility.type), facility.floor >= 3);
  }

  private selectMenu(id: MenuId): void {
    this.activeMenu = id;
    this.bottomMenu.highlight(id);

    const isBunker = id === 'bunker';
    this.bunkerLayer.setVisible(isBunker);
    this.comingSoon.setVisible(!isBunker);
    for (const room of this.rooms) room.setInputEnabled(isBunker);
    if (this.backgroundZone.input) this.backgroundZone.input.enabled = isBunker;
    if (!isBunker) this.selectRoom(null);

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
