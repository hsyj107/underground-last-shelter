import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, LAYOUT } from '../../game/config/layout';
import { TEXT_COLORS, createText } from '../styles/theme';

export interface DialogueEntry {
  /** 말하는 사람 이름. 비우면 해설로 표시한다. */
  speaker: string;
  text: string;
}

const BOX_W = GAME_WIDTH - 32;
const BOX_H = 132;

/** 이야기 대화창. 화면 아무 곳이나 누르면 다음 줄로 넘어가고, 열려 있는 동안 다른 조작은 막는다. */
export class DialogueBox extends Phaser.GameObjects.Container {
  private readonly speaker: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly box: Phaser.GameObjects.Container;
  private queue: DialogueEntry[] = [];
  private index = 0;
  private onDone: (() => void) | null = null;
  private open = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    // 대화창 안쪽 좌표 기준 (대화창 자체는 box 컨테이너로 위/아래에 옮겨 놓는다)
    const x = 0;
    const y = 0;

    // 화면 전체를 덮는 터치 영역: 누르면 다음 줄
    const catcher = scene.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT).setInteractive();
    catcher.on(Phaser.Input.Events.POINTER_DOWN, () => this.next());

    const bg = scene.add.graphics();
    bg.fillStyle(0x0b0e12, 0.97).fillRect(x, y, BOX_W, BOX_H);
    bg.lineStyle(2, 0x3a4048, 1).strokeRect(x + 1, y + 1, BOX_W - 2, BOX_H - 2);
    bg.fillStyle(0xf2a93b, 1).fillRect(x + 3, y + 3, BOX_W - 6, 3);

    this.speaker = createText(scene, x + 16, y + 14, '', { size: 15, bold: true, color: TEXT_COLORS.accent });
    this.body = createText(scene, x + 16, y + 40, '', { size: 16, color: TEXT_COLORS.main });
    this.body.setWordWrapWidth(BOX_W - 32, true).setLineSpacing(5);
    const more = createText(scene, x + BOX_W - 14, y + BOX_H - 10, '눌러서 계속 ▼', {
      size: 12,
      bold: true,
      color: TEXT_COLORS.sub,
      originX: 1,
      originY: 1,
    });
    scene.tweens.add({ targets: more, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    this.box = scene.add.container(16, 0, [bg, this.speaker, this.body, more]);
    this.add([catcher, this.box]);
    this.setDepth(60).setVisible(false);
    scene.add.existing(this);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** 대화를 차례로 보여 주고, 끝나면 onDone 을 부른다. atTop: 인물이 화면 아래쪽에 있을 때 대화창을 위에 띄운다. */
  play(entries: DialogueEntry[], onDone: () => void, atTop = false): void {
    if (entries.length === 0) {
      onDone();
      return;
    }
    this.queue = entries;
    this.index = 0;
    this.onDone = onDone;
    this.open = true;
    this.box.setY(atTop ? LAYOUT.contentTop + 8 : LAYOUT.contentBottom - BOX_H - 8);
    this.setVisible(true);
    this.render();
  }

  private next(): void {
    if (!this.open) return;
    this.index++;
    if (this.index < this.queue.length) {
      this.render();
      return;
    }
    this.open = false;
    this.setVisible(false);
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  private render(): void {
    const entry = this.queue[this.index];
    const narration = entry.speaker === '';
    this.speaker.setText(narration ? '' : entry.speaker);
    this.body.setText(entry.text);
    this.body.setColor(narration ? '#c9d1d9' : TEXT_COLORS.main);
    this.body.setY(this.speaker.y + (narration ? 6 : 26));
  }
}
