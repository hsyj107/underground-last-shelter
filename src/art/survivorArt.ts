import { p, r, type Ctx } from './pixel';
import { C } from './palette';

/** 생존자 한 칸(셀) 크기. 발 아래 끝이 셀의 맨 아래 줄. */
export const CELL_W = 16;
export const CELL_H = 18;

export type Pose = 'idle' | 'walk' | 'work' | 'inspect' | 'rest';

/** 시트 안에서의 포즈 순서와 프레임 수 */
export const POSE_ORDER: Pose[] = ['idle', 'walk', 'work', 'inspect', 'rest'];
export const POSE_FRAMES: Record<Pose, number> = { idle: 2, walk: 4, work: 4, inspect: 2, rest: 2 };
export const TOTAL_FRAMES = POSE_ORDER.reduce((sum, pose) => sum + POSE_FRAMES[pose], 0);

export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  shirtDark: string;
  pants: string;
  boots: string;
  hat?: { color: string; brim: string };
  /** 가슴 장식 색 (의무병 십자 등) */
  mark?: string;
  /** 조끼 색 */
  vest?: string;
}

/** 직업별 외형 */
export const LOOKS: Record<string, Look> = {
  engineer: {
    skin: C.skin, hair: '#3a2a20', shirt: '#c9702a', shirtDark: '#9a521c', pants: '#3f4c63', boots: '#2a2320',
    hat: { color: C.yellow, brim: C.yellowDark }, vest: '#d9d34a',
  },
  farmer: {
    skin: C.skin, hair: '#5a3a22', shirt: '#6f8f4a', shirtDark: '#4e6a34', pants: '#6a5a40', boots: '#3a2c20',
    hat: { color: '#d2b66a', brim: '#a8903f' },
  },
  medic: {
    skin: C.skinDark, hair: '#22201f', shirt: '#dfe4e2', shirtDark: '#b4bcbb', pants: '#4a6a7a', boots: '#2a2a2e',
    hat: { color: '#e8eceb', brim: '#c0c8c7' }, mark: C.red,
  },
  guard: {
    skin: C.skin, hair: '#2e2a26', shirt: '#4a5240', shirtDark: '#343a2d', pants: '#3a3f33', boots: '#1f1f1f',
    hat: { color: '#3b4233', brim: '#2a3024' }, vest: '#2a2d2c',
  },
  scout: {
    skin: C.skinDark, hair: '#4a2a1a', shirt: '#7a5a3e', shirtDark: '#5a4029', pants: '#4a4f5c', boots: '#2a2220',
    hat: { color: '#b9462f', brim: '#8a3320' },
  },
};

interface Leg {
  x: number;
  y: number;
  h: number;
}

interface BodyOpts {
  dy: number;
  legs: Leg[];
  frontArm: { x: number; y: number; h: number };
  backArm: { x: number; y: number; h: number };
  headDy?: number;
}

function head(ctx: Ctx, ox: number, look: Look, dy: number): void {
  // 목/얼굴
  r(ctx, ox + 6, dy + 3, 4, 3, look.skin);
  // 머리카락(모자가 없으면) 또는 모자
  if (look.hat) {
    r(ctx, ox + 5, dy + 1, 6, 2, look.hat.color);
    r(ctx, ox + 9, dy + 2, 3, 1, look.hat.brim);
    p(ctx, ox + 5, dy + 3, look.hair);
  } else {
    r(ctx, ox + 5, dy + 1, 6, 2, look.hair);
    r(ctx, ox + 5, dy + 3, 1, 2, look.hair);
  }
  // 눈
  p(ctx, ox + 9, dy + 4, C.black);
}

function body(ctx: Ctx, ox: number, look: Look, o: BodyOpts): void {
  const { dy } = o;
  const top = 6 + dy;

  // 뒤쪽 팔
  r(ctx, ox + o.backArm.x, o.backArm.y, 1, o.backArm.h, look.shirtDark);
  p(ctx, ox + o.backArm.x, o.backArm.y + o.backArm.h, look.skin);

  // 다리 + 장화
  for (const leg of o.legs) {
    r(ctx, ox + leg.x, leg.y, 2, leg.h, look.pants);
    r(ctx, ox + leg.x, leg.y + leg.h - 1, 2, 1, look.boots);
  }

  // 몸통
  r(ctx, ox + 5, top, 6, 6, look.shirt);
  r(ctx, ox + 5, top + 5, 6, 1, look.shirtDark); // 허리띠 그늘
  if (look.vest) {
    r(ctx, ox + 6, top + 1, 4, 4, look.vest);
    p(ctx, ox + 8, top + 1, look.shirtDark);
  }
  if (look.mark) {
    r(ctx, ox + 8, top + 1, 2, 1, look.mark);
    r(ctx, ox + 8, top + 2, 1, 2, look.mark);
    r(ctx, ox + 7, top + 2, 3, 1, look.mark);
  }

  head(ctx, ox, look, o.headDy ?? dy);

  // 앞쪽 팔
  r(ctx, ox + o.frontArm.x, o.frontArm.y, 1, o.frontArm.h, look.shirt);
  p(ctx, ox + o.frontArm.x, o.frontArm.y + o.frontArm.h, look.skin);
}

function stand(dy: number): Leg[] {
  return [
    { x: 6, y: 12 + dy, h: 5 - dy },
    { x: 8, y: 12 + dy, h: 5 - dy },
  ];
}

function drawIdle(ctx: Ctx, ox: number, look: Look, f: number): void {
  const dy = f === 1 ? 1 : 0;
  body(ctx, ox, look, {
    dy,
    legs: stand(dy),
    frontArm: { x: 10, y: 7 + dy, h: 4 },
    backArm: { x: 5, y: 7 + dy, h: 4 },
  });
}

