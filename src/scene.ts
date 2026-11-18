// 지상 + 지하 7층 편의점 단면을 그리는 캔버스 장면.
import { SHELF_ORDER, SURV_BY_ID } from './data.ts';
import { drawBag, drawCat, drawPerson, drawText, drawZombie, iconCanvas, personHeight } from './sprites.ts';

export const SW = 180;
/** 매장(지하 7층) 안쪽 끝 y: 바닥 띠가 여기서 끝난다 */
const SHS = 156;
/** 지상과 지하 7층 사이, 지하 1~6층을 지나가는 구간 높이 */
const DEPTH = 12;
/** 지상 그림에서 보이는 높이 (아래쪽 28칸만 잘라 보여 준다) */
const SURF = 28;
const SURF_CROP = 18;
/** 층 하나의 화면 높이: 매장은 안쪽 46~156, 생산실은 0~110 */
const B7_H = SHS - 46;
const H8 = 110;
/** 생산실 바닥선 */
const FL8 = 84;
/** 위에서부터 캔버스 y: 지상, 띠, 지하 7층, 지하 8층 */
const ORG7 = SURF + DEPTH - 46;
const TOP7 = SURF + DEPTH;
const ORG8 = TOP7 + B7_H;
export const SH = ORG8 + H8;

const GROUND_Y = 40; // 지표면
const STORE_TOP = 46;
const FLOOR_Y = 130;
const SHELF_X = [14, 76];
const SHELF_TOP = 58;
const TIER_H = 14;
const WALK_MIN = 18;
const WALK_MAX = 150;
/** 생산실에서 일하는 자리: 1번 선반, 2번 선반, 작업대, 정수 탱크 앞 */
const WORK_POSTS = [27, 79, 142, 116];
/** 층별로 서 있는 줄(발 위치) */
function laneOf(floor: View, seed: number): number {
  return floor === 'b8' ? 92 + (seed % 4) * 3 : 138 + (seed % 4) * 4;
}
function postLane(floor: View): number {
  return floor === 'b8' ? 98 : 147;
}

export interface SceneModel {
  items: Record<string, number>;
  /** 매장에 있는 사람들 ('me' 포함) */
  present: string[];
  visitor: string | null;
  /** 맡은 일: 방어조는 문 앞을 지키고 생산조는 밭·정수기에서 일한다 */
  roles: Record<string, string>;
  sick: string[];
  /** 습격 중이면 방어조가 경계 태세 */
  alert: boolean;
  bags: number;
  hour: number;
  /** 수경재배·정수 설비 개조 단계: 생산실이 풍성해진다 */
  farm: number;
  water: number;
}

export type View = 'b7' | 'b8';

export interface SceneHandlers {
  onSurvivor(id: string, lx: number, ly: number, floor: View): void;
  onVisitor(): void;
  onBag(): void;
  onElevator(): void;
}

interface Walker {
  id: string;
  x: number;
  lane: number;
  tx: number;
  dir: 1 | -1;
  pause: number;
  speed: number;
  moving: boolean;
  seed: number;
  /** 지금 있는 층: 생산조는 지하 8층 생산실에서 일한다 */
  floor: View;
  /** 맡은 자리가 있으면 거기서 움직이지 않는다 */
  post: { x: number; face: 1 | -1; kind: 'guard' | 'work' } | null;
}

