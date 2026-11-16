import Phaser from 'phaser';
import type { MinigameDef } from '../../data/minigames';
import { TEXT_COLORS, createText } from '../../ui/styles/theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { AREA_W, MECHANICS, type MinigameContext } from './mechanics';

type Phase = 'closed' | 'intro' | 'playing' | 'won' | 'lost';

const PANEL_X = 20;
const PANEL_Y = 150;
const PANEL_W = GAME_WIDTH - 40;
const PANEL_H = 650;

/**
 * 미니게임 화면. 화면 전체를 덮고, 안내 → 진행 → 결과(성공/실패) 순서로 보여 준다.
 * 실패하면 다시 도전하거나 × 로 나갈 수 있다. 실제 놀이 방식은 mechanics.ts 에 있다.
 */
export class MinigameOverlay extends Phaser.GameObjects.Container {
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly helpText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly buttonLabel: Phaser.GameObjects.Text;
  private readonly button: Phaser.GameObjects.Container;
  private readonly area: Phaser.GameObjects.Container;
  private phase: Phase = 'closed';
  private def: MinigameDef | null = null;
  private onResult: ((success: boolean) => void) | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];
  private updaters: ((delta: number) => void)[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    // 뒤 화면이 눌리지 않게 전체를 막는다.
    const blocker = scene.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT).setInteractive();
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.78).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fillStyle(0x151a21, 1).fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    bg.lineStyle(2, 0x3a4048, 1).strokeRect(PANEL_X + 1, PANEL_Y + 1, PANEL_W - 2, PANEL_H - 2);
    bg.fillStyle(0xf2a93b, 1).fillRect(PANEL_X + 3, PANEL_Y + 3, PANEL_W - 6, 3);

    const cx = GAME_WIDTH / 2;
    this.titleText = createText(scene, cx, PANEL_Y + 36, '', {
      size: 22, bold: true, color: TEXT_COLORS.accent, originX: 0.5, originY: 0.5,
    });
    this.helpText = createText(scene, cx, PANEL_Y + 62, '', { size: 14, color: '#c9d1d9', originX: 0.5 });
    this.helpText.setAlign('center').setLineSpacing(4);
    this.statusText = createText(scene, cx, PANEL_Y + 134, '', { size: 16, bold: true, originX: 0.5, originY: 0.5 });
    this.area = scene.add.container((GAME_WIDTH - AREA_W) / 2, PANEL_Y + 160);

    // 나가기
    const exit = createText(scene, PANEL_X + PANEL_W - 30, PANEL_Y + 8, '×', {
      size: 30, bold: true, color: TEXT_COLORS.sub,
    });
    const exitHit = scene.add.zone(PANEL_X + PANEL_W - 24, PANEL_Y + 26, 52, 48).setInteractive({ useHandCursor: true });
    exitHit.on(Phaser.Input.Events.POINTER_DOWN, () => this.close(false));

    // 시작 / 다시 도전 / 계속 버튼
    const bw = 280;
    const bh = 52;
    const by = PANEL_Y + PANEL_H - 56;
    const bbg = scene.add.graphics();
    bbg.fillStyle(0xf2a93b, 1).fillRect(-bw / 2, -bh / 2, bw, bh);
    bbg.fillStyle(0xffd27a, 1).fillRect(-bw / 2, -bh / 2, bw, 3);
    this.buttonLabel = createText(scene, 0, 0, '', { size: 19, bold: true, color: '#1a1206', originX: 0.5, originY: 0.5 });
    const hit = scene.add.zone(0, 0, bw, bh).setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.POINTER_DOWN, () => this.pressButton());
    this.button = scene.add.container(cx, by, [bbg, this.buttonLabel, hit]);

    this.add([blocker, bg, this.titleText, this.helpText, this.statusText, this.area, exit, exitHit, this.button]);
    this.setDepth(70).setVisible(false);
    scene.add.existing(this);

    const onUpdate = (_time: number, delta: number): void => {
      if (this.phase !== 'playing') return;
      for (const fn of [...this.updaters]) {
        if (this.phase === 'playing') fn(delta);
      }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
  }

  get isOpen(): boolean {
    return this.phase !== 'closed';
  }

  /** 미니게임을 연다. 성공해서 닫히면 onResult(true), 나가면 onResult(false). */
  play(def: MinigameDef, onResult: (success: boolean) => void): void {
    this.def = def;
    this.onResult = onResult;
    this.titleText.setText(def.title);
    this.helpText.setText(def.help);
    this.statusText.setText('준비되면 시작을 누르세요').setColor(TEXT_COLORS.sub);
    this.clearRound();
    this.phase = 'intro';
    this.buttonLabel.setText('시작');
    this.button.setVisible(true);
    this.setVisible(true);
  }

  private pressButton(): void {
    if (this.phase === 'intro' || this.phase === 'lost') this.startRound();
    else if (this.phase === 'won') this.close(true);
  }

  private startRound(): void {
    const def = this.def;
    if (!def) return;
    this.clearRound();
    this.phase = 'playing';
    this.button.setVisible(false);
    this.statusText.setText('').setColor(TEXT_COLORS.main);

    const scene = this.scene;
    const ctx: MinigameContext = {
      scene,
      area: this.area,
      params: def.params,
      labels: def.labels,
      setStatus: (text) => {
        if (this.phase === 'playing') this.statusText.setText(text);
      },
      win: () => this.finish(true),
      lose: () => this.finish(false),
      done: () => this.phase !== 'playing',
      later: (ms, fn) => {
        const timer = scene.time.delayedCall(ms, () => {
          if (this.phase === 'playing') fn();
        });
        this.timers.push(timer);
      },
      onUpdate: (fn) => {
        this.updaters.push(fn);
      },
    };
    MECHANICS[def.kind](ctx);
  }

  private finish(success: boolean): void {
    if (this.phase !== 'playing') return;
    this.stopRound();
    this.phase = success ? 'won' : 'lost';
    this.statusText
      .setText(success ? '성공!' : '실패… 다시 해 봅시다')
      .setColor(success ? TEXT_COLORS.good : TEXT_COLORS.warn);
    this.buttonLabel.setText(success ? '계속' : '다시 도전');
    this.button.setVisible(true);
  }

  private close(success: boolean): void {
    if (this.phase === 'closed') return;
    this.clearRound();
    this.phase = 'closed';
    this.setVisible(false);
    const done = this.onResult;
    this.onResult = null;
    done?.(success);
  }

  /** 진행 중이던 타이머·매 프레임 처리를 멈춘다. (그림은 남겨 둔다) */
  private stopRound(): void {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
    this.updaters = [];
  }

  private clearRound(): void {
    this.stopRound();
    this.area.removeAll(true);
  }
}
