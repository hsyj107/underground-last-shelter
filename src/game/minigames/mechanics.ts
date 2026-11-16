import Phaser from 'phaser';
import type { MinigameKind } from '../../data/minigames';
import { TEXT_COLORS, createText } from '../../ui/styles/theme';

/** 미니게임이 그려지는 영역 크기 */
export const AREA_W = 460;
export const AREA_H = 380;

/** 미니게임 한 판이 쓰는 도구. 타이머·매 프레임 처리는 판이 끝나면 자동으로 정리된다. */
export interface MinigameContext {
  scene: Phaser.Scene;
  /** 이 안에 그린다 (왼쪽 위가 0,0) */
  area: Phaser.GameObjects.Container;
  params: Record<string, number>;
  labels: string[];
  setStatus(text: string): void;
  win(): void;
  lose(): void;
  /** 판이 이미 끝났는지 */
  done(): boolean;
  later(ms: number, fn: () => void): void;
  onUpdate(fn: (delta: number) => void): void;
}

type Mechanic = (ctx: MinigameContext) => void;

const num = (value: number | undefined, fallback: number): number => value ?? fallback;

/** 누를 수 있는 영역을 만든다. */
function tapZone(ctx: MinigameContext, x: number, y: number, w: number, h: number, onTap: () => void): void {
  const zone = ctx.scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
  zone.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (!ctx.done()) onTap();
  });
  ctx.area.add(zone);
}

/** 타이밍 맞추기: 좌우로 움직이는 바늘이 초록 칸에 있을 때 누른다. */
const timing: Mechanic = (ctx) => {
  const { scene, area, params } = ctx;
  const need = num(params.hits, 3);
  const baseZone = num(params.zone, 80);
  let lives = num(params.lives, 3);
  let speed = num(params.speed, 260);
  let hits = 0;

  const barX = 30;
  const barY = 150;
  const barW = AREA_W - 60;
  const barH = 46;
  const frame = scene.add.graphics();
  frame.fillStyle(0x0b0e12, 1).fillRect(barX, barY, barW, barH);
  frame.lineStyle(2, 0x59616b, 1).strokeRect(barX, barY, barW, barH);
  const zone = scene.add.graphics();
  const needle = scene.add.rectangle(barX, barY + barH / 2, 6, barH + 22, 0xffffff);
  const mark = createText(scene, AREA_W / 2, barY + barH + 40, '', {
    size: 20, bold: true, originX: 0.5, originY: 0.5,
  });
  area.add([frame, zone, needle, mark]);

  let zoneX = 0;
  let zoneW = baseZone;
  let pos = 0;
  let dir = 1;
  const newZone = (): void => {
    zoneW = Math.max(36, baseZone - hits * 10);
    zoneX = 20 + Math.random() * (barW - zoneW - 40);
    zone.clear();
    zone.fillStyle(0x3fae5a, 1).fillRect(barX + zoneX, barY + 3, zoneW, barH - 6);
  };
  const show = (): void => ctx.setStatus(`성공 ${hits}/${need}   남은 기회 ${lives}`);
  newZone();
  show();

  ctx.onUpdate((delta) => {
    pos += (dir * speed * delta) / 1000;
    if (pos >= barW) {
      pos = barW;
      dir = -1;
    } else if (pos <= 0) {
      pos = 0;
      dir = 1;
    }
    needle.x = barX + pos;
  });

  tapZone(ctx, 0, 0, AREA_W, AREA_H, () => {
    if (pos >= zoneX && pos <= zoneX + zoneW) {
      hits++;
      speed *= 1.15;
      mark.setText('맞았다!').setColor(TEXT_COLORS.good);
      if (hits < need) newZone();
    } else {
      lives--;
      mark.setText('빗나감').setColor(TEXT_COLORS.warn);
    }
    show();
    if (hits >= need) ctx.win();
    else if (lives <= 0) ctx.lose();
  });
};

