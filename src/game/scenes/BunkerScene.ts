import Phaser from 'phaser';
import type { FacilityType, MenuId } from '../../types';
import { PLAYER_GREETINGS } from '../../data/dialogues';
import { MENU_ITEMS } from '../../data/menus';
import { MINIGAMES } from '../../data/minigames';
import { PLAYER_START_X, playerSprite } from '../../data/player';
import { MAX_FACILITY_LEVEL, upgradeCost } from '../../data/progression';
import { introLines } from '../../data/story';
import { NORMAL_LINES } from '../../data/survivorPool';
import { BottomMenu } from '../../ui/components/BottomMenu';
import { DialogueBox } from '../../ui/components/DialogueBox';
import { FacilityPanel } from '../../ui/components/FacilityPanel';
import { ResourceBar } from '../../ui/components/ResourceBar';
import { SpeechBubble } from '../../ui/components/SpeechBubble';
import { openCharacterCreator, openExpeditionScreen, openSurvivorList, openSurvivorPicker } from '../../ui/dom/screens';
import { COLORS, TEXT_COLORS, createText } from '../../ui/styles/theme';
import { computeRoomRects, FEET_Y, FLOOR_H, WORLD_H } from '../config/bunkerLayout';
import { GAME_HEIGHT, GAME_WIDTH, LAYOUT, PX } from '../config/layout';
import { FacilityRoom } from '../entities/FacilityRoom';
import { Player } from '../entities/Player';
import type { Survivor } from '../entities/Survivor';
import { MinigameOverlay } from '../minigames/MinigameOverlay';
import {
  canUnlock, capacity, createProfile, facilityStatus, game, unlockConditions, unlockFacility, upgradeFacility,
  workersIn,
} from '../state/gameState';
import { SurvivorSystem } from '../systems/SurvivorSystem';

/** 이 거리(px) 이상 움직이면 "누르기"가 아니라 "끌기"로 본다. */
const DRAG_THRESHOLD = 10;
/** 대화할 때 상대와 떨어져 서는 거리(px) */
const TALK_GAP = 42;

const pick = (list: string[]): string => list[Math.floor(Math.random() * list.length)];

/**
 * 메인 화면: 상단 자원바 + 중앙 벙커 단면(한 층에 시설 하나) + 하단 메뉴.
 *
 * - 처음에는 주인공(대장) 혼자다. 캐릭터를 만들고 도입부를 본 뒤 시작한다.
 * - 방을 누르면 대장이 사다리로 그 층까지 직접 가고, 도착하면 상세 패널이 열린다.
 * - 시설은 조건(대장 레벨·이전 시설 레벨·철)을 채우고 복구 작업(미니게임)을 성공하면 개방된다.
 * - 생존자는 [탐험]으로 구해 오고, 시설에 배치해야 그 시설이 가동된다.
 */
export class BunkerScene extends Phaser.Scene {
  private resourceBar!: ResourceBar;
  private bottomMenu!: BottomMenu;
  private panel!: FacilityPanel;
  private backdrop!: Phaser.GameObjects.Container;
  private bunkerLayer!: Phaser.GameObjects.Container;
  private rooms: FacilityRoom[] = [];
  private survivors!: SurvivorSystem;
  private player!: Player;
  private playerBubble!: SpeechBubble;
  private npcBubble!: SpeechBubble;
  /** 화면이 메인 캐릭터를 따라가는 중인지 (손으로 끌면 풀린다) */
  private following = false;
  /** 방문이 바뀌면 올라가는 번호. 이전 방문의 예약된 동작을 무시하는 데 쓴다. */
  private visitToken = 0;
  private talkingWith: Survivor | null = null;
  private dialogue!: DialogueBox;
  private minigame!: MinigameOverlay;
  private banner!: Phaser.GameObjects.Text;
  /** 탐험대가 돌아왔다는 알림을 이미 띄웠는지 */
  private returnNotified = false;
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