interface Zom {
  x: number;
  y: number;
  min: number;
  max: number;
  dir: 1 | -1;
  speed: number;
  seed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: 'heart' | 'spark' | 'plus';
  color: string;
  view: View;
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number): number => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function skyColors(hour: number): [string, string, number] {
  // [위, 아래, 별빛 세기]
  if (hour >= 21 || hour < 5) return ['#10142a', '#2a2438', 1];
  if (hour < 8) return ['#5a5a7a', '#d8a070', 0.2];
  if (hour < 17) return ['#7c828c', '#b8b0a0', 0];
  return ['#4a3a5a', '#c8704a', 0.3];
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 폐허가 된 빌딩 실루엣 (한 번만 만든다)
interface Bld {
  x: number;
  w: number;
  h: number;
  cut: number;
  win: [number, number][];
  far: boolean;
}
const buildings: Bld[] = (() => {
  const r = seeded(7);
  const out: Bld[] = [];
  for (const far of [true, false]) {
    let x = far ? -4 : 2;
    while (x < SW) {
      const w = (far ? 14 : 18) + Math.floor(r() * 12);
      const h = (far ? 14 : 22) + Math.floor(r() * (far ? 14 : 12));
      const win: [number, number][] = [];
      for (let i = 0; i < 4; i++) if (r() < 0.5) win.push([1 + Math.floor(r() * (w - 3)), 3 + Math.floor(r() * (h - 6))]);
      out.push({ x, w, h, cut: 2 + Math.floor(r() * 6), win, far });
      x += w + (far ? 2 : 6 + Math.floor(r() * 8));
    }
  }
  return out;
})();

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private walkers = new Map<string, Walker>();
  private zombies: Zom[] = [];
  private particles: Particle[] = [];
  private t = 0;
  private raf = 0;
  private lastTs = 0;
  private flicker = 1;
  private nextFlicker = 2;
  private workT = 0;
  private rand = seeded(42);

  constructor(
    private canvas: HTMLCanvasElement,
    private getModel: () => SceneModel,
    private handlers: SceneHandlers,
  ) {
    canvas.width = SW;
    canvas.height = SH;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    for (let i = 0; i < 5; i++) {
      const min = 4 + i * 28;
      this.zombies.push({ x: min + 10, y: GROUND_Y - 1 + (i % 2), min, max: min + 40, dir: i % 2 ? 1 : -1, speed: 3 + (i % 3) * 1.5, seed: i * 3 });
    }
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
  }

  start(): void {
    const loop = (ts: number): void => {
      const dt = Math.min(0.1, (ts - this.lastTs) / 1000 || 0);
      this.lastTs = ts;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  /** 장면 좌표 → 화면(CSS) 좌표 */
  cssPos(x: number, y: number, floor: View = 'b7'): { left: number; top: number } {
    const r = this.canvas.getBoundingClientRect();
    return { left: (x / SW) * r.width, top: ((y + (floor === 'b8' ? ORG8 : ORG7)) / SH) * r.height };
  }

  burst(x: number, y: number, kind: 'heart' | 'spark', n = 5, floor: View = 'b7'): void {
    for (let i = 0; i < n; i++) {
      const color = kind === 'heart' ? '#ff6a8a' : ['#ffd34d', '#fff0a0', '#ffffff'][i % 3];
      this.particles.push({
        x: x + (this.rand() - 0.5) * 8,
        y,
        vx: (this.rand() - 0.5) * 16,
        vy: -10 - this.rand() * 12,
        life: 0,
        max: 0.9 + this.rand() * 0.5,
        kind,
        color,
        view: floor,
      });
    }
  }

  private onPointer(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const lx = ((e.clientX - r.left) / r.width) * SW;
    const cy = ((e.clientY - r.top) / r.height) * SH;
    if (cy < TOP7) return;
    const floor: View = cy >= ORG8 ? 'b8' : 'b7';
    const ly = cy - (floor === 'b8' ? ORG8 : ORG7);
    const m = this.getModel();
    if (lx >= 158 && lx <= 178) {
      this.handlers.onElevator();
      return;
    }
    if (floor === 'b7') {
      for (let i = 0; i < m.bags; i++) {
        const bx = 30 + i * 13;
        if (lx >= bx - 2 && lx <= bx + 12 && ly >= 138 && ly <= 156) {
          this.handlers.onBag();
          return;
        }
      }
      if (m.visitor && lx >= 8 && lx <= 36 && ly >= 108 && ly <= 152) {
        this.handlers.onVisitor();
        return;
      }
    }
    const list = [...this.walkers.values()].sort((a, b) => b.lane - a.lane);
    for (const w of list) {
      if (w.floor !== floor) continue;
      const sl = SURV_BY_ID[w.id]?.look;
      const h = sl?.cat ? 10 : sl ? personHeight(sl) : 20;
      if (Math.abs(lx - w.x) <= 9 && ly >= w.lane - h && ly <= w.lane + 2) {
        this.handlers.onSurvivor(w.id, w.x, w.lane - h, floor);
        return;
      }
    }
  }

  private update(dt: number): void {
    this.t += dt;
    const m = this.getModel();
    // 조명 깜박임
    this.nextFlicker -= dt;
    if (this.nextFlicker <= 0) {
      this.flicker = 0.5 + this.rand() * 0.5;
      this.nextFlicker = this.flicker < 0.8 ? 0.06 : 1.5 + this.rand() * 4;
      if (this.flicker >= 0.8) this.flicker = 1;
    }
    // 사람 동기화
    const present = new Set(m.present);
    for (const id of present) {
      if (!this.walkers.has(id)) {
        const idx = this.walkers.size;
        this.walkers.set(id, {
          id,
          x: 150,
          lane: laneOf('b7', idx),
          tx: 60 + this.rand() * 80,
          dir: -1,
          pause: 0,
          speed: 12 + this.rand() * 6,
          moving: true,
          seed: idx,
          floor: 'b7',
          post: null,
        });
      }
    }
    for (const id of [...this.walkers.keys()]) if (!present.has(id)) this.walkers.delete(id);
    const ok = (id: string): boolean => !m.sick.includes(id);
    const guards = m.present.filter((id) => m.roles[id] === 'guard' && ok(id));
    const workers = m.present.filter((id) => m.roles[id] === 'work' && ok(id));
    for (const w of this.walkers.values()) {
      const gi = guards.indexOf(w.id);
      const wi = workers.indexOf(w.id);
      const want: View = wi >= 0 ? 'b8' : 'b7';
      if (w.floor !== want) {
        // 승강기로 다른 층에 내린다
        w.floor = want;
        w.x = 150;
        w.lane = laneOf(want, w.seed);
        w.pause = 0;
        w.moving = true;
      }
      w.post = gi >= 0 ? { x: 30 + gi * 15, face: -1, kind: 'guard' } : wi >= 0 ? { x: WORK_POSTS[wi % 4], face: wi % 2 ? 1 : -1, kind: 'work' } : null;
    }
    // 생산실에서 일하는 느낌: 잎사귀와 물방울
    this.workT -= dt;
    if (this.workT <= 0 && workers.length) {
      this.workT = 0.9 / Math.min(3, workers.length);
      const farm = this.rand() < 0.65;
      const tray = [34, 56, 78][Math.floor(this.rand() * 3)];
      this.particles.push({
        x: farm ? 8 + this.rand() * 90 : 110 + this.rand() * 12,
        y: farm ? tray - 4 : 56,
        vx: (this.rand() - 0.5) * 6,
        vy: -8 - this.rand() * 6,
        life: 0,
        max: 0.8,
        kind: farm ? 'plus' : 'spark',
        color: farm ? '#8ee06a' : '#6ec6ff',
        view: 'b8',
      });
    }
    for (const w of this.walkers.values()) {
      if (w.post) {
        // 일꾼은 밭 뒤쪽 줄로 올라선다
        const pl = postLane(w.floor);
        w.lane += Math.max(-30 * dt, Math.min(30 * dt, pl - w.lane));
        const d = w.post.x - w.x;
        if (Math.abs(d) < 1) {
          w.moving = false;
          w.dir = w.post.face;
          continue;
        }
        w.moving = true;
        w.dir = d > 0 ? 1 : -1;
        w.x += w.dir * Math.min(Math.abs(d), (w.speed + 6) * dt);
        continue;
      }
      if (!ok(w.id)) {
        w.moving = false;
        continue;
      }
      if (w.pause > 0) {
        w.pause -= dt;
        w.moving = false;
        continue;
      }
      const d = w.tx - w.x;
      if (Math.abs(d) < 1) {
        w.pause = 1.5 + this.rand() * 4;
        w.tx = WALK_MIN + this.rand() * (WALK_MAX - WALK_MIN);
        w.moving = false;
        continue;
      }
      w.moving = true;
      w.dir = d > 0 ? 1 : -1;
      w.x += w.dir * Math.min(Math.abs(d), w.speed * dt);
    }
    // 좀비
    for (const z of this.zombies) {
      z.x += z.dir * z.speed * dt;
      if (z.x < z.min) z.dir = 1;
      if (z.x > z.max) z.dir = -1;
    }
    // 입자
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 10 * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
  }

  // ---------- 그리기 ----------

  private draw(): void {
    const ctx = this.ctx;
    const m = this.getModel();
    ctx.clearRect(0, 0, SW, SH);
    // 지상 + 생략 띠 (지상 그림은 아래쪽만 잘라 보여 준다)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SW, TOP7);
    ctx.clip();
    ctx.translate(0, -SURF_CROP);
    this.drawSurface(ctx, m.hour);
    this.drawDepth(ctx);
    ctx.restore();
    // 지하 7층: 전시 선반과 휴게 코너
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP7, SW, B7_H);
    ctx.clip();
    ctx.translate(0, ORG7);
    this.drawStore(ctx, m);
    this.drawEntities(ctx, m, 'b7');
    this.drawLight(ctx);
    this.drawParticles(ctx, 'b7');
    ctx.restore();
    // 지하 8층: 생산실
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, ORG8, SW, H8);
    ctx.clip();
    ctx.translate(0, ORG8);
    this.drawProduction(ctx, m);
    this.drawEntities(ctx, m, 'b8');
    this.drawProductionLight(ctx, m);
    this.drawParticles(ctx, 'b8');
    ctx.restore();
  }

  /** 지상에서 지하 7층까지 내려가는 동안 건너뛴 층들: 얇은 생략 구간과 승강기만 보여 준다 */
  private drawDepth(ctx: CanvasRenderingContext2D): void {
    const y0 = STORE_TOP;
    const R = (x: number, y: number, w: number, h: number, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    R(0, y0, 160, DEPTH, '#1a1612');
    R(0, y0, 160, 1, '#2d261f');
    R(0, y0 + DEPTH - 1, 160, 1, '#0d0a08');
    // 건너뛴 층 표시: B1 · · · B6
    drawText(ctx, 'B1', 3, y0 + 3, '#9a8660');
    for (let k = 0; k < 3; k++) R(16 + k * 3, y0 + 6, 1, 1, '#6a5a46');
    drawText(ctx, 'B6', 27, y0 + 3, '#9a8660');
    // 두꺼운 철근 콘크리트: 가는 균열과 배관
    for (let x = 24; x < 158; x += 22) R(x, y0 + 3 + ((x * 3) % 7), 10, 1, '#2a231c');
    R(40, y0 + 2, 1, DEPTH - 4, '#2a231c');
    R(100, y0 + 2, 1, DEPTH - 4, '#2a231c');
    // 승강기 통로: 케이블과 내려가는 승강기 칸
    R(160, y0, 16, DEPTH, '#1e1a1a');
    R(167, y0, 2, DEPTH, '#3a3636');
    R(163, y0, 1, DEPTH, '#2d2929');
    R(172, y0, 1, DEPTH, '#2d2929');
    const cy = y0 + Math.floor((this.t * 4) % (DEPTH - 5));
    R(162, cy, 12, 5, '#6a6a72');
    R(162, cy, 12, 1, '#8a8a92');
    R(167, cy + 1, 1, 4, '#222');
    R(163, cy + 2, 3, 2, '#ffd34d');
    R(176, y0, 4, DEPTH, '#2b211a');
  }

  private drawSurface(ctx: CanvasRenderingContext2D, hour: number): void {
    const [top, bottom, stars] = skyColors(hour);
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = lerpColor(top, bottom, i / (bands - 1));
      ctx.fillRect(0, Math.floor((i * GROUND_Y) / bands), SW, Math.ceil(GROUND_Y / bands) + 1);
    }
    if (stars > 0) {
      ctx.fillStyle = `rgba(255,255,230,${0.8 * stars})`;
      const r = seeded(99);
      for (let i = 0; i < 18; i++) ctx.fillRect(Math.floor(r() * SW), Math.floor(r() * 18), 1, 1);
      ctx.fillStyle = '#e8e8d0';
      ctx.fillRect(150, 6, 5, 5);
      ctx.fillStyle = lerpColor(top, bottom, 0.1);
      ctx.fillRect(152, 5, 4, 4);
    }
    // 느리게 흐르는 구름
    ctx.fillStyle = 'rgba(40,40,50,0.35)';
    for (let i = 0; i < 3; i++) {
      const cx = ((this.t * (2 + i) + i * 70) % (SW + 40)) - 20;
      ctx.fillRect(cx, 6 + i * 6, 20, 3);
      ctx.fillRect(cx + 4, 4 + i * 6, 12, 2);
    }
    // 빌딩
    for (const b of buildings) {
      const base = b.far ? '#3a3a48' : '#26262e';
      const by = GROUND_Y - b.h;
      ctx.fillStyle = base;
      ctx.fillRect(b.x, by, b.w, b.h);
      ctx.fillStyle = lerpColor(top, bottom, 0.6);
      ctx.fillRect(b.x + b.w - b.cut, by, b.cut, 3 + (b.cut % 3)); // 무너진 모서리
      if (!b.far) {
        ctx.fillStyle = hour >= 17 || hour < 6 ? '#d8b868' : '#4a4a58';
        for (const [wx, wy] of b.win) ctx.fillRect(b.x + wx, by + wy, 2, 2);
      }
    }
    // 지면
    ctx.fillStyle = '#4a4540';
    ctx.fillRect(0, GROUND_Y - 1, SW, 6);
    ctx.fillStyle = '#5a554e';
    ctx.fillRect(0, GROUND_Y - 1, SW, 1);
    ctx.fillStyle = '#3a3530';
    for (let x = 6; x < SW; x += 24) ctx.fillRect(x, GROUND_Y + 2, 8, 1);
    // 땅속
    ctx.fillStyle = '#2b211a';
    ctx.fillRect(0, GROUND_Y + 5, SW, STORE_TOP - GROUND_Y - 5 + 1);
    // 입구
    ctx.fillStyle = '#5a5a62';
    ctx.fillRect(150, GROUND_Y - 14, 26, 14);
    ctx.fillStyle = '#44444c';
    ctx.fillRect(150, GROUND_Y - 14, 26, 2);
    ctx.fillStyle = '#1a1612';
    ctx.fillRect(158, GROUND_Y - 9, 10, 9);
    ctx.fillStyle = '#e8c04a';
    for (let x = 150; x < 176; x += 4) ctx.fillRect(x, GROUND_Y - 14, 2, 2);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(162, GROUND_Y - 7, 2, 2);
    // 좀비
    for (const z of this.zombies) drawZombie(ctx, z.x, z.y, this.t * 1000, z.dir, z.seed);
    // 먼지
    ctx.fillStyle = 'rgba(200,190,170,0.4)';
    for (let i = 0; i < 6; i++) {
      const px = ((this.t * (6 + i) + i * 31) % SW);
      ctx.fillRect(px, 8 + ((i * 9) % 26), 1, 1);
    }
  }

  /** 지하 8층 생산실: 3단 재배 선반 둘, 정수 탱크, 작업대. 생산조가 없으면 불이 꺼져 있다. (층 안쪽 좌표: 천장 0~8, 바닥선 84, 끝 110) */
  private drawProduction(ctx: CanvasRenderingContext2D, m: SceneModel): void {
    const t = this.t;
    const n = m.present.filter((id) => m.roles[id] === 'work' && !m.sick.includes(id)).length;
    const on = n > 0;
    const R = (x: number, y: number, w: number, h: number, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    const pulse = on ? 0.85 + 0.15 * Math.sin(t * 3) : 0.3;
    this.drawElevator(ctx, 0, FL8, H8);

    // --- 벽과 바닥
    R(0, 0, 160, FL8, '#6b7a6e');
    for (let x = 0; x < 160; x += 20) R(x, 8, 1, FL8 - 8, '#627166');
    R(0, 70, 160, FL8 - 70, '#56645a');
    R(0, 70, 160, 2, '#46524a');
    for (let y = FL8; y < H8; y += 6) {
      for (let x = 0; x < 160; x += 8) {
        R(x, y, 8, 6, ((x / 8 + (y - FL8) / 6) | 0) % 2 === 0 ? '#625d55' : '#57534c');
      }
    }
    R(0, H8 - 2, 180, 2, '#2b211a');
    R(0, FL8, 160, 2, '#1c1c20');
    for (let x = 0; x < 160; x += 8) R(x, FL8, 4, 2, '#c9a227');
    R(84, 98, 14, 4, '#26262c');
    for (let x = 85; x < 97; x += 3) R(x, 99, 1, 2, '#4a4a54');
    R(60, 104, 52, 2, '#46586a');
    R(60, 104, 52, 1, '#6a8298');
    R(60, 98, 2, 8, '#46586a');

    // --- 천장: 전선 트레이, 주 수관, 흐르는 물
    R(0, 0, 160, 8, '#2a2622');
    R(0, 0, 160, 1, '#3a3530');
    R(0, 7, 160, 1, '#14110e');
    R(0, 1, 160, 2, '#3b3a3a');
    for (let x = 4; x < 160; x += 12) R(x, 1, 1, 2, '#5a5a5a');
    R(0, 4, 160, 3, '#5d7184');
    R(0, 4, 160, 1, '#8ba3b8');
    R(0, 6, 160, 1, '#3a4a5a');
    for (const x of [18, 54, 102, 126, 150]) {
      R(x, 3, 2, 5, '#3a4a5a');
      R(x, 3, 1, 5, '#6a8298');
    }
    if (on) for (let k = 0; k < 7; k++) R((t * 22 + k * 24) % 160, 5, 2, 1, '#cfeeff');
    // 층 표지판
    R(132, 9, 11, 8, '#2a2a30');
    R(132, 9, 11, 1, '#7fd05a');
    R(132, 16, 11, 1, '#7fd05a');
    drawText(ctx, 'B8', 134, 10, '#7fd05a');

    // --- 재배 선반 (두 대). 업그레이드 단계에 따라 층이 늘어난다(맨 아래부터).
    const tiers = 1 + (m.farm >= 1 ? 1 : 0) + (m.farm >= 3 ? 1 : 0);
    const TRAY = [34, 56, 78];
    const rack = (x0: number, fruit: boolean): void => {
      const w = 46;
      R(x0, 12, 2, FL8 - 12, '#2f2f38');
      R(x0, 12, 1, FL8 - 12, '#50505c');
      R(x0 + w - 2, 12, 2, FL8 - 12, '#2f2f38');
      R(x0 + w - 2, 12, 1, FL8 - 12, '#50505c');
      R(x0 - 1, 10, w + 2, 3, '#3a3a46');
      R(x0 - 1, 10, w + 2, 1, '#5a5a68');
      for (let ti = 0; ti < 3; ti++) {
        const ty = TRAY[ti];
        const active = ti >= 3 - tiers;
        const ly = ty - 17;
        // 재배등
        R(x0 + 2, ly, w - 4, 3, '#3a3a46');
        R(x0 + 2, ly, w - 4, 1, '#5a5a68');
        R(x0 + 3, ly + 3, w - 6, 1, on && active ? (pulse > 0.95 ? '#ffd0ff' : '#ff9aff') : '#4a3a4a');
        if (on && active) {
          for (let y = ly + 4; y < ty; y++) {
            const spread = Math.floor((y - ly) * 0.18);
            ctx.fillStyle = `rgba(255,130,255,${(0.08 + (y - ly) * 0.005) * pulse})`;
            ctx.fillRect(x0 + 3 - spread, y, w - 6 + spread * 2, 1);
          }
        }
        // 트레이
        R(x0 + 1, ty, w - 2, 1, '#70707e');
        R(x0 + 1, ty + 1, w - 2, 3, '#585866');
        R(x0 + 1, ty + 4, w - 2, 1, '#2b2b34');
        R(x0 + 2, ty - 2, w - 4, 2, fruit ? '#4a3322' : '#2a4a5a');
        if (!fruit) for (let i = 0; i < 6; i++) R(x0 + 4 + i * 7, ty - 2, 3, 1, '#4a6a7a');
        if (!active) continue;
        // 작물: 시간이 지나면 자라고, 다 크면 열매가 열린다. 생산조가 없으면 시든다.
        for (let i = 0; i < 9; i++) {
          const px = x0 + 5 + i * 4;
          if (!on) {
            R(px, ty - 4, 1, 2, '#6a6a3a');
            R(px - 1, ty - 4, 2, 1, '#7a7440');
            continue;
          }
          const stage = (Math.floor(t * 0.45) + i * 2 + ti * 3 + (fruit ? 1 : 0)) % 8;
          const h = Math.min(9, 2 + stage);
          const sway = Math.floor(t * 1.5 + i) % 4 === 0 ? 1 : 0;
          R(px, ty - 2 - h, 1, h, '#3f8a34');
          if (h >= 4) {
            R(px - 2 + sway, ty - h, 2, 2, '#6fcf4a');
            R(px + 1 + sway, ty - h + 2, 2, 2, '#58b83c');
          }
          if (h >= 7) {
            R(px - 1 + sway, ty - 2 - h, 3, 2, '#8ee06a');
            if (fruit || i % 3 === 0) {
              R(px + 1, ty - h + 3, 2, 2, fruit ? '#e0503a' : '#c8e060');
              R(px + 1, ty - h + 3, 1, 1, fruit ? '#ff9a8a' : '#f0ffb0');
            }
          }
        }
        // 물방울 (맨 아래 층은 바닥에 닿으니 생략)
        if (on && ti < 2) {
          const dx = x0 + 6 + ((ti * 13 + Math.floor(t * 2)) % 30);
          R(dx, ty + 5 + ((Math.floor(t * 4) + ti) % 4), 1, 2, '#6ec6ff');
        }
      }
    };
    rack(4, false);
    rack(56, true);
    // 선반 사이 수직 배관과 밸브
    R(51, 6, 3, FL8 - 8, '#46586a');
    R(51, 6, 1, FL8 - 8, '#6a8298');
    for (const y of [28, 50]) {
      R(50, y, 5, 3, '#9a3328');
      R(51, y, 3, 1, '#d8574a');
    }

    // --- 정수 탱크와 여과 장치
    R(108, 12, 16, 3, '#2f3a46');
    R(110, 10, 12, 2, '#3f4f60');
    R(108, 15, 16, 50, '#5a6a7a');
    R(108, 15, 2, 50, '#8aa0b4');
    R(122, 15, 2, 50, '#3a4654');
    for (const y of [28, 44]) R(108, y, 16, 1, '#3a4654');
    R(112, 20, 8, 38, '#223040');
    R(112, 20, 1, 38, '#3f4f60');
    const lvl = on ? 14 + Math.floor(10 + 8 * Math.sin(t * 1.2)) : 8;
    R(112, 58 - lvl, 8, lvl, '#6ec6ff');
    R(112, 58 - lvl, 8, 1, '#bfe8ff');
    for (let i = 0; i < 5; i++) R(110, 22 + i * 7, 2, 1, '#c8d0d8');
    if (on) for (let b = 0; b < 3; b++) R(114 + b * 2, 56 - ((Math.floor(t * 7) + b * 7) % Math.max(2, lvl)), 1, 1, '#ffffff');
    R(113, 17, 3, 2, on ? (Math.floor(t * 2) % 2 === 0 ? '#6aff8a' : '#2a6a3a') : '#3a2a2a');
    R(118, 17, 3, 2, m.water >= 2 ? '#6ec6ff' : '#2a3a4a');
    // 탱크 옆 사다리
    R(125, 15, 1, 50, '#444450');
    R(128, 15, 1, 50, '#444450');
    for (let y = 18; y < 65; y += 6) R(125, y, 4, 1, '#5a5a66');
    // 펌프와 여과통
    R(106, 65, 20, 3, '#3a4654');
    R(108, 68, 16, 16, '#46586a');
    R(108, 68, 16, 1, '#6a8298');
    R(110, 70, 5, 12, '#7a8a9a');
    R(110, 70, 5, 2, '#a8b8c8');
    R(111, 73, 3, 6, on ? '#6ec6ff' : '#4a5a6a');
    R(117, 70, 5, 12, '#7a8a9a');
    R(117, 70, 5, 2, '#a8b8c8');
    R(118, 73, 3, 6, on ? '#6ec6ff' : '#4a5a6a');
    if (m.water >= 2) {
      // 두 번째 여과 단계
      R(104, 70, 3, 12, '#7a8a9a');
      R(104, 70, 3, 2, '#a8b8c8');
    }
    if (m.water >= 4 && on) {
      // 자외선 살균등
      R(114, 66, 6, 1, '#b48aff');
      ctx.fillStyle = 'rgba(180,138,255,0.18)';
      ctx.fillRect(108, 65, 16, 6);
    }
    if (on) R(116, FL8 + ((Math.floor(t * 3)) % 3), 1, 2, '#6ec6ff');

    // --- 작업대 구역
    // 공구 거치대
    R(129, 18, 29, 20, '#8a6d4b');
    R(129, 18, 29, 1, '#a88a64');
    for (let y = 20; y < 37; y += 4) for (let x = 131; x < 157; x += 4) R(x, y, 1, 1, '#6a5236');
    R(133, 19, 1, 14, '#5a3e22');
    R(131, 31, 5, 4, '#b8b8c0');
    R(131, 31, 5, 1, '#e8e8f0');
    R(141, 19, 1, 16, '#5a3e22');
    R(138, 19, 6, 2, '#b8b8c0');
    R(148, 23, 8, 5, '#4a8ac8');
    R(148, 23, 8, 1, '#7ab4e8');
    R(156, 24, 2, 1, '#4a8ac8');
    R(150, 31, 4, 1, '#c0392b');
    R(150, 31, 1, 4, '#c0392b');
    R(153, 31, 1, 4, '#c0392b');
    // 생육 기록판
    R(130, 40, 16, 14, '#e8e0c8');
    R(130, 40, 16, 1, '#9a9078');
    R(136, 38, 4, 3, '#5a5a66');
    for (let y = 43; y < 52; y += 3) R(132, y, 12, 1, '#c8c0a8');
    R(132, 52, 2, 1, '#4f9a3a');
    R(134, 50, 2, 1, '#4f9a3a');
    R(136, 48, 2, 1, '#4f9a3a');
    R(138, 46, 2, 1, '#4f9a3a');
    R(140, 44, 2, 1, '#4f9a3a');
    // 환기 팬
    R(148, 40, 10, 10, '#3a3a44');
    R(149, 41, 8, 8, '#1c1c22');
    const fan = on ? Math.floor(t * 10) % 2 : 0;
    R(150 + fan, 44, 6 - fan * 2, 1, '#9a9aa6');
    R(152, 42 + fan, 1, 6 - fan * 2, '#9a9aa6');
    // 씨앗 병 선반
    R(128, 63, 30, 2, '#6a4e30');
    const seeds = ['#e8c04a', '#c8602a', '#6fcf4a', '#e8dfc8', '#8a5a3a', '#d8b8e8'];
    for (let i = 0; i < 6; i++) {
      R(130 + i * 5, 56, 4, 7, '#cfe8f0');
      R(130 + i * 5, 56, 4, 1, '#8aa0a8');
      R(131 + i * 5, 59, 2, 4, seeds[i]);
    }
    // 작업대와 저울, 수확 상자
    R(128, 72, 24, 3, '#b08858');
    R(128, 72, 24, 1, '#c8a070');
    R(129, 75, 2, 9, '#6a4a2c');
    R(149, 75, 2, 9, '#6a4a2c');
    R(131, 80, 18, 1, '#6a4a2c');
    R(133, 76, 7, 4, '#c8b88c');
    R(141, 76, 6, 4, '#bba878');
    R(131, 68, 10, 4, '#555b66');
    R(132, 66, 8, 2, '#8a8a92');
    R(134, 69, 3, 1, '#6ad88a');
    R(143, 65, 8, 7, '#7a5a34');
    R(143, 65, 8, 2, '#9a7444');
    if (n >= 1) {
      R(144, 63, 3, 2, '#6fcf4a');
      R(148, 63, 2, 2, '#e0503a');
    }
    // 퇴비통
    R(152, 70, 7, 14, '#3a5a6a');
    R(152, 70, 7, 2, '#6a8a9a');
    R(152, 75, 7, 1, '#2a4552');
    R(152, 80, 7, 1, '#2a4552');
    R(153, 68, 5, 2, '#4a6a7a');
    R(154 + Math.round(2 * Math.cos(t * 5)), 64 + Math.round(2 * Math.sin(t * 6)), 1, 1, '#222');
    R(155 + Math.round(2 * Math.sin(t * 4)), 65 + Math.round(2 * Math.cos(t * 7)), 1, 1, '#222');
  }

  /** 생산실 조명: 가동 중이면 연두빛 분위기, 꺼져 있으면 어둡다 */
  private drawProductionLight(ctx: CanvasRenderingContext2D, m: SceneModel): void {
    const on = m.present.some((id) => m.roles[id] === 'work' && !m.sick.includes(id));
    ctx.fillStyle = on ? 'rgba(150,255,170,0.045)' : 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 8, 160, H8 - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 8, 3, H8);
    ctx.fillRect(157, 8, 3, H8);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(3, 8, 3, H8);
    ctx.fillRect(154, 8, 3, H8);
  }

  /** 승강기 통로와 문 (두 층 모두 같은 자리) */
  private drawElevator(ctx: CanvasRenderingContext2D, top: number, floorY: number, endY: number): void {
    ctx.fillStyle = '#1e1a1a';
    ctx.fillRect(160, top, 16, endY - top);
    ctx.fillStyle = '#3a3636';
    ctx.fillRect(167, top, 2, endY - top);
    ctx.fillStyle = '#4a4444';
    for (let y = top + 8; y < floorY; y += 16) ctx.fillRect(160, y, 16, 1);
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(161, floorY + 4, 14, endY - floorY - 6);
    ctx.fillStyle = '#8a8a92';
    ctx.fillRect(161, floorY + 4, 14, 2);
    ctx.fillStyle = '#222';
    ctx.fillRect(167, floorY + 8, 1, endY - floorY - 10);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(166, floorY, 3, 2);
    ctx.fillStyle = '#2b211a';
    ctx.fillRect(176, top, 4, endY - top);
  }

  private drawStore(ctx: CanvasRenderingContext2D, m: SceneModel): void {
    this.drawElevator(ctx, STORE_TOP, FLOOR_Y, SHS);
    // 천장, 벽
    ctx.fillStyle = '#2a2118';
    ctx.fillRect(0, STORE_TOP, 160, 6);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(0, STORE_TOP + 3, 160, 1);
    ctx.fillStyle = '#d6c79c';
    ctx.fillRect(0, STORE_TOP + 6, 160, FLOOR_Y - STORE_TOP - 6);
    ctx.fillStyle = '#c8b88c';
    for (let x = 0; x < 160; x += 10) ctx.fillRect(x, STORE_TOP + 6, 1, 72);
    for (let y = STORE_TOP + 16; y < 110; y += 14) ctx.fillRect(0, y, 160, 1);
    ctx.fillStyle = '#9c7a55';
    ctx.fillRect(0, 112, 160, FLOOR_Y - 112);
    ctx.fillStyle = '#7a5c3c';
    ctx.fillRect(0, 112, 160, 2);
    // 바닥
    for (let y = FLOOR_Y; y < SHS; y += 6) {
      for (let x = 0; x < 160; x += 8) {
        ctx.fillStyle = ((x / 8 + (y - FLOOR_Y) / 6) | 0) % 2 === 0 ? '#7a6a55' : '#6c5d49';
        ctx.fillRect(x, y, 8, 6);
      }
    }
    ctx.fillStyle = '#4a3c2c';
    ctx.fillRect(0, FLOOR_Y, 160, 2);
    ctx.fillStyle = '#2b211a';
    ctx.fillRect(0, SHS - 2, 180, 2);

    // 문
    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(0, 98, 12, 34);
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(0, 100, 10, 32);
    ctx.fillStyle = '#8a8a92';
    ctx.fillRect(0, 100, 10, 2);
    ctx.fillStyle = m.visitor ? '#ffd34d' : '#c8d0a8';
    ctx.fillRect(3, 106, 4, 7);
    ctx.fillStyle = '#e8c04a';
    ctx.fillRect(8, 116, 1, 2);
    // 표지판
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(1, 56, 11, 9);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(1, 56, 11, 1);
    ctx.fillRect(1, 64, 11, 1);
    drawText(ctx, 'B7', 3, 58, '#ffd34d');
    // 네온 OPEN
    const neon = this.flicker < 1 ? '#a04a68' : '#ff7ab0';
    ctx.fillStyle = '#2a1a22';
    ctx.fillRect(134, 55, 22, 9);
    ctx.fillStyle = neon;
    ctx.fillRect(134, 55, 22, 1);
    ctx.fillRect(134, 63, 22, 1);
    ctx.fillRect(134, 55, 1, 9);
    ctx.fillRect(155, 55, 1, 9);
    drawText(ctx, 'OPEN', 138, 57, neon);

    // 전시 선반
    SHELF_X.forEach((sx) => {
      ctx.fillStyle = '#5a3e22';
      ctx.fillRect(sx - 2, SHELF_TOP - 2, 2, TIER_H * 4 + 2);
      ctx.fillRect(sx + 54, SHELF_TOP - 2, 2, TIER_H * 4 + 2);
      ctx.fillStyle = '#5e4429';
      ctx.fillRect(sx, SHELF_TOP, 54, TIER_H * 4 - 1);
      ctx.fillStyle = '#6a4e30';
      for (let t = 0; t < 4; t++) ctx.fillRect(sx, SHELF_TOP + t * TIER_H + 2, 54, TIER_H - 5);
      for (let t = 0; t < 4; t++) {
        ctx.fillStyle = '#a07a4c';
        ctx.fillRect(sx - 2, SHELF_TOP + t * TIER_H + TIER_H - 2, 58, 2);
        ctx.fillStyle = '#5a3e22';
        ctx.fillRect(sx - 2, SHELF_TOP + t * TIER_H + TIER_H, 58, 1);
      }
      // 선반 위 전시 조명
      ctx.fillStyle = '#3a2e22';
      ctx.fillRect(sx - 2, SHELF_TOP - 5, 58, 3);
      ctx.fillStyle = this.flicker < 1 ? '#cfc99a' : '#fff0b0';
      ctx.fillRect(sx + 2, SHELF_TOP - 3, 50, 1);
    });
    let slot = 0;
    for (const id of SHELF_ORDER) {
      const n = m.items[id] ?? 0;
      if (n <= 0) continue;
      const i = slot++;
      if (i >= 48) break;
      const unit = Math.floor(i / 24);
      const rest = i % 24;
      const tier = Math.floor(rest / 6);
      const col = rest % 6;
      const x = SHELF_X[unit] + 1 + col * 9;
      const y = SHELF_TOP + tier * TIER_H + TIER_H - 10;
      if (n >= 4) {
        ctx.globalAlpha = 0.6;
        ctx.drawImage(iconCanvas(id, true), x + 2, y - 2);
        ctx.globalAlpha = 1;
      }
      if (n >= 2) {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(iconCanvas(id, true), x + 1, y - 1);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(iconCanvas(id), x, y);
    }


    // 휴게 코너: 낡은 소파와 협탁, 접이식 침대
    const sofa = (x: number): void => {
      ctx.fillStyle = '#6a3a2a';
      ctx.fillRect(x, 112, 30, 5); // 등받이
      ctx.fillStyle = '#8a4e38';
      ctx.fillRect(x, 112, 30, 1);
      ctx.fillStyle = '#7a4430';
      ctx.fillRect(x - 2, 116, 4, 12); // 팔걸이
      ctx.fillRect(x + 28, 116, 4, 12);
      ctx.fillStyle = '#9a5a40';
      ctx.fillRect(x - 2, 116, 4, 1);
      ctx.fillRect(x + 28, 116, 4, 1);
      ctx.fillStyle = '#a8654a';
      ctx.fillRect(x + 2, 119, 26, 8); // 방석
      ctx.fillStyle = '#c0785a';
      ctx.fillRect(x + 2, 119, 26, 1);
      ctx.fillStyle = '#6a3a2a';
      ctx.fillRect(x + 15, 120, 1, 7);
      ctx.fillStyle = '#d8b84a'; // 담요
      ctx.fillRect(x + 4, 117, 9, 4);
      ctx.fillStyle = '#b8982a';
      ctx.fillRect(x + 4, 120, 9, 1);
      ctx.fillStyle = '#2a1a14';
      ctx.fillRect(x, 127, 2, 3);
      ctx.fillRect(x + 28, 127, 2, 3);
    };
    sofa(18);
    // 협탁: 랜턴과 컵
    ctx.fillStyle = '#6a4a2c';
    ctx.fillRect(56, 120, 11, 2);
    ctx.fillRect(57, 122, 2, 8);
    ctx.fillRect(64, 122, 2, 8);
    ctx.fillStyle = '#c8c0a8';
    ctx.fillRect(59, 117, 3, 3);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(63, 114, 3, 6);
    ctx.fillStyle = '#7a5a2a';
    ctx.fillRect(63, 113, 3, 1);
    ctx.fillStyle = `rgba(255,211,77,${0.10 * this.flicker})`;
    ctx.fillRect(58, 108, 14, 16);
    // 접이식 침대 네 개 (거주 구역 기본 수용 인원)
    const blankets = ['#b8473b', '#4a79a8', '#6f9a4f', '#d19a3a'];
    for (let i = 0; i < 4; i++) {
      const bx = 78 + i * 13;
      ctx.fillStyle = '#4a4a54';
      ctx.fillRect(bx, 126, 1, 4);
      ctx.fillRect(bx + 10, 126, 1, 4);
      ctx.fillStyle = '#6d4c2f';
      ctx.fillRect(bx, 122, 11, 4);
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(bx + 1, 120, 4, 3);
      ctx.fillStyle = blankets[i];
      ctx.fillRect(bx + 4, 121, 7, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(bx + 4, 121, 7, 1);
    }

    // 계산대
    ctx.fillStyle = '#b08858';
    ctx.fillRect(134, 108, 26, 4);
    ctx.fillStyle = '#8a6240';
    ctx.fillRect(135, 112, 24, 18);
    ctx.fillStyle = '#6a4a2c';
    ctx.fillRect(135, 112, 24, 1);
    ctx.fillRect(135, 129, 24, 1);
    ctx.fillStyle = '#555b66';
    ctx.fillRect(139, 99, 11, 9);
    ctx.fillStyle = '#6ad88a';
    ctx.fillRect(140, 100, 9, 3);
    ctx.fillStyle = '#3a3f48';
    ctx.fillRect(141, 104, 7, 2);
  }

  private drawEntities(ctx: CanvasRenderingContext2D, m: SceneModel, floor: View): void {
    type E = { y: number; draw: () => void };
    const list: E[] = [];
    /** 일하는 도구는 옆 사람 몸에 가리지 않게 맨 위에 덧그린다 */
    const tools: (() => void)[] = [];
    for (const w of this.walkers.values()) {
      const d = SURV_BY_ID[w.id];
      if (!d || w.floor !== floor) continue;
      const frame = w.moving ? Math.floor(this.t * 6 + w.seed) : Math.floor(this.t * 1.5 + w.seed);
      list.push({
        y: w.lane,
        draw: () => {
          if (d.look.cat) drawCat(ctx, w.x, w.lane, this.t * 1000, w.dir, w.moving);
          else {
            const working = w.post?.kind === 'work' && !w.moving;
            const bob = working && Math.floor(this.t * 3 + w.seed) % 2 === 0 ? 1 : 0;
            drawPerson(ctx, d.look, w.x, w.lane + bob, { frame, moving: w.moving, dir: w.dir });
            const px = Math.round(w.x);
            const fx = w.dir > 0 ? 1 : -1;
            if (w.post?.kind === 'guard' && !w.moving) {
              // 소총을 들고 문 쪽을 노려본다. 습격 중에는 총구를 치켜든다.
              const up = m.alert ? 5 : 0;
              ctx.fillStyle = '#2b2b30';
              ctx.fillRect(px + fx * 6 - (fx < 0 ? 11 : 0), w.lane - 12 - up, 12, 2);
              ctx.fillStyle = '#6a4a2a';
              ctx.fillRect(px + fx * 6 - (fx < 0 ? 3 : 0), w.lane - 12 - up, 4, 3);
              if (m.alert && Math.floor(this.t * 4) % 2 === 0) {
                ctx.fillStyle = '#ff5a4a';
                ctx.fillRect(px - 1, w.lane - personHeight(d.look) - 5, 3, 3);
              }
            } else if (working) {
              const sw = Math.floor(this.t * 3 + w.seed) % 2;
              const hx = px + fx * 9;
              tools.push(() => {
              if (w.post?.face === 1) {
                // 물뿌리개: 기울이면 물이 쏟아진다
                const bx = hx - (fx < 0 ? 5 : 0);
                ctx.fillStyle = '#4a8ac8';
                ctx.fillRect(bx, w.lane - 12, 6, 4);
                ctx.fillStyle = '#7ab4e8';
                ctx.fillRect(bx, w.lane - 12, 6, 1);
                ctx.fillStyle = '#2f5a8a';
                ctx.fillRect(bx, w.lane - 9, 6, 1);
                const sx = fx > 0 ? bx + 6 : bx - 4;
                ctx.fillStyle = '#4a8ac8';
                ctx.fillRect(sx, w.lane - 13 - (sw ? 1 : 0), 4, 1);
                ctx.fillStyle = '#9ad4ff';
                const ex = fx > 0 ? sx + 4 : sx - 1;
                for (let k = 0; k < 3; k++) ctx.fillRect(ex, w.lane - 12 + ((Math.floor(this.t * 9) + k * 2) % 7), 1, 2);
              } else {
                // 호미질
                ctx.fillStyle = '#8a6d4b';
                ctx.fillRect(hx - (fx < 0 ? 1 : 0), w.lane - 20 + sw * 3, 1, 13);
                ctx.fillStyle = '#b8b8c0';
                ctx.fillRect(hx - (fx < 0 ? 4 : 0), w.lane - 8 + sw * 3, 4, 2);
                ctx.fillStyle = '#e8e8f0';
                ctx.fillRect(hx - (fx < 0 ? 4 : 0), w.lane - 8 + sw * 3, 4, 1);
              }
              });
            }
            if (m.sick.includes(w.id) && Math.floor(this.t * 2) % 2 === 0) {
              ctx.fillStyle = '#7fd05a';
              ctx.fillRect(px - 1, w.lane - personHeight(d.look) - 5, 3, 3);
            }
          }
        },
      });
    }
    for (let i = 0; i < m.bags && floor === 'b7'; i++) {
      const bx = 30 + i * 13;
      const bounce = Math.floor(Math.abs(Math.sin(this.t * 4 + i)) * 3);
      list.push({ y: 152, draw: () => drawBag(ctx, bx, 150 - bounce) });
    }
    if (m.visitor && floor === 'b7') {
      const d = SURV_BY_ID[m.visitor];
      list.push({
        y: 148,
        draw: () => {
          if (d?.look.cat) drawCat(ctx, 22, 148, this.t * 1000, 1, false, true);
          else if (d) drawPerson(ctx, d.look, 22, 148, { frame: Math.floor(this.t * 1.5), moving: false, dir: 1, silhouette: true });
          const blink = Math.floor(this.t * 3) % 2 === 0;
          ctx.fillStyle = '#f4efe4';
          ctx.fillRect(30, 106 + (blink ? 0 : 1), 9, 10);
          ctx.fillStyle = '#2b1d14';
          ctx.fillRect(34, 108 + (blink ? 0 : 1), 1, 4);
          ctx.fillRect(34, 113 + (blink ? 0 : 1), 1, 1);
        },
      });
    }
    list.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
    tools.forEach((f) => f());
  }

  private drawLight(ctx: CanvasRenderingContext2D): void {
    // 형광등
    for (const lx of [24, 76, 124]) {
      ctx.fillStyle = this.flicker < 1 ? '#cfc99a' : '#fff6c8';
      ctx.fillRect(lx, STORE_TOP + 7, 24, 2);
      const a = 0.05 * this.flicker;
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(255,236,160,${a})`;
        ctx.fillRect(lx - 2 - i * 3, STORE_TOP + 10 + i * 12, 28 + i * 6, 12);
      }
    }
    // 따뜻한 분위기와 가장자리 어둠
    ctx.fillStyle = `rgba(255,170,60,${0.06 * this.flicker})`;
    ctx.fillRect(0, STORE_TOP + 6, 160, SHS - STORE_TOP - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, STORE_TOP + 6, 3, SHS);
    ctx.fillRect(157, STORE_TOP + 6, 3, SHS);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(3, STORE_TOP + 6, 3, SHS);
    ctx.fillRect(154, STORE_TOP + 6, 3, SHS);
  }

  private drawParticles(ctx: CanvasRenderingContext2D, floor: View): void {
    for (const p of this.particles) {
      if (p.view !== floor) continue;
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      if (p.kind === 'heart') {
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        ctx.fillRect(x, y, 2, 1);
        ctx.fillRect(x + 3, y, 2, 1);
        ctx.fillRect(x, y + 1, 5, 1);
        ctx.fillRect(x + 1, y + 2, 3, 1);
        ctx.fillRect(x + 2, y + 3, 1, 1);
      } else if (p.kind === 'plus') {
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        ctx.fillRect(x + 1, y, 1, 3);
        ctx.fillRect(x, y + 1, 3, 1);
      } else {
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
}