/** 순서 기억: 불이 들어오는 순서를 보고 그대로 누른다. */
const sequence: Mechanic = (ctx) => {
  const { scene, area, params, labels } = ctx;
  const start = num(params.start, 3);
  const rounds = num(params.rounds, 2);
  const colors = [0xd9534f, 0x4aa8e0, 0xf2c94c, 0x6fcf6f];
  const size = 132;
  const gap = 20;
  const ox = (AREA_W - size * 2 - gap) / 2;
  const oy = (AREA_H - size * 2 - gap) / 2;
  const DIM = 0.3;

  const pads: Phaser.GameObjects.Rectangle[] = [];
  let order: number[] = [];
  let input = 0;
  let round = 0;
  let accepting = false;

  const flash = (i: number, ms: number): void => {
    pads[i].setAlpha(1);
    ctx.later(ms, () => pads[i].setAlpha(DIM));
  };

  const startRound = (): void => {
    accepting = false;
    input = 0;
    const length = start + round;
    order = Array.from({ length }, () => Math.floor(Math.random() * 4));
    ctx.setStatus(`${round + 1}/${rounds}단계 · 순서를 잘 보세요`);
    order.forEach((pad, k) => ctx.later(700 + k * 650, () => flash(pad, 420)));
    ctx.later(700 + length * 650, () => {
      accepting = true;
      ctx.setStatus(`${round + 1}/${rounds}단계 · 같은 순서로 누르세요 (${length}개)`);
    });
  };

  for (let i = 0; i < 4; i++) {
    const x = ox + (i % 2) * (size + gap);
    const y = oy + Math.floor(i / 2) * (size + gap);
    const pad = scene.add.rectangle(x + size / 2, y + size / 2, size, size, colors[i]).setAlpha(DIM);
    pad.setStrokeStyle(3, 0x0b0e12);
    const label = createText(scene, x + size / 2, y + size / 2, labels[i] ?? `${i + 1}`, {
      size: 16, bold: true, color: '#0b0e12', originX: 0.5, originY: 0.5,
    });
    area.add([pad, label]);
    pads.push(pad);
    tapZone(ctx, x, y, size, size, () => {
      if (!accepting) return;
      flash(i, 180);
      if (order[input] !== i) {
        accepting = false;
        ctx.setStatus('순서가 틀렸습니다');
        ctx.lose();
        return;
      }
      input++;
      if (input < order.length) return;
      accepting = false;
      round++;
      if (round >= rounds) ctx.win();
      else ctx.later(800, startRound);
    });
  }
  startRound();
};

/** 나타나는 것 누르기: 칸에 잠깐 나타나는 과녁을 시간 안에 정해진 수만큼 누른다. */
const targets: Mechanic = (ctx) => {
  const { scene, area, params, labels } = ctx;
  const goal = num(params.goal, 10);
  const stay = num(params.stay, 950);
  const name = labels[0] ?? '과녁';
  let left = num(params.seconds, 20) * 1000;
  let score = 0;
  let current = -1;
  let serial = 0;

  const cols = 3;
  const cellW = AREA_W / cols;
  const cellH = AREA_H / cols;
  const grid = scene.add.graphics();
  for (let i = 0; i < cols * cols; i++) {
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * cellH;
    grid.fillStyle(0x0b0e12, 1).fillRect(x + 6, y + 6, cellW - 12, cellH - 12);
    grid.lineStyle(2, 0x3a4048, 1).strokeRect(x + 6, y + 6, cellW - 12, cellH - 12);
  }
  const dot = scene.add.circle(0, 0, 40, 0xe2622e).setStrokeStyle(3, 0xffd9a0).setVisible(false);
  const tag = createText(scene, 0, 0, name, { size: 14, bold: true, color: '#1a0d06', originX: 0.5, originY: 0.5 });
  tag.setVisible(false);
  area.add([grid, dot, tag]);

  const show = (): void => ctx.setStatus(`${name} ${score}/${goal}   남은 시간 ${Math.ceil(left / 1000)}초`);

  const place = (): void => {
    let next = Math.floor(Math.random() * cols * cols);
    if (next === current) next = (next + 1) % (cols * cols);
    current = next;
    serial++;
    const mine = serial;
    const cx = (next % cols) * cellW + cellW / 2;
    const cy = Math.floor(next / cols) * cellH + cellH / 2;
    dot.setPosition(cx, cy).setVisible(true);
    tag.setPosition(cx, cy).setVisible(true);
    // 누르지 못하면 다른 칸으로 옮겨 간다.
    ctx.later(stay, () => {
      if (serial === mine) place();
    });
  };

  for (let i = 0; i < cols * cols; i++) {
    tapZone(ctx, (i % cols) * cellW, Math.floor(i / cols) * cellH, cellW, cellH, () => {
      if (i !== current) return;
      score++;
      show();
      if (score >= goal) {
        dot.setVisible(false);
        tag.setVisible(false);
        ctx.win();
        return;
      }
      place();
    });
  }

  ctx.onUpdate((delta) => {
    left = Math.max(0, left - delta);
    show();
    if (left <= 0) ctx.lose();
  });
  place();
  show();
};