    this.panel = new FacilityPanel(this, {
      onClose: () => this.selectRoom(null),
      onPrimary: () => this.pressPrimary(),
      onAssign: () => this.pressAssign(),
    });
    this.resourceBar = new ResourceBar(this);
    this.bottomMenu = new BottomMenu(this, MENU_ITEMS, (id) => this.selectMenu(id));
    this.dialogue = new DialogueBox(this);
    this.minigame = new MinigameOverlay(this);
    this.banner = createText(this, GAME_WIDTH / 2, LAYOUT.contentTop + 34, '', {
      size: 17,
      bold: true,
      color: TEXT_COLORS.accent,
      originX: 0.5,
      originY: 0.5,
    })
      .setDepth(55)
      .setVisible(false);
    this.banner.setStroke('#0b0e12', 5);
    this.setupInput();

    this.refresh();
    this.selectMenu('bunker');

    // 처음 시작: 캐릭터를 만들고 도입부를 본다.
    if (!game.profile) {
      openCharacterCreator((profile) => {
        createProfile(profile);
        this.player.setLook(playerSprite(profile));
        this.refresh();
        this.dialogue.play(introLines(profile.nickname), () => undefined);
      });
    }
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

    // 생존자는 따로 묶어 두어, 나중에 배치해도 메인 캐릭터·말풍선보다 뒤에 그려지게 한다.
    const survivorLayer = this.add.container(0, 0);
    layer.add(survivorLayer);
    this.survivors = new SurvivorSystem(this, this.rooms, survivorLayer);
    this.survivors.sync(game.survivors);

    // 내 메인 캐릭터 (지하 1층에서 시작)
    this.player = new Player(this, this.rooms[0].rect, PLAYER_START_X, playerSprite(game.profile));
    layer.add([this.player.shadow, this.player, this.player.marker]);

    for (const room of this.rooms) room.addOverlay(layer);
    this.playerBubble = new SpeechBubble(this);
    this.npcBubble = new SpeechBubble(this);
    layer.add([this.playerBubble, this.npcBubble]);

    this.scrollHint = createText(this, GAME_WIDTH / 2, LAYOUT.contentBottom - 18, '방을 누르면 그 층으로 이동  ·  끌어서 둘러보기', {
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
      this.following = false;
      this.scrollTo(this.pressLayerY + dy);
    });

