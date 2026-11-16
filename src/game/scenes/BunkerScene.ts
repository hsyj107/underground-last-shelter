import Phaser from 'phaser';
import type { MenuId } from '../../types';
import { MENU_ITEMS } from '../../data/menus';
import { MOCK_BUNKER_SUMMARY } from '../../data/mockState';
import { PLAYER } from '../../data/player';
import { PLAYER_GREETINGS } from '../../data/dialogues';
import { INTRO, STORY, type StoryLine } from '../../data/story';
import { BottomMenu } from '../../ui/components/BottomMenu';
import { DialogueBox, type DialogueEntry } from '../../ui/components/DialogueBox';
import { FacilityPanel } from '../../ui/components/FacilityPanel';
import { ResourceBar } from '../../ui/components/ResourceBar';
import { SpeechBubble } from '../../ui/components/SpeechBubble';
import { COLORS, TEXT_COLORS, createText } from '../../ui/styles/theme';
import { computeRoomRects, FEET_Y, FLOOR_H, WORLD_H } from '../config/bunkerLayout';
import { GAME_HEIGHT, GAME_WIDTH, LAYOUT, PX } from '../config/layout';
import { FacilityRoom } from '../entities/FacilityRoom';
import { Player } from '../entities/Player';
import type { Survivor } from '../entities/Survivor';
import { loadSecuredFloors, saveSecuredFloors } from '../state/progress';
import { SurvivorSystem } from '../systems/SurvivorSystem';

/** 이 거리(px) 이상 움직이면 "누르기"가 아니라 "끌기"로 본다. */
const DRAG_THRESHOLD = 10;
/** 대화할 때 상대와 떨어져 서는 거리(px) */
const TALK_GAP = 42;

const pick = (list: string[]): string => list[Math.floor(Math.random() * list.length)];