/** 짝 맞추기: 카드를 두 장씩 뒤집어 같은 것끼리 맞춘다. */
const pairs: Mechanic = (ctx) => {
  const { scene, area, params, labels } = ctx;
  const names = labels.slice(0, num(params.pairs, 4));
  const deck = [...names, ...names];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  let left = num(params.seconds, 45) * 1000;
  let first = -1;
  let locked = false;
  let matched = 0;

  const cols = 4;
  const rows = Math.ceil(deck.length / cols);
  const gap = 12;
  const cardW = 100;
  const cardH = rows <= 2 ? 130 : 104;
  const ox = (AREA_W - (cols * cardW + (cols - 1) * gap)) / 2;
  const oy = (AREA_H - (rows * cardH + (rows - 1) * gap)) / 2;
  const BACK = 0x252b33;
  const FRONT = 0x3a4a5a;
  const DONE = 0x2f6b3f;

  const cards: Phaser.GameObjects.Rectangle[] = [];
  const faces: Phaser.GameObjects.Text[] = [];
  const solved: boolean[] = deck.map(() => false);
  const reveal = (i: number, on: boolean): void => {
    faces[i].setText(on ? deck[i] : '?');
    cards[i].setFillStyle(on ? FRONT : BACK);
  };
  const show = (): void => ctx.setStatus(`맞춘 짝 ${matched}/${names.length}   남은 시간 ${Math.ceil(left / 1000)}초`);

  deck.forEach((_, i) => {
    const x = ox + (i % cols) * (cardW + gap);
    const y = oy + Math.floor(i / cols) * (cardH + gap);
    const card = scene.add.rectangle(x + cardW / 2, y + cardH / 2, cardW, cardH, BACK).setStrokeStyle(2, 0x59616b);
    const face = createText(scene, x + cardW / 2, y + cardH / 2, '?', {
      size: 17, bold: true, originX: 0.5, originY: 0.5,
    });
    area.add([card, face]);
    cards.push(card);
    faces.push(face);
    tapZone(ctx, x, y, cardW, cardH, () => {
      if (locked || solved[i] || i === first) return;
      reveal(i, true);
      if (first < 0) {
        first = i;
        return;
      }
      const other = first;
      first = -1;
      if (deck[other] === deck[i]) {
        solved[other] = true;
        solved[i] = true;
        cards[other].setFillStyle(DONE);
        cards[i].setFillStyle(DONE);
        matched++;
        show();
        if (matched >= names.length) ctx.win();
        return;
      }
      locked = true;
      ctx.later(650, () => {
        reveal(other, false);
        reveal(i, false);
        locked = false;
      });
    });
  });

  ctx.onUpdate((delta) => {
    left = Math.max(0, left - delta);
    show();
    if (left <= 0) ctx.lose();
  });
  show();
};

export const MECHANICS: Record<MinigameKind, Mechanic> = { timing, sequence, targets, pairs };
