import Phaser from 'phaser';
import type { MenuId } from '../../types';
import { MENU_ITEMS } from '../../data/menus';
import { MOCK_BUNKER_SUMMARY } from '../../data/mockState';
import { MOCK_SURVIVORS } from '../../data/mockSurvivors';
import { BottomMenu } from '../../ui/components/BottomMenu';
import { FacilityPanel } from '../../ui/components/FacilityPanel';
import { ResourceBar } from '../../ui/components/ResourceBar';
import { COLORS, TEXT_COLORS, createText } from '../../ui/styles/theme';
import { computeRoomRects, WORLD_H } from '../config/bunkerLayout';
import { GAME_HEIGHT, GAME_WIDTH, LAYOUT, PX } from '../config/layout';
import { FacilityRoom } from '../entities/FacilityRoom';
import { SurvivorSystem } from '../systems/SurvivorSystem';

/** 이 거리(px) 이상 움직이면 "누르기"가 아니라 "끌기"로 본다. */
const DRAG_THRESHOLD = 10;

/** 메인 화면: 상단 자원바 + 중앙 벙커 단면(한 층에 시설 하나, 위아래로 끌어서 이동) + 하단 메뉴 */
export class BunkerScene extends Phaser.Scene {
  private resourceBar!: ResourceBar;
  private bottomMenu!: BottomMenu;
  private panel!: FacilityPanel;
  private backdrop!: Phaser.GameObjects.Container;
  private bunkerLayer!: Phaser.GameObjects.Container;
  private rooms: FacilityRoom[] = [];
  private survivors!: SurvivorSystem;
  private selectedRoom: FacilityRoom | null = null;
  private comingSoon!: Phaser.GameObjects.Container;
  private comingSoonText!: Phaser.GameObjects.Text;
  private scrollHint!: Phaser.GameObjects.Text;
  private activeMenu: MenuId = 'bunker';

  // 끌기 상태
  private pressActive = false;
  private dragging = false;
  private pressY = 0;
  private pressLayerY = 0;

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
    this.setupInput();

    // 임시 데이터로 화면 확인 (6단계에서 서버 데이터로 교체)
    this.resourceBar.setSummary(MOCK_BUNKER_SUMMARY);
    this.selectMenu('bunker');
  }

  /** 고정 배경(암반) 위에, 위아래로 움직이는 벙커 레이어(지상 + 층들)를 올린다. */
  private createBunker(): void {
    this.backdrop = this.add.container(0, 0, [
      this.add.image(0, LAYOUT.contentTop, 'env-rock').setOrigin(0, 0).setScale(PX),
    ]);

    this.bunkerLayer = this.add.container(0, 0);
    const layer = this.bunkerLayer;
    layer.add(this.add.image(0, LAYOUT.contentTop, 'env-surface').setOrigin(0, 0).setScale(PX));
    this.rooms = computeRoomRects().map((rect) => new FacilityRoom(this, rect, layer));
    this.survivors = new SurvivorSystem(this, this.rooms, layer, MOCK_SURVIVORS);
    for (const room of this.rooms) room.addOverlay(layer);

    this.scrollHint = createText(this, GAME_WIDTH / 2, LAYOUT.contentBottom - 18, '▲  위아래로 끌어서 이동  ▼', {
      size: 12,
      bold: true,
      color: '#e8edf2',
      originX: 0.5,
      originY: 0.5,
    });
    this.tweens.add({ targets: this.scrollHint, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });
  }

  /** 누르기(시설 선택)와 끌기(층 이동)를 구분해서 처리한다. */
  private setupInput(): void {
    const inBunkerArea = (p: Phaser.Input.Pointer): boolean =>
      this.activeMenu === 'bunker' &&
      p.y > LAYOUT.contentTop &&
      p.y < LAYOUT.contentBottom &&
      !this.panel.containsPoint(p.x, p.y);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // 버튼·패널 같은 UI 를 누른 경우는 벙커 조작으로 보지 않는다.
      if (over.length > 0 || !inBunkerArea(p)) return;
      this.pressActive = true;
      this.dragging = false;
      this.pressY = p.y;
      this.pressLayerY = this.bunkerLayer.y;
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!this.pressActive || !p.isDown) return;
      const dy = p.y - this.pressY;
      if (!this.dragging && Math.abs(dy) < DRAG_THRESHOLD) return;
      this.dragging = true;
      this.scrollTo(this.pressLayerY + dy);
    });

    // PC: 마우스 휠로도 층을 이동한다.
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (this.activeMenu !== 'bunker' || p.y < LAYOUT.contentTop || p.y > LAYOUT.contentBottom) return;
      this.scrollTo(this.bunkerLayer.y - dy * 0.6);
    });

    const release = (p: Phaser.Input.Pointer): void => {
      if (!this.pressActive) return;
      this.pressActive = false;
      if (this.dragging) {
        this.dragging = false;
        return;
      }
      // 끌지 않고 뗐으면 누른 것으로 본다.
      const worldY = p.y - this.bunkerLayer.y;
      this.selectRoom(this.rooms.find((room) => room.contains(p.x, worldY)) ?? null);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
  }

  /** 벙커를 위아래로 옮긴다 (맨 위·맨 아래를 넘지 않게). */
  private scrollTo(y: number): void {
    this.bunkerLayer.y = Phaser.Math.Clamp(y, LAYOUT.contentHeight - WORLD_H - 12, 0);
    this.scrollHint.setVisible(false);
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
    // 화면 아래쪽에 있는 방을 고르면 패널을 위에 띄워 방이 가려지지 않게 한다.
    const screenCenterY = next.rect.y + next.rect.h / 2 + this.bunkerLayer.y;
    const placeTop = screenCenterY > LAYOUT.contentTop + LAYOUT.contentHeight / 2;
    this.panel.show(facility, this.survivors.getWorkers(facility.type), placeTop);
  }

  private selectMenu(id: MenuId): void {
    this.activeMenu = id;
    this.bottomMenu.highlight(id);

    const isBunker = id === 'bunker';
    this.backdrop.setVisible(isBunker);
    this.bunkerLayer.setVisible(isBunker);
    this.scrollHint.setVisible(isBunker && this.bunkerLayer.y === 0);
    this.comingSoon.setVisible(!isBunker);

    if (!isBunker) {
      this.pressActive = false;
      this.selectRoom(null);
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
