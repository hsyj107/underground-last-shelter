// 벙커 단면도: 지금까지 판 층과 침대, 다음에 파 내려갈 층을 도트로 그린다.
import { FLOORS } from './data.ts';

const W = 120;
const TOP = 18; // 지상
const ROW = 22; // 한 층 높이

const cache = new Map<string, string>();

function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** floor: 지금 열린 마지막 층 (0부터) · used: 침대를 쓰는 사람 수 · sick: 앓는 사람 수 */
export function cutawayURL(floor: number, used: number, sick = 0): string {
  const key = `${floor}|${used}|${sick}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const H = TOP + FLOORS.length * ROW;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const rect = (x: number, y: number, w: number, h: number, col: string): void => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  // 땅
  rect(0, 0, W, H, '#1c1511');
  // 지상: 밤하늘 · 거리 · 매장 지붕
  rect(0, 0, W, TOP - 4, '#1a2233');
  for (let i = 0; i < 14; i++) rect(Math.floor(hash(i) * W), Math.floor(hash(i + 50) * 8), 1, 1, '#c9d3e6');
  rect(0, TOP - 4, W, 4, '#3a3226');
  rect(30, 4, 36, TOP - 8, '#2b2420');
  rect(34, 8, 4, 3, '#f1c75b');
  rect(44, 8, 4, 3, '#f1c75b');
  rect(54, 8, 4, 3, '#4a3a2c');
  rect(82, TOP - 9, 2, 5, '#4f7a42');
  rect(100, TOP - 9, 2, 5, '#4f7a42');
  rect(81, TOP - 11, 4, 2, '#7ea06b');
  rect(99, TOP - 11, 4, 2, '#7ea06b');

  let seat = 0;
  let prevCap = 0;
  FLOORS.forEach((f, i) => {
    const y = TOP + i * ROW;
    if (i <= floor) {
      // 열린 층: 벽 · 바닥 · 전등
      rect(0, y, W, ROW, '#4d3a2b');
      rect(0, y, W, 2, '#35271c');
      rect(0, y + ROW - 3, W, 3, '#2a1f17');
      for (let x = 14; x < W; x += 26) {
        rect(x, y + 3, 6, 1, '#f1c75b');
        rect(x - 3, y + 4, 12, 2, 'rgba(241,199,91,0.15)');
      }
      // 승강기 통로
      rect(4, y, 9, ROW, '#2d2e34');
      rect(8, y, 1, ROW, '#4a4c55');
      // 침대
      const n = f.cap - prevCap;
      const beds = Math.min(n, 9);
      for (let b = 0; b < beds; b++) {
        const bx = 17 + b * 11;
        const by = y + ROW - 10;
        const taken = seat < used;
        seat++;
        rect(bx, by + 3, 9, 4, '#6d4c2f');
        rect(bx, by + 7, 1, 2, '#2a1f17');
        rect(bx + 8, by + 7, 1, 2, '#2a1f17');
        rect(bx + 1, by + 1, 3, 3, taken ? '#f1d0b0' : '#8d8478');
        rect(bx + 4, by + 2, 5, 3, taken ? ['#b8473b', '#4a79a8', '#6f9a4f', '#d19a3a'][b % 4] : '#a69c8d');
      }
      prevCap = f.cap;
      if (i === floor && sick > 0) rect(W - 12, y + 6, 8, 8, '#6f9a4f');
    } else if (i === floor + 1) {
      // 다음에 파 내려갈 층: 갓 판 흙 · 곡괭이 자국 · 어둠
      rect(0, y, W, ROW, '#2a1f17');
      for (let k = 0; k < 40; k++) rect(Math.floor(hash(k + i * 77) * W), y + 2 + Math.floor(hash(k + 9) * (ROW - 4)), 2, 1, '#4a3829');
      rect(4, y, 9, ROW, '#2d2e34');
      rect(8, y, 1, 5, '#4a4c55');
      rect(40, y + 8, 6, 2, '#6b6055');
      rect(43, y + 4, 2, 10, '#8a6d4b');
      rect(38, y + 4, 8, 2, '#b8b0a0');
    } else {
      rect(0, y, W, ROW, '#1c1511');
      for (let k = 0; k < 30; k++) rect(Math.floor(hash(k + i * 31) * W), y + Math.floor(hash(k + 5) * ROW), 1, 1, '#2d2218');
    }
    // 층 구분선
    rect(0, y + ROW - 1, W, 1, '#0d0907');
  });
  const u = c.toDataURL();
  cache.set(key, u);
  return u;
}
