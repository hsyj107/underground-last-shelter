// 지상 + 지하 7층 편의점 단면을 그리는 캔버스 장면.
import { SHELF_ORDER, SURV_BY_ID } from './data.ts';
import { drawBag, drawCat, drawPerson, drawText, drawZombie, iconCanvas, personHeight } from './sprites.ts';

export const SW = 180;
/** 매장(지하 7층) 장면 안쪽 높이 */
const SHS = 168;
/** 지상과 지하 7층 사이, 지하 1~6층을 지나가는 구간 높이 */
const DEPTH = 42;
export const SH = SHS + DEPTH;

const GROUND_Y = 40; // 지표면
const STORE_TOP = 46;
const FLOOR_Y = 130;
const SHELF_X = [14, 76];
const SHELF_TOP = 58;
const TIER_H = 17;
const WALK_MIN = 18;
const WALK_MAX = 150;

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
}

export interface SceneHandlers {
  onSurvivor(id: string, lx: number, ly: number): void;
  onVisitor(): void;
  onBag(): void;
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
  cssPos(x: number, y: number): { left: number; top: number } {
    const r = this.canvas.getBoundingClientRect();
    return { left: (x / SW) * r.width, top: ((y + DEPTH) / SH) * r.height };
  }

  burst(x: number, y: number, kind: 'heart' | 'spark', n = 5): void {
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
      });
    }
  }

  private onPointer(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const lx = ((e.clientX - r.left) / r.width) * SW;
    const ly = ((e.clientY - r.top) / r.height) * SH - DEPTH;
    const m = this.getModel();
    for (let i = 0; i < m.bags; i++) {
      const bx = 30 + i * 13;
      if (lx >= bx - 2 && lx <= bx + 12 && ly >= 148 && ly <= 168) {
        this.handlers.onBag();
        return;
      }
    }
    if (m.visitor && lx >= 8 && lx <= 36 && ly >= 108 && ly <= 152) {
      this.handlers.onVisitor();
      return;
    }
    const list = [...this.walkers.values()].sort((a, b) => b.lane - a.lane);
    for (const w of list) {
      const sl = SURV_BY_ID[w.id]?.look;
      const h = sl?.cat ? 10 : sl ? personHeight(sl) : 20;
      if (Math.abs(lx - w.x) <= 9 && ly >= w.lane - h && ly <= w.lane + 2) {
        this.handlers.onSurvivor(w.id, w.x, w.lane - h);
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
          lane: 142 + (idx % 5) * 5,
          tx: 60 + this.rand() * 80,
          dir: -1,
          pause: 0,
          speed: 12 + this.rand() * 6,
          moving: true,
          seed: idx,
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
      w.post = gi >= 0 ? { x: 30 + gi * 15, face: -1, kind: 'guard' } : wi >= 0 ? { x: [106, 121, 136, 92][wi % 4], face: wi % 2 ? 1 : -1, kind: 'work' } : null;
    }
    // 일하는 곳에서 생산하는 느낌: 잎사귀와 물방울
    this.workT -= dt;
    if (this.workT <= 0 && workers.length) {
      this.workT = 0.9 / Math.min(3, workers.length);
      const farm = this.rand() < 0.6;
      this.particles.push({
        x: farm ? 104 + this.rand() * 34 : 148 + this.rand() * 6,
        y: farm ? 138 : 148,
        vx: (this.rand() - 0.5) * 6,
        vy: -8 - this.rand() * 6,
        life: 0,
        max: 0.8,
        kind: farm ? 'plus' : 'spark',
        color: farm ? '#8ee06a' : '#6ec6ff',
      });
    }
    for (const w of this.walkers.values()) {
      if (w.post) {
        // 일꾼은 밭 뒤쪽 줄로 올라선다
        if (w.post.kind === 'work') w.lane += Math.max(-30 * dt, Math.min(30 * dt, 149 - w.lane));
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
    this.drawSurface(ctx, m.hour);
    this.drawDepth(ctx);
    // 매장은 지하 7층: 지상과 지하 1~6층 구간 아래에 그린다
    ctx.save();
    ctx.translate(0, DEPTH);
    this.drawStore(ctx, m);
    this.drawEntities(ctx, m);
    this.drawLight(ctx);
    this.drawParticles(ctx);
    ctx.restore();
  }

  /** 지상에서 지하 7층까지 내려가는 동안 지나치는 지하 1~6층 (버려진 층과 승강기) */
  private drawDepth(ctx: CanvasRenderingContext2D): void {
    const y0 = STORE_TOP;
    const R = (x: number, y: number, w: number, h: number, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    const FL = DEPTH / 6;
    R(0, y0, 160, DEPTH, '#1d1915');
    for (let i = 0; i < 6; i++) {
      const fy = y0 + i * FL;
      R(0, fy, 160, 1, '#2d261f');
      R(0, fy + FL - 1, 160, 1, '#0d0a08');
      // 버려진 층: 희미한 창과 무너진 틈
      for (let k = 0; k < 3; k++) R(26 + k * 44 + ((i * 13) % 9), fy + 2, 7, 2, i === 2 && k === 1 ? '#6a2a22' : '#2e2619');
      R(((i * 37) % 120) + 20, fy + FL - 2, 5, 1, '#33291f');
      drawText(ctx, `B${i + 1}`, 3, fy + 1, '#9a8660');
    }
    // 비상등이 깜박이는 층
    if (Math.floor(this.t * 1.5) % 2 === 0) R(150, y0 + 2 * FL + 1, 2, 2, '#e04a3a');
    // 승강기 통로가 층을 관통해 내려간다
    R(160, y0, 16, DEPTH, '#1e1a1a');
    R(167, y0, 2, DEPTH, '#3a3636');
    for (let i = 0; i < 6; i++) {
      const fy = y0 + i * FL;
      R(160, fy, 16, 1, '#4a4444');
      R(162, fy + 1, 4, 3, '#2a2626');
      R(170, fy + 1, 4, 3, '#2a2626');
    }
    const cy = y0 + ((this.t * 4) % (DEPTH - 6));
    R(162, Math.floor(cy), 12, 6, '#6a6a72');
    R(162, Math.floor(cy), 12, 1, '#8a8a92');
    R(167, Math.floor(cy) + 1, 1, 5, '#222');
    R(163, Math.floor(cy) + 2, 3, 2, '#ffd34d');
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

  /** 생산조가 있을 때만 보이는 수경재배 밭, 정수 탱크, 수확 상자 */
  private drawStations(ctx: CanvasRenderingContext2D, m: SceneModel): void {
    this.stationsBack(ctx, m);
  }

  /** 사람 위에 덧그리는 밭 앞면: 일꾼이 밭 뒤에서 일하는 것처럼 보이게 한다 */
  private drawStationsFront(ctx: CanvasRenderingContext2D, m: SceneModel): void {
    const n = m.present.filter((id) => m.roles[id] === 'work').length;
    if (!n) return;
    const R = (x: number, y: number, w: number, h: number, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    R(100, 146, 42, 1, '#a8a8b6');
    R(100, 147, 42, 4, '#585866');
    R(100, 147, 42, 1, '#74748a');
    R(100, 151, 42, 2, '#2b2b34');
    R(100, 147, 1, 6, '#74748a');
    R(141, 147, 1, 6, '#3a3a46');
    const plants = Math.min(9, 4 + n * 2);
    for (let i = 0; i < plants; i += 2) {
      const px = 104 + i * 4;
      R(px - 1, 144, 3, 2, '#58b83c');
      R(px, 143, 2, 1, '#8ee06a');
    }
  }

  private stationsBack(ctx: CanvasRenderingContext2D, m: SceneModel): void {
    const n = m.present.filter((id) => m.roles[id] === 'work').length;
    if (!n) return;
    const t = this.t;
    const R = (x: number, y: number, w: number, h: number, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    const pulse = 0.85 + 0.15 * Math.sin(t * 3);

    // --- 재배등 빛 번짐 (위층과 아래층 모두 분홍빛이 퍼진다)
    const cone = (y0: number, y1: number): void => {
      for (let y = y0; y < y1; y++) {
        const spread = Math.floor((y - y0) * 0.3);
        ctx.fillStyle = `rgba(255,130,255,${(0.09 + (y - y0) * 0.004) * pulse})`;
        ctx.fillRect(102 - spread, y, 38 + spread * 2, 1);
      }
    };
    cone(97, 111);
    cone(121, 143);
    // --- 선반 틀: 2단 수경재배
    R(100, 94, 2, 59, '#2f2f38');
    R(100, 94, 1, 59, '#50505c');
    R(140, 94, 2, 59, '#2f2f38');
    R(140, 94, 1, 59, '#50505c');
    for (const ly of [94, 118]) {
      R(98, ly, 46, 3, '#3a3a46');
      R(98, ly, 46, 1, '#5a5a68');
      R(100, ly + 3, 42, 1, pulse > 0.95 ? '#ffd0ff' : '#ff9aff');
    }
    // 위층 트레이
    R(100, 113, 42, 1, '#70707e');
    R(100, 114, 42, 3, '#585866');
    R(100, 117, 42, 1, '#2b2b34');
    R(101, 111, 40, 2, '#4a3322');
    // 아래층 흙 (앞면은 사람 위에 따로 덧그린다)
    R(100, 141, 42, 1, '#70707e');
    R(101, 142, 40, 4, '#4a3322');
    for (let i = 0; i < 18; i++) R(103 + ((i * 7) % 36), 142 + (i % 4), 1, 1, '#33241a');
    // --- 작물: 시간이 지나면 자라고 다 크면 열매가 열린다
    const plants = Math.min(9, 4 + n * 2);
    const row = (root: number, phase: number, maxH: number): void => {
      for (let i = 0; i < plants; i++) {
        const px = 104 + i * 4;
        const stage = (Math.floor(t * 0.45) + i * 2 + phase) % 8;
        const h = Math.min(maxH, 3 + stage);
        const sway = Math.floor(t * 1.5 + i) % 4 === 0 ? 1 : 0;
        R(px, root - h, 1, h, '#3f8a34');
        if (h >= 5) {
          R(px - 2 + sway, root - h + 2, 2, 2, '#6fcf4a');
          R(px + 1 + sway, root - h + 4, 2, 2, '#58b83c');
        }
        if (h >= 8) {
          R(px - 1 + sway, root - h, 3, 2, '#8ee06a');
          if (i % 3 === 0) {
            R(px + 1, root - h + 5, 2, 2, '#e0503a');
            R(px + 1, root - h + 5, 1, 1, '#ff9a8a');
          }
        }
      }
    };
    row(111, 3, 10);
    row(145, 0, 11);
    // --- 수확 상자 (일하는 사람이 많을수록 가득 찬다)
    R(84, 142, 14, 10, '#7a5a34');
    R(84, 142, 14, 2, '#9a7444');
    R(84, 148, 14, 1, '#5a4024');
    R(84, 142, 1, 10, '#5a4024');
    R(97, 142, 1, 10, '#5a4024');
    const filled = Math.min(5, 2 + n);
    for (let i = 0; i < filled; i++) {
      R(85 + i * 2 + (i % 2), 140 - (i % 2), 3, 3, i % 3 === 0 ? '#e0503a' : '#6fcf4a');
      R(85 + i * 2 + (i % 2), 140 - (i % 2), 1, 1, '#c8f0a0');
    }

    // --- 정수 탱크
    R(145, 124, 13, 3, '#2f3a46');
    R(145, 127, 13, 25, '#5a6a7a');
    R(145, 127, 2, 25, '#8aa0b4');
    R(156, 127, 2, 25, '#3a4654');
    R(145, 135, 13, 1, '#3a4654');
    R(145, 144, 13, 1, '#3a4654');
    R(148, 129, 7, 8, '#223040');
    const lvl = 2 + Math.floor(3 + 2 * Math.sin(t * 1.2));
    R(148, 137 - lvl, 7, lvl, '#6ec6ff');
    R(148, 137 - lvl, 7, 1, '#bfe8ff');
    R(148, 129, 1, 8, '#3f4f60');
    for (let b = 0; b < 2; b++) {
      const by = 136 - ((Math.floor(t * 6) + b * 3) % Math.max(2, lvl));
      R(150 + b * 3, by, 1, 1, '#ffffff');
    }
    R(150, 125, 3, 1, Math.floor(t * 2) % 2 === 0 ? '#6aff8a' : '#2a6a3a');
    // 배관과 수도꼭지, 물받이 통
    R(142, 148, 4, 2, '#7a8a9a');
    R(148, 150, 5, 2, '#7a8a9a');
    R(150, 152, 2, 2, '#7a8a9a');
    const drip = Math.floor(t * 3) % 3;
    R(151, 154 + drip, 1, 2, '#6ec6ff');
    R(147, 157, 8, 5, '#6a6a74');
    R(147, 157, 8, 1, '#8a8a96');
    R(148, 158, 6, 1, '#6ec6ff');
    R(147, 161, 8, 1, '#3a3a44');
  }

  private drawStore(ctx: CanvasRenderingContext2D, m: SceneModel): void {
    // 승강기 통로
    ctx.fillStyle = '#1e1a1a';
    ctx.fillRect(160, STORE_TOP, 16, SHS - STORE_TOP);
    ctx.fillStyle = '#3a3636';
    ctx.fillRect(167, STORE_TOP, 2, SHS - STORE_TOP);
    ctx.fillStyle = '#4a4444';
    for (let y = STORE_TOP + 8; y < FLOOR_Y; y += 16) ctx.fillRect(160, y, 16, 1);
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(161, 134, 14, 28);
    ctx.fillStyle = '#8a8a92';
    ctx.fillRect(161, 134, 14, 2);
    ctx.fillStyle = '#222';
    ctx.fillRect(167, 138, 1, 24);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(166, 130, 3, 2);
    ctx.fillStyle = '#2b211a';
    ctx.fillRect(176, STORE_TOP, 4, SHS - STORE_TOP);
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

    // 선반
    SHELF_X.forEach((sx) => {
      ctx.fillStyle = '#5a3e22';
      ctx.fillRect(sx - 2, SHELF_TOP - 2, 2, TIER_H * 4 + 2);
      ctx.fillRect(sx + 54, SHELF_TOP - 2, 2, TIER_H * 4 + 2);
      ctx.fillStyle = '#5e4429';
      ctx.fillRect(sx, SHELF_TOP, 54, TIER_H * 4 - 1);
      ctx.fillStyle = '#6a4e30';
      for (let t = 0; t < 4; t++) ctx.fillRect(sx, SHELF_TOP + t * TIER_H + 2, 54, 12);
      for (let t = 0; t < 4; t++) {
        ctx.fillStyle = '#a07a4c';
        ctx.fillRect(sx - 2, SHELF_TOP + t * TIER_H + 15, 58, 2);
        ctx.fillStyle = '#5a3e22';
        ctx.fillRect(sx - 2, SHELF_TOP + t * TIER_H + 17, 58, 1);
      }
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
      const y = SHELF_TOP + tier * TIER_H + 7;
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

  private drawEntities(ctx: CanvasRenderingContext2D, m: SceneModel): void {
    type E = { y: number; draw: () => void };
    const list: E[] = [];
    /** 일하는 도구는 옆 사람 몸에 가리지 않게 맨 위에 덧그린다 */
    const tools: (() => void)[] = [];
    for (const w of this.walkers.values()) {
      const d = SURV_BY_ID[w.id];
      if (!d) continue;
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
    for (let i = 0; i < m.bags; i++) {
      const bx = 30 + i * 13;
      const bounce = Math.floor(Math.abs(Math.sin(this.t * 4 + i)) * 3);
      list.push({ y: 160, draw: () => drawBag(ctx, bx, 152 - bounce) });
    }
    if (m.visitor) {
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
    this.drawStations(ctx, m);
    list.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
    tools.forEach((f) => f());
    this.drawStationsFront(ctx, m);
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

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
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