    // PC: 마우스 휠로도 층을 이동한다.
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (this.activeMenu !== 'bunker' || this.dialogue.isOpen || this.minigame.isOpen) return;
      if (p.y < LAYOUT.contentTop || p.y > LAYOUT.contentBottom) return;
      this.following = false;
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
      this.selectRoom(this.rooms.find((room) => room.contains(p.x, worldY)) ?? null, p.x);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
  }

  /** 매 프레임: 메인 캐릭터를 움직이고, 화면이 캐릭터를 따라가게 한다. */
  update(_time: number, delta: number): void {
    this.player.tick(delta);
    this.checkExpeditionReturn();
    if (!this.following || this.pressActive) return;

    const floorCenterY = this.player.feetY - FEET_Y + FLOOR_H / 2;
    const desired = this.clampScroll(this.scrollToCenter(floorCenterY));
    const diff = desired - this.bunkerLayer.y;
    if (Math.abs(diff) < 0.5) {
      this.bunkerLayer.y = desired;
      if (!this.player.isTraveling) this.following = false;
    } else {
      this.bunkerLayer.y += diff * Math.min(1, delta * 0.008);
    }
  }

  /** 탐험이 끝났으면 한 번 알려 준다. */
  private checkExpeditionReturn(): void {
    if (!game.expedition) {
      this.returnNotified = false;
      return;
    }
    if (this.returnNotified || Date.now() < game.expedition.endsAt) return;
    this.returnNotified = true;
    this.showBanner('탐험대가 돌아왔습니다 · [탐험]에서 확인하세요');
  }

  /** 벙커 전체 좌표의 y 가 화면 가운데에 오게 하는 레이어 위치 */
  private scrollToCenter(worldY: number): number {
    return LAYOUT.contentTop + LAYOUT.contentHeight / 2 - worldY;
  }

  private clampScroll(y: number): number {
    return Phaser.Math.Clamp(y, LAYOUT.contentHeight - WORLD_H - 12, 0);
  }

  /** 벙커를 위아래로 옮긴다 (맨 위·맨 아래를 넘지 않게). */
  private scrollTo(y: number): void {
    this.bunkerLayer.y = this.clampScroll(y);
    this.scrollHint.setVisible(false);
  }

  /** 방을 고르면 메인 캐릭터가 그 방으로 이동하고, 도착하면 상세 패널이 열린다. */
  private selectRoom(room: FacilityRoom | null, tapX = GAME_WIDTH / 2): void {
    // 같은 방을 다시 누르면 닫는다.
    const next = room === this.selectedRoom ? null : room;
    this.selectedRoom?.setSelected(false);
    this.selectedRoom = next;
    this.endVisit();
    this.panel.hide();
    if (!next) return;

    next.setSelected(true);
    this.scrollHint.setVisible(false);
    this.following = true;

    const token = this.visitToken;
    const type = next.rect.facility.type;
    this.player.travelTo({
      room: next.rect,
      // 그 방에 생존자가 있으면 그 옆으로, 없으면 누른 자리로 간다.
      targetX: () => {
        const worker = this.survivors.getSurvivorIn(type);
        return worker ? worker.x + (this.player.x < worker.x ? -TALK_GAP : TALK_GAP) : tapX;
      },
      onArrive: () => {
        if (token === this.visitToken) this.onPlayerArrive(next);
      },
    });
  }

  /** 방에 도착: 패널을 열고, 그 방을 맡은 생존자가 있으면 한마디씩 주고받는다. */
  private onPlayerArrive(room: FacilityRoom): void {
    this.showPanel(room);
    const token = this.visitToken;
    const player = this.player;
    const type = room.rect.facility.type;
    const worker = this.survivors.getSurvivorIn(type);

    if (!worker) {
      const line = facilityStatus(type) === 'locked' ? '아직 쓸 수 없는 곳이군.' : '여긴 맡을 사람이 필요하겠어.';
      this.playerBubble.say(player.x, player.y - player.height, line, 2400);
      return;
    }
    worker.talkTo(player.x, 5200);
    player.face(worker.x);
    this.talkingWith = worker;
    this.playerBubble.say(player.x, player.y - player.height, pick(PLAYER_GREETINGS), 1600);
    this.time.delayedCall(1700, () => {
      if (token !== this.visitToken || this.talkingWith !== worker) return;
      this.npcBubble.say(worker.x, worker.y - worker.height, pick(worker.profile.lines ?? NORMAL_LINES), 3200);
    });
  }

  /** 진행 중이던 방문(대화·도착 예약)을 정리한다. */
  private endVisit(): void {
    this.visitToken++;
    this.playerBubble.hide();
    this.npcBubble.hide();
    this.talkingWith?.endTalk();
    this.talkingWith = null;
    this.player.cancelArrival();
  }

  // ───────── 패널 버튼 ─────────

  /** 왼쪽 버튼: 잠긴 시설이면 개방(조건 확인 → 복구 작업 미니게임), 아니면 업그레이드 */
  private pressPrimary(): void {
    const room = this.selectedRoom;
    if (!room) return;
    const { type, name } = room.rect.facility;

    if (facilityStatus(type) === 'locked') {
      if (!canUnlock(type)) {
        this.panel.notice('primary', '조건이 부족합니다');
        return;
      }
      this.minigame.play(MINIGAMES[type], (success) => {
        if (!success || !unlockFacility(type)) return;
        this.showBanner(`${name} 개방!`);
        this.refresh();
        if (game.survivors.length === 0) {
          this.dialogue.play(
            [{ speaker: '', text: `${name}을(를) 개방했습니다. 시설은 맡을 사람이 있어야 가동됩니다. 아래 [탐험]에서 생존자를 찾아 데려온 뒤, 시설의 [생존자 배치]로 맡기세요.` }],
            () => undefined,
            this.isRoomLow(room),
          );
        }
      });
      return;
    }

    if (upgradeFacility(type)) {
      this.showBanner(`${name} Lv.${game.facilityLevels[type]}`);
      this.refresh();
    } else {
      const maxed = game.facilityLevels[type] >= MAX_FACILITY_LEVEL;
      this.panel.notice('primary', maxed ? '최고 레벨입니다' : '철이 부족합니다');
    }
  }

  /** 오른쪽 버튼: 이 시설을 맡을 생존자를 고른다. */
  private pressAssign(): void {
    const room = this.selectedRoom;
    if (!room) return;
    const { type } = room.rect.facility;
    if (facilityStatus(type) === 'locked') {
      this.panel.notice('assign', '먼저 개방하세요');
      return;
    }
    openSurvivorPicker(type, () => {
      this.syncSurvivors();
      this.refresh();
    });
  }

  // ───────── 화면 갱신 ─────────

  /** 배치가 바뀌었을 때: 생존자 캐릭터를 다시 세운다. */
  private syncSurvivors(): void {
    this.npcBubble.hide();
    this.talkingWith = null;
    this.survivors.sync(game.survivors);
  }

  /** 게임 상태가 바뀌었을 때: 방 상태(잠김/운영 중지/가동), 상단 요약, 열려 있는 패널을 다시 그린다. */
  private refresh(): void {
    for (const room of this.rooms) room.setState(facilityStatus(room.rect.facility.type));
    this.resourceBar.setSummary({
      title: `${game.profile?.nickname ?? '대장'} Lv.${game.level}`,
      level: game.level,
      survivors: game.survivors.length,
      survivorCapacity: capacity(),
      // ⚠ 안정도는 아직 계산하지 않는 임시 숫자다.
      stability: 80,
      resources: game.resources,
    });
    if (this.selectedRoom && this.panel.isOpen) this.showPanel(this.selectedRoom, false);
  }

  private showPanel(room: FacilityRoom, animate = true): void {
    const { facility } = room.rect;
    const level = game.facilityLevels[facility.type];
    const status = facilityStatus(facility.type);
    this.panel.show(
      {
        facility,
        level,
        status,
        conditions: unlockConditions(facility.type),
        workers: workersIn(facility.type),
        primaryText: this.primaryText(facility.type),
      },
      this.isRoomLow(room),
      animate,
    );
  }

  private primaryText(type: FacilityType): string {
    const level = game.facilityLevels[type];
    if (level <= 0) return '개방';
    return level >= MAX_FACILITY_LEVEL ? '최고 레벨' : `업그레이드 (철 ${upgradeCost(level)})`;
  }

  /** 화면이 다 따라간 뒤 이 방이 화면 아래쪽에 놓이는지. 그러면 패널·대화창을 위에 띄워 방이 가려지지 않게 한다. */
  private isRoomLow(room: FacilityRoom): boolean {
    const roomCenterY = room.rect.y + room.rect.h / 2;
    const screenCenterY = roomCenterY + this.clampScroll(this.scrollToCenter(roomCenterY));
    return screenCenterY > LAYOUT.contentTop + LAYOUT.contentHeight / 2 + 1;
  }

  /** 화면 위쪽에 잠깐 뜨는 알림 */
  private showBanner(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setVisible(true);
    this.tweens.add({
      targets: this.banner,
      alpha: 0,
      delay: 1800,
      duration: 500,
      onComplete: () => this.banner.setVisible(false),
    });
  }

  // ───────── 하단 메뉴 ─────────

  private selectMenu(id: MenuId): void {
    // 탐험·생존자는 벙커 화면 위에 창으로 뜬다.
    if (id === 'expedition') {
      openExpeditionScreen(() => this.refresh());
      return;
    }
    if (id === 'survivors') {
      openSurvivorList(() => undefined);
      return;
    }

    this.activeMenu = id;
    this.bottomMenu.highlight(id);

    const isBunker = id === 'bunker';
    this.backdrop.setVisible(isBunker);
    this.bunkerLayer.setVisible(isBunker);
    this.scrollHint.setVisible(isBunker && this.bunkerLayer.y === 0 && !this.selectedRoom);
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