/**
 * 메인 화면: 상단 자원바 + 중앙 벙커 단면(한 층에 시설 하나) + 하단 메뉴.
 * 방을 누르면 내 메인 캐릭터가 사다리로 그 층까지 직접 가고, 배치된 생존자가 있으면 말을 주고받는다.
 * 처음에는 주인공 혼자이고, 위층부터 한 층씩 그 층의 생존자를 만나 동료로 맞이하면 층이 확보된다.
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
  private banner!: Phaser.GameObjects.Text;
  /** 확보한 층 수 (위에서부터). 다음에 확보할 층은 secured + 1 층이다. */
  private secured = 0;
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
    this.dialogue = new DialogueBox(this);
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

    // 임시 데이터로 화면 확인 (6단계에서 서버 데이터로 교체)
    this.refreshSummary();
    this.selectMenu('bunker');

    // 처음 시작하면 도입부를 보여 준다.
    if (this.secured === 0) this.dialogue.play(this.toEntries(INTRO, ''), () => undefined);
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
    // 생존자는 따로 묶어 두어, 나중에 합류해도 메인 캐릭터·말풍선보다 뒤에 그려지게 한다.
    const survivorLayer = this.add.container(0, 0);
    layer.add(survivorLayer);
    this.survivors = new SurvivorSystem(this, this.rooms, survivorLayer);

    // 저장된 진행 상황대로 층과 생존자를 놓는다. (임시: 이 기기의 브라우저에 저장)
    this.secured = loadSecuredFloors(STORY.length);
    for (const story of STORY) {
      if (story.floor <= this.secured) this.survivors.add(story.survivor);
    }
    this.spawnFrontier();
    this.refreshRoomStates();

    // 내 메인 캐릭터 (지하 1층에서 시작)
    this.player = new Player(this, this.rooms[0].rect, PLAYER.startX, PLAYER.sprite);
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
      if (this.activeMenu !== 'bunker' || this.dialogue.isOpen) return;
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

  /** 방을 고르면 메인 캐릭터가 그 방으로 이동하고, 도착하면 상세 패널(또는 첫 만남 대화)이 열린다. */
  private selectRoom(room: FacilityRoom | null, tapX = GAME_WIDTH / 2): void {
    // 아직 갈 수 없는 층: 위층부터 차례로 확보해야 한다.
    if (room && room.rect.facility.floor > this.secured + 1) {
      this.showBanner('위층부터 차례로 확보해야 합니다');
      return;
    }

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
    const isFrontier = next.rect.facility.floor === this.secured + 1;
    const worker = this.survivors.getSurvivorIn(next.rect.facility.type);
    this.player.travelTo({
      room: next.rect,
      // 생존자가 있으면 그 옆으로, 없으면 누른 자리로 간다.
      targetX: () => (worker ? worker.x + (this.player.x < worker.x ? -TALK_GAP : TALK_GAP) : tapX),
      onArrive: () => {
        if (token !== this.visitToken) return;
        if (isFrontier && worker) this.startEncounter(next, worker);
        else this.onPlayerArrive(next, worker);
      },
    });
  }

  /** 확보한 층에 도착: 패널을 열고, 그 층을 맡은 생존자와 한마디씩 주고받는다. */
  private onPlayerArrive(room: FacilityRoom, worker: Survivor | undefined): void {
    this.showPanel(room);
    if (!worker) return;

    const token = this.visitToken;
    const player = this.player;
    const story = STORY.find((s) => s.floor === room.rect.facility.floor);
    worker.talkTo(player.x, 5200);
    player.face(worker.x);
    this.talkingWith = worker;
    this.playerBubble.say(player.x, player.y - player.height, pick(PLAYER_GREETINGS), 1600);
    this.time.delayedCall(1700, () => {
      if (token !== this.visitToken || !story) return;
      this.npcBubble.say(worker.x, worker.y - worker.height, pick(story.lines), 3200);
    });
  }

  /** 아직 확보하지 않은 층에 도착: 그 층에 있던 생존자와 처음 만난다. */
  private startEncounter(room: FacilityRoom, worker: Survivor): void {
    const story = STORY.find((s) => s.floor === room.rect.facility.floor);
    if (!story) return;
    worker.talkTo(this.player.x, Number.POSITIVE_INFINITY);
    this.player.face(worker.x);
    this.dialogue.play(
      this.toEntries(story.encounter, story.survivor.name),
      () => this.secureFloor(room, worker, story.secured),
      this.isRoomLow(room),
    );
  }

  /** 생존자가 합류해 그 층을 맡는다 → 층 확보. 다음 층이 열린다. */
  private secureFloor(room: FacilityRoom, worker: Survivor, notice: string): void {
    this.secured = room.rect.facility.floor;
    saveSecuredFloors(this.secured);
    worker.endTalk();
    this.spawnFrontier();
    this.refreshRoomStates();
    this.refreshSummary();

    const { facility } = room.rect;
    this.showBanner(`B${facility.floor} ${facility.name} 확보!`);
    this.dialogue.play(
      [{ speaker: '', text: notice }],
      () => {
        if (this.selectedRoom === room) this.showPanel(room);
      },
      this.isRoomLow(room),
    );
  }

  /** 다음에 확보할 층에, 그 층의 생존자를 세워 둔다. (아직 동료가 아니라 제자리에서 기다린다) */
  private spawnFrontier(): void {
    const story = STORY.find((s) => s.floor === this.secured + 1);
    if (!story) return;
    this.survivors.add(story.survivor)?.wait();
  }

  private refreshRoomStates(): void {
    for (const room of this.rooms) {
      const floor = room.rect.facility.floor;
      room.setState(floor <= this.secured ? 'active' : floor === this.secured + 1 ? 'frontier' : 'locked');
    }
  }

  /** 상단 요약. 생존자 수 = 나 + 합류한 동료. (자원 수치는 아직 임시 데이터) */
  private refreshSummary(): void {
    this.resourceBar.setSummary({ ...MOCK_BUNKER_SUMMARY, survivors: 1 + this.secured });
  }

  private showPanel(room: FacilityRoom): void {
    const { facility } = room.rect;
    const placeTop = this.isRoomLow(room);
    const workers = this.survivors.getWorkers(facility.type);
    this.panel.show(facility, facility.floor <= this.secured ? workers : [], placeTop);
  }

  /** 화면이 다 따라간 뒤 이 방이 화면 아래쪽에 놓이는지. 그러면 패널·대화창을 위에 띄워 방이 가려지지 않게 한다. */
  private isRoomLow(room: FacilityRoom): boolean {
    const roomCenterY = room.rect.y + room.rect.h / 2;
    const screenCenterY = roomCenterY + this.clampScroll(this.scrollToCenter(roomCenterY));
    return screenCenterY > LAYOUT.contentTop + LAYOUT.contentHeight / 2 + 1;
  }

  private toEntries(lines: StoryLine[], npcName: string): DialogueEntry[] {
    return lines.map((line) => ({
      speaker: line.who === 'player' ? '나' : line.who === 'npc' ? npcName : '',
      text: line.text,
    }));
  }

  /** 화면 위쪽에 잠깐 뜨는 알림 */
  private showBanner(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setVisible(true);
    this.tweens.add({
      targets: this.banner,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => this.banner.setVisible(false),
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