function drawWalk(ctx: Ctx, ox: number, look: Look, f: number): void {
  const apart = f % 2 === 0;
  const dy = apart ? 1 : 0;
  const h = 5 - dy;
  let legs: Leg[];
  let swing = 0;
  if (f === 0) {
    legs = [{ x: 9, y: 12 + dy, h }, { x: 5, y: 12 + dy, h }];
    swing = 1;
  } else if (f === 2) {
    legs = [{ x: 5, y: 12 + dy, h }, { x: 9, y: 12 + dy, h }];
    swing = -1;
  } else if (f === 1) {
    legs = [{ x: 7, y: 12, h: 4 }, { x: 7, y: 12, h: 5 }];
  } else {
    legs = [{ x: 7, y: 12, h: 5 }, { x: 7, y: 12, h: 4 }];
  }
  body(ctx, ox, look, {
    dy,
    legs,
    frontArm: { x: 10 + swing, y: 7 + dy, h: 4 },
    backArm: { x: 5 - swing, y: 7 + dy, h: 4 },
  });
}

function drawWork(ctx: Ctx, ox: number, look: Look, f: number): void {
  // 오른쪽 팔을 뻗어 도구를 위아래로 움직인다
  body(ctx, ox, look, {
    dy: 0,
    legs: [{ x: 6, y: 12, h: 5 }, { x: 9, y: 12, h: 5 }],
    frontArm: { x: 10, y: 7, h: 0 },
    backArm: { x: 5, y: 7, h: 4 },
  });
  const tool = '#aeb5bd';
  const handle = C.rustDark;
  if (f === 0) {
    r(ctx, ox + 10, 7, 1, 1, look.shirt);
    r(ctx, ox + 11, 6, 1, 1, look.shirt);
    p(ctx, ox + 12, 5, look.skin);
    r(ctx, ox + 12, 3, 1, 2, handle);
    r(ctx, ox + 11, 2, 3, 2, tool);
  } else if (f === 1 || f === 3) {
    r(ctx, ox + 10, 8, 2, 1, look.shirt);
    p(ctx, ox + 12, 8, look.skin);
    r(ctx, ox + 13, 7, 1, 3, handle);
    r(ctx, ox + 13, 6, 2, 1, tool);
  } else {
    r(ctx, ox + 10, 9, 1, 1, look.shirt);
    r(ctx, ox + 11, 10, 1, 1, look.shirt);
    p(ctx, ox + 12, 11, look.skin);
    r(ctx, ox + 13, 11, 1, 3, handle);
    r(ctx, ox + 12, 14, 3, 1, tool);
  }
}

function drawInspect(ctx: Ctx, ox: number, look: Look, f: number): void {
  body(ctx, ox, look, {
    dy: 0,
    legs: stand(0),
    frontArm: { x: 10, y: 7, h: 1 },
    backArm: { x: 5, y: 7, h: 4 },
  });
  // 점검용 태블릿을 들어 올린 팔
  r(ctx, ox + 11, 6, 1, 2, look.shirt);
  p(ctx, ox + 11, 5, look.skin);
  r(ctx, ox + 12, 3, 3, 4, '#2c343c');
  r(ctx, ox + 13, 4, 1, 2, f === 0 ? '#5fd6e8' : '#b8f4ff');
}

function drawRest(ctx: Ctx, ox: number, look: Look, f: number): void {
  // 앉은 자세: 몸통을 낮추고 다리를 앞으로 뻗는다
  const dy = 4 + (f === 1 ? 1 : 0);
  // 허벅지 + 종아리
  r(ctx, ox + 6, 15, 6, 2, look.pants);
  r(ctx, ox + 11, 15, 2, 3, look.pants);
  r(ctx, ox + 11, 17, 3, 1, look.boots);
  body(ctx, ox, look, {
    dy,
    legs: [],
    frontArm: { x: 10, y: 7 + dy, h: 3 },
    backArm: { x: 5, y: 7 + dy, h: 3 },
  });
}

/** 한 프레임을 (ox, 0) 셀에 그린다 */
export function drawSurvivorFrame(ctx: Ctx, ox: number, pose: Pose, f: number, look: Look): void {
  switch (pose) {
    case 'idle':
      return drawIdle(ctx, ox, look, f);
    case 'walk':
      return drawWalk(ctx, ox, look, f);
    case 'work':
      return drawWork(ctx, ox, look, f);
    case 'inspect':
      return drawInspect(ctx, ox, look, f);
    case 'rest':
      return drawRest(ctx, ox, look, f);
  }
}

/** 프레임 이름: 'idle_0', 'walk_3' ... */
export function frameName(pose: Pose, f: number): string {
  return `${pose}_${f}`;
}

/** 시트 전체(모든 포즈를 가로로 나열)를 그린다 */
export function drawSurvivorSheet(ctx: Ctx, look: Look): void {
  let col = 0;
  for (const pose of POSE_ORDER) {
    for (let f = 0; f < POSE_FRAMES[pose]; f++) {
      drawSurvivorFrame(ctx, col * CELL_W, pose, f, look);
      col++;
    }
  }
}

/** 프레임이 시트에서 차지하는 x 좌표 */
export function frameRects(): { name: string; x: number }[] {
  const out: { name: string; x: number }[] = [];
  let col = 0;
  for (const pose of POSE_ORDER) {
    for (let f = 0; f < POSE_FRAMES[pose]; f++) {
      out.push({ name: frameName(pose, f), x: col * CELL_W });
      col++;
    }
  }
  return out;
}
