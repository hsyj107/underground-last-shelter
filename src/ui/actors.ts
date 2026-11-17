import { FACILITY_DEFS } from '../sim/data';
import { atBunker, facilityState } from '../sim/engine';
import type { FacilityId, Game, Survivor } from '../sim/types';

/**
 * 쉘터 단면 안에서 움직이는 생존자들.
 * 움직임은 화면 연출일 뿐이라 시뮬(sim/)에는 아무 영향이 없다.
 * - 배치된 시설에서는 일하는 동작, 숙소에서는 쉬거나 밤에 잠
 * - 가끔 사다리를 타고 다른 층을 다녀옴
 * - 담당 시설을 바꾸면 사다리로 새 방까지 걸어감
 */

type Step = { k: 'walk'; x: number } | { k: 'climb'; room: FacilityId } | { k: 'stay' };

interface Actor {
  room: FacilityId;
  /** 방 안 가로 위치(%) */
  x: number;
  home: FacilityId;
  route: Step[];
}

export const SHAFT_X = 5;
const actors = new Map<string, Actor>();

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const hash = (id: string): number => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const spot = (): number => 14 + Math.random() * 72;

/** 배치된 시설이 열려 있으면 거기, 아니면 숙소 */
export function homeOf(g: Game, s: Survivor): FacilityId {
  return s.post && g.facilities[s.post] > 0 ? s.post : 'dormitory';
}

const FX: Record<FacilityId, string> = {
  power_plant: '⚡', water_purifier: '💧', farm: '♣', dormitory: 'z', medical: '+', workshop: '⚙', laboratory: '○', armory: '■',
};

function commute(from: Actor, target: FacilityId): Step[] {
  if (from.room === target) return [{ k: 'walk', x: spot() }];
  return [{ k: 'walk', x: SHAFT_X }, { k: 'climb', room: target }, { k: 'walk', x: spot() }];
}

/** 화면을 그리기 전에 게임 상태와 맞춘다 (새 인원 추가, 떠난 인원 제거, 담당 변경) */
export function syncActors(g: Game): void {
  const here = atBunker(g);
  const ids = new Set(here.map((s) => s.id));
  for (const id of [...actors.keys()]) if (!ids.has(id)) actors.delete(id);
  for (const s of here) {
    const home = homeOf(g, s);
    const a = actors.get(s.id);
    if (!a) {
      actors.set(s.id, { room: home, x: 14 + (hash(s.id) % 72), home, route: [] });
      continue;
    }
    if (g.facilities[a.room] <= 0) {
      a.room = home;
      a.route = [];
    }
    if (a.home !== home) {
      a.home = home;
      a.route = commute(a, home);
    }
  }
}

/** 한 번의 걸음을 정한다 */
function nextStep(g: Game, s: Survivor, a: Actor, night: boolean): Step {
  const queued = a.route.shift();
  if (queued) return queued;
  if (s.status === 'critical') return { k: 'stay' };
  // 가끔 다른 층을 다녀온다. 밤에는 숙소로 향하는 사람이 많다.
  if (Math.random() < 0.09) {
    const open = FACILITY_DEFS.filter((d) => g.facilities[d.id] > 0 && d.id !== a.room).map((d) => d.id);
    if (open.length > 0) {
      const target: FacilityId = night && open.includes('dormitory') && Math.random() < 0.7 ? 'dormitory' : open[Math.floor(Math.random() * open.length)];
      a.route = [...commute(a, target), { k: 'stay' }, { k: 'stay' }, ...commute({ ...a, room: target }, a.home)];
      return a.route.shift() ?? { k: 'stay' };
    }
  }
  if (Math.random() < 0.4) return { k: 'stay' };
  const working = a.room === a.home && s.post !== null;
  return { k: 'walk', x: working ? clamp(a.x + (Math.random() - 0.5) * 24, 10, 90) : spot() };
}

function place(root: HTMLElement, el: HTMLElement, a: Actor, rh: number): void {
  const room = root.querySelector<HTMLElement>(`.room[data-arg="${a.room}"]`);
  el.style.left = `${a.x}%`;
  if (room) el.style.top = `${room.offsetTop + room.offsetHeight * 0.92}px`;
  el.style.height = `${rh * 0.4}px`;
}

function stateClass(g: Game, s: Survivor, a: Actor, moved: Step['k'] | null, night: boolean): string {
  if (moved === 'climb') return 'climb';
  if (moved === 'walk') return 'walk';
  if (s.status === 'critical') return 'down';
  const atPost = a.room === a.home && s.post !== null && facilityState(g, s.post) === 'active';
  if (atPost) return 'work';
  if (a.room === 'dormitory' && night && s.status !== 'away') return 'sleep';
  return 'rest';
}

function apply(el: HTMLElement, g: Game, s: Survivor, a: Actor, moved: Step['k'] | null, night: boolean): void {
  el.classList.remove('walk', 'climb', 'work', 'sleep', 'rest', 'down');
  el.classList.add(stateClass(g, s, a, moved, night));
  const fx = el.querySelector('.fx');
  if (fx) fx.textContent = FX[a.room === a.home ? a.home : a.room];
}

/** 화면을 새로 그린 직후: 모든 인원을 저장된 위치에 애니메이션 없이 놓는다 */
export function layoutActors(root: HTMLElement, g: Game, night: boolean): void {
  const first = root.querySelector<HTMLElement>('.room:not(.locked)');
  if (!first) return;
  const rh = first.offsetHeight;
  root.querySelectorAll<HTMLElement>('.sv').forEach((el) => {
    const s = g.survivors.find((x) => x.id === el.dataset.arg);
    const a = s ? actors.get(s.id) : undefined;
    if (!s || !a) return;
    el.classList.add('noanim');
    place(root, el, a, rh);
    apply(el, g, s, a, null, night);
  });
  void root.offsetWidth;
  root.querySelectorAll<HTMLElement>('.sv.noanim').forEach((el) => el.classList.remove('noanim'));
}

/** 2~3초마다: 각자 한 걸음씩 움직인다 */
export function tickActors(root: HTMLElement, g: Game, night: boolean): void {
  const first = root.querySelector<HTMLElement>('.room:not(.locked)');
  if (!first) return;
  const rh = first.offsetHeight;
  root.querySelectorAll<HTMLElement>('.sv').forEach((el) => {
    const s = g.survivors.find((x) => x.id === el.dataset.arg);
    const a = s ? actors.get(s.id) : undefined;
    if (!s || !a) return;
    const step = nextStep(g, s, a, night);
    let moved: Step['k'] | null = null;
    if (step.k === 'walk') {
      el.dataset.d = step.x >= a.x ? '1' : '-1';
      a.x = step.x;
      moved = 'walk';
    } else if (step.k === 'climb') {
      a.room = step.room;
      moved = 'climb';
    }
    place(root, el, a, rh);
    apply(el, g, s, a, moved, night);
  });
}
