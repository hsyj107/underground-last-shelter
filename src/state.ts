// 게임 규칙. 화면과 무관하게 동작하므로 node 로 그대로 테스트할 수 있다.
import {
  CAT_NAMES,
  CHAPTER_AFF,
  DARK_HAIRS,
  GIVEN,
  ITEMS,
  JOB_BY_ID,
  ITEM_BY_ID,
  KID_NAMES,
  OLD_GIVEN,
  ORIGIN_BY_ID,
  PROD,
  PROFS,
  FLOORS,
  PROF_BY_ID,
  RARITY,
  SKINS,
  SURNAMES,
  SURV_BY_ID,
  UPGRADES,
  ZONES,
  ZONE_BY_ID,
  registerPerson,
  registerPlayer,
  resetRegistry,
} from './data.ts';
import type { Cat, Gender, Look, Person, PlayerInfo, ProfDef, ResKey, Stats, SurvDef, Unlock, UpgKey, ZoneDef } from './data.ts';
import { PLAYER } from './data.ts';

export const config = { speed: 1 };
/** 물자가 바닥난 채로 이 시간이 지나면 위기가 터진다 */
const CRISIS_MS = 6 * 3600 * 1000;
let rng: () => number = Math.random;
export function setRng(f: () => number): void {
  rng = f;
}

export interface ExpResult {
  items: string[];
  caps: number;
  caught: boolean;
  line: string;
  /** 가져오는 생존 물자 */
  supplies: Record<ResKey, number>;
  /** 출발할 때 이미 정해진 죽음. 돌아와서 가방을 열 때 알게 된다. */
  deaths: { id: string; last: string }[];
}

/** 추모비에 남는 기록 */
export interface Grave {
  id: string;
  day: number;
  zone: string;
  last: string;
}

export interface Expedition {
  id: string;
  zone: string;
  members: string[];
  start: number;
  end: number;
  result: ExpResult;
  notified: boolean;
}

export type Ration = 'normal' | 'reduced' | 'starve';
export const RATIONS: Record<Ration, { name: string; icon: string; eat: number; death: number; talk: number; text: string }> = {
  normal: { name: '정상 배급', icon: '🍚', eat: 1, death: 1, talk: 1, text: '모두가 제대로 먹는다.' },
  reduced: { name: '절식', icon: '🥣', eat: 0.6, death: 1.25, talk: 0.5, text: '소비 -40%. 탐사 사망 확률 +25%, 대화로 얻는 호감 절반.' },
  starve: { name: '극한 절식', icon: '🫗', eat: 0.3, death: 1.6, talk: 0, text: '소비 -70%. 탐사 사망 확률 +60%, 대화로 호감을 얻을 수 없다.' },
};

export interface State {
  v: 2;
  player: PlayerInfo;
  /** 두 사람 사이의 관계. 키는 정렬한 id 두 개를 | 로 이은 것. 없으면 그냥 아는 사이 */
  rel: Record<string, 'friend' | 'rival'>;
  /** 지금까지 만난 모든 사람(죽은 사람 포함) */
  people: Record<string, Person>;
  dead: Grave[];
  nextPid: number;
  name: string;
  created: number;
  last: number;
  caps: number;
  /** 벙커 비축 물자 */
  res: Record<ResKey, number>;
  ration: Ration;
  /** 식량이나 식수가 바닥난 채로 흐른 시간(ms) */
  shortMs: number;
  /** 굶주림 위기를 결정해야 하는 상태 */
  crisis: boolean;
  /** 보유 개수 */
  items: Record<string, number>;
  /** 처음 발견한 시각 (도감) */
  found: Record<string, number>;
  crew: string[];
  aff: Record<string, number>;
  talkAt: Record<string, number>;
  tapAt: Record<string, number>;
  tired: Record<string, number>;
  upg: Record<UpgKey, number>;
  /** 열린 거주 구역(층) 수 - 1. FLOORS 의 인덱스 */
  floor: number;
  exps: Expedition[];
  zoneClears: Record<string, number>;
  visitor: string | null;
  nextVisit: number;
  nextExpId: number;
  stats: { expeditions: number; totalCaps: number; caught: number };
}

export type GameEvent =
  | { type: 'visitor'; id: string }
  | { type: 'crisis' }
  | { type: 'exp_done'; id: string; zone: string };

const ms = (n: number): number => Math.round(n / config.speed);

export interface Creation {
  gender: Gender;
  origin: string;
  job: string;
  look: Look;
  stats: Stats;
}

/** 출신 보정을 더한 직업 범위 안에서 능력치를 굴린다 (1~10) */
export function rollStats(originId: string, jobId: string): Stats {
  const o = ORIGIN_BY_ID[originId];
  const j = JOB_BY_ID[jobId];
  const out = {} as Stats;
  for (const k of ['str', 'agi', 'med', 'cha'] as (keyof Stats)[]) {
    const [lo, hi] = j.range[k];
    out[k] = Math.max(1, Math.min(10, lo + Math.floor(rng() * (hi - lo + 1)) + (o.bonus[k] ?? 0)));
  }
  return out;
}

/** 출신과 직업이 어울리는 조합인지 */
export function validCombo(originId: string, jobId: string): boolean {
  return !!ORIGIN_BY_ID[originId]?.jobs[jobId];
}

export function defaultCreation(): Creation {
  const look: Look = { ...PLAYER.look, acc: ORIGIN_BY_ID.tenant.acc.slice() };
  return { gender: 'm', origin: 'tenant', job: 'clerk', look, stats: rollStats('tenant', 'clerk') };
}

export function newState(name: string, now: number, cr: Creation = defaultCreation()): State {
  resetRegistry();
  const o = ORIGIN_BY_ID[cr.origin];
  const j = JOB_BY_ID[cr.job];
  const gain = (k: 'food' | 'water' | 'med' | 'caps'): number => (o.start[k] ?? 0) + (j.start[k] ?? 0);
  const player: PlayerInfo = { name: name.trim() || '관리자', gender: cr.gender, origin: cr.origin, job: cr.job, look: cr.look, stats: cr.stats };
  registerPlayer(player);
  const st: State = {
    v: 2,
    rel: {},
    people: {},
    dead: [],
    nextPid: 1,
    player,
    name: player.name,
    created: now,
    last: now,
    caps: 20 + gain('caps'),
    res: { food: 60 + gain('food'), water: 60 + gain('water'), med: 10 + gain('med') },
    ration: 'normal',
    shortMs: 0,
    crisis: false,
    items: {},
    found: {},
    crew: [],
    aff: {},
    talkAt: {},
    tapAt: {},
    tired: {},
    upg: { farm: 0, water: 0, store: 0, pack: 0, radio: 0, gen: 0 },
    floor: 0,
    exps: [],
    zoneClears: {},
    visitor: null,
    nextVisit: now + ms(20000),
    nextExpId: 1,
    stats: { expeditions: 0, totalCaps: 0, caught: 0 },
  };
  for (const [k, lv] of Object.entries(j.start.upg ?? {})) st.upg[k as UpgKey] = lv as number;
  return st;
}

// ---------- 조회 ----------

export function foundCount(s: State): number {
  return Object.keys(s.found).length;
}
export function catTotal(cat: Cat): number {
  return ITEMS.filter((i) => i.cat === cat).length;
}
export function catFound(s: State, cat: Cat): number {
  return ITEMS.filter((i) => i.cat === cat && s.found[i.id]).length;
}
export function catComplete(s: State, cat: Cat): boolean {
  return catFound(s, cat) >= catTotal(cat);
}
export function allComplete(s: State): boolean {
  return foundCount(s) >= ITEMS.length;
}
export function isZoneOpen(s: State, z: ZoneDef): boolean {
  return foundCount(s) >= z.unlock;
}
export function affinity(s: State, id: string): number {
  return s.aff[id] ?? 0;
}
export function chapterReached(s: State, id: string): number {
  const a = affinity(s, id);
  return CHAPTER_AFF.filter((t) => a >= t).length;
}
/** 3장까지 본 생존자의 능력은 1.5배 */
export function buffScale(s: State, id: string): number {
  return affinity(s, id) >= CHAPTER_AFF[2] ? 1.5 : 1;
}

export function awaySet(s: State, now: number): Set<string> {
  const out = new Set<string>();
  for (const e of s.exps) if (e.end > now) e.members.forEach((m) => out.add(m));
  return out;
}
/** 매장에 있는 사람 (탐사 나간 사람 제외) */
export function homeCrew(s: State, now: number): string[] {
  const away = awaySet(s, now);
  return ['me', ...s.crew].filter((id) => !away.has(id));
}
export function isTired(s: State, id: string, now: number): boolean {
  return (s.tired[id] ?? 0) > now;
}
/** 탐사 보낼 수 있는 사람 */
export function availableCrew(s: State, now: number): string[] {
  const away = awaySet(s, now);
  return ['me', ...s.crew].filter((id) => !away.has(id) && !isTired(s, id, now));
}

// ---------- 비축 · 소비 ----------

/** 벙커에서 먹고 마시는 사람 (플레이어 포함, 탐사 중이어도 몫은 따로 챙겨 둔다) */
export function heads(s: State): number {
  return 1 + s.crew.length;
}

/** 지금 적용되는 배급 단계. 물자가 바닥나면 설정과 상관없이 극한 절식이다. */
export function effectiveRation(s: State): Ration {
  return s.res.food <= 0 || s.res.water <= 0 ? 'starve' : s.ration;
}

function homeBuff(s: State, now: number, kinds: string[]): number {
  let v = 0;
  for (const id of homeCrew(s, now)) {
    const d = SURV_BY_ID[id];
    if (d && kinds.includes(d.buff.kind)) v += d.buff.value * buffScale(s, id);
  }
  return v;
}

export interface Flow {
  /** 분당 생산 */
  prod: Record<'food' | 'water', number>;
  /** 분당 소비 */
  cons: Record<'food' | 'water', number>;
  cap: number;
}

export const EAT = { food: 0.04, water: 0.06 };

export function flow(s: State, now: number): Flow {
  const all = homeBuff(s, now, ['prod_all']);
  const food = (PROD.food + PROD.foodLv * s.upg.farm) * (1 + homeBuff(s, now, ['prod_food']) + all) * (catComplete(s, 'food') ? 1.25 : 1);
  const water = (PROD.water + PROD.waterLv * s.upg.water) * (1 + homeBuff(s, now, ['prod_water']) + all) * (catComplete(s, 'daily') ? 1.25 : 1);
  const eat = RATIONS[s.ration].eat;
  const n = heads(s);
  return {
    prod: { food, water },
    cons: { food: EAT.food * n * eat, water: EAT.water * n * eat },
    cap: PROD.cap + PROD.capLv * s.upg.store,
  };
}

/** 이 자원이 바닥나기까지 남은 분. 줄지 않으면 null. */
export function minutesLeft(s: State, now: number, k: 'food' | 'water'): number | null {
  const f = flow(s, now);
  const net = f.prod[k] - f.cons[k];
  if (net >= 0) return null;
  return s.res[k] / -net;
}

export function offlineCapMs(s: State): number {
  return (8 + 2 * s.upg.gen) * 3600 * 1000;
}

/** 절식의 나쁜 효과 배율 (탐사 사망 확률). 책 읽어 주는 사람이 있으면 절반으로 줄어든다. */
export function rationDeathMult(s: State, now: number): number {
  const base = RATIONS[effectiveRation(s)].death;
  const calm = Math.min(0.9, homeBuff(s, now, ['calm']));
  return 1 + (base - 1) * (1 - calm);
}

/** 한 자원을 min 분 진행. 0 이 된 뒤 흐른 시간(분)을 돌려준다. */
function advanceRes(s: State, k: 'food' | 'water', f: Flow, min: number): number {
  const net = f.prod[k] - f.cons[k];
  const v = s.res[k] + net * min;
  if (v >= 0) {
    s.res[k] = Math.min(f.cap, v);
    return 0;
  }
  const lasted = net < 0 ? s.res[k] / -net : 0;
  s.res[k] = 0;
  return Math.max(0, min - lasted);
}

// ---------- 시간 진행 ----------

export function tick(s: State, now: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (now < s.last) s.last = now;
  const dt = now - s.last;
  if (dt > 0) {
    const eff = Math.min(dt, offlineCapMs(s));
    const min = eff / 60000;
    const f = flow(s, now);
    const dry = Math.max(advanceRes(s, 'food', f, min), advanceRes(s, 'water', f, min));
    s.res.med = Math.min(PROD.medCap, s.res.med);
    if (dry > 0) s.shortMs += dry * 60000;
    else if (s.res.food > 0 && s.res.water > 0) s.shortMs = 0;
    s.last = now;
    if (!s.crisis && s.crew.length > 0 && s.shortMs >= ms(CRISIS_MS)) {
      s.crisis = true;
      events.push({ type: 'crisis' });
    }
  }
  for (const e of s.exps) {
    if (e.end <= now && !e.notified) {
      e.notified = true;
      events.push({ type: 'exp_done', id: e.id, zone: e.zone });
    }
  }
  if (!s.visitor && now >= s.nextVisit) {
    const next = pickVisitor(s);
    if (next) {
      const p = makePerson(s, next);
      s.visitor = p.id;
      events.push({ type: 'visitor', id: p.id });
    } else {
      s.nextVisit = now + ms(8000);
    }
  }
  return events;
}


// ---------- 생존자 만들기 ----------

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}
function choice<T>(a: readonly T[]): T {
  return a[Math.floor(rng() * a.length)];
}

function usedNames(s: State): Set<string> {
  return new Set(Object.values(s.people).map((p) => p.name));
}

function makeName(s: State, kind: ProfDef['names']): string {
  const used = usedNames(s);
  for (let i = 0; i < 30; i++) {
    let n: string;
    if (kind === 'cat') n = choice(CAT_NAMES);
    else if (kind === 'kid') n = choice(KID_NAMES);
    else if (kind === 'old') n = choice(SURNAMES) + choice(OLD_GIVEN);
    else n = choice(SURNAMES) + choice(GIVEN);
    if (!used.has(n)) return n;
  }
  return choice(SURNAMES) + choice(GIVEN) + '2';
}

/** 직업의 핵심 능력치는 보장 범위 안에서, 겉모습과 이름은 무작위로 */
export function makePerson(s: State, prof: ProfDef): Person {
  const id = `p${s.nextPid++}`;
  const stats: Stats = {
    str: randInt(...prof.range.str),
    agi: randInt(...prof.range.agi),
    med: randInt(...prof.range.med),
    cha: randInt(...prof.range.cha),
  };
  const look: Look = { ...prof.look, acc: [...prof.look.acc] };
  if (!look.cat) {
    look.skin = choice(SKINS);
    look.hair = choice(prof.hairs ?? DARK_HAIRS);
    if (prof.styles) look.style = choice(prof.styles);
  }
  const person: Person = { id, prof: prof.id, name: makeName(s, prof.names), look, stats };
  s.people[id] = person;
  registerPerson(person);
  return person;
}

export function relKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
export function relOf(s: State, a: string, b: string): 'friend' | 'rival' | null {
  return s.rel[relKey(a, b)] ?? null;
}
/** 한 사람과 특정 관계인 모든 id */
export function relatives(s: State, id: string, kind: 'friend' | 'rival'): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(s.rel)) {
    if (v !== kind) continue;
    const [x, y] = k.split('|');
    if (x === id) out.push(y);
    else if (y === id) out.push(x);
  }
  return out;
}

/** 새로 합류한 사람과 기존 식구들 사이의 관계를 정한다. 매력이 높을수록 친구가 잘 생긴다. */
function rollRelations(s: State, id: string): void {
  const cha = s.people[id]?.stats.cha ?? 3;
  for (const other of s.crew) {
    if (other === id) continue;
    const r = rng();
    const pFriend = 0.2 + 0.03 * cha;
    if (r < pFriend) s.rel[relKey(id, other)] = 'friend';
    else if (r < pFriend + 0.15) s.rel[relKey(id, other)] = 'rival';
  }
}

/** 지금 살아서 합류해 있거나 문 앞에 서 있는 직업 */
export function livingProfs(s: State): Set<string> {
  const out = new Set<string>();
  for (const id of s.crew) out.add(s.people[id]?.prof ?? '');
  if (s.visitor) out.add(s.people[s.visitor]?.prof ?? '');
  return out;
}

/**
 * 다음 방문자의 직업. 조건을 만족한 직업 중에서 가중치 랜덤으로 뽑는다.
 * 지금 모자란 쪽(식량·식수·의약품)을 채워 주는 사람이 조금 더 잘 온다.
 */
export function pickVisitor(s: State): ProfDef | null {
  const here = livingProfs(s);
  const cands = PROFS.filter((d) => !here.has(d.id) && unlockMet(s, d.unlock));
  if (!cands.length) return null;
  const weights = cands.map((d) => {
    let w = 1;
    if (d.buff.kind === 'prod_food' && s.res.food < 30) w *= 3;
    if (d.buff.kind === 'prod_water' && s.res.water < 30) w *= 3;
    if (d.buff.kind === 'med_yield' && s.res.med < 10) w *= 2.5;
    if (d.buff.kind === 'calm' && s.crew.length >= 3 && (s.ration !== 'normal' || s.shortMs > 0)) w *= 2;
    return w;
  });
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r < 0) return cands[i];
  }
  return cands[cands.length - 1];
}

export function unlockMet(s: State, u: Unlock): boolean {
  switch (u.type) {
    case 'start':
      return true;
    case 'found':
      return foundCount(s) >= u.n;
    case 'cat':
      return catFound(s, u.cat) >= u.n;
    case 'exp':
      return s.stats.expeditions >= u.n;
    case 'item':
      return !!s.found[u.id];
    case 'crew':
      return s.crew.length >= u.n;
  }
}

/** 받아 줄 수 있는 최대 인원 (관리자 제외) */
export function capacity(s: State): number {
  return FLOORS[Math.min(s.floor, FLOORS.length - 1)].cap;
}
export function freeBeds(s: State): number {
  return capacity(s) - s.crew.length;
}
export function nextFloor(s: State): (typeof FLOORS)[number] | null {
  return s.floor + 1 < FLOORS.length ? FLOORS[s.floor + 1] : null;
}
export function buyFloor(s: State): boolean {
  const nx = nextFloor(s);
  if (!nx || s.caps < nx.cost) return false;
  s.caps -= nx.cost;
  s.floor += 1;
  return true;
}

export function recruit(s: State, id: string, now: number): boolean {
  if (s.visitor !== id || s.crew.includes(id)) return false;
  if (freeBeds(s) <= 0) return false; // 침대가 없다
  rollRelations(s, id);
  s.crew.push(id);
  s.aff[id] = 0;
  s.visitor = null;
  s.nextVisit = now + Math.round(ms(45000) / (1 + 0.15 * s.upg.radio));
  return true;
}

/** 문 앞의 방문자를 돌려보낸다. 다시 만날 수는 있지만 같은 사람은 아니다. */
export function rejectVisitor(s: State, now: number): boolean {
  const id = s.visitor;
  if (!id) return false;
  delete s.people[id];
  s.visitor = null;
  s.nextVisit = now + Math.round(ms(30000) / (1 + 0.15 * s.upg.radio));
  return true;
}

// ---------- 탐사 ----------

export function expeditionMs(s: State, zone: ZoneDef): number {
  return Math.max(3000, Math.round((zone.minutes * 60000 * (1 - 0.07 * s.upg.radio) * (catComplete(s, 'tech') ? 0.9 : 1)) / config.speed));
}

export interface Preview {
  ms: number;
  risk: number;
  loot: number;
  power: number;
  /** 들키면 이 사람이 죽을 확률 (플레이어 제외) */
  deathIf: Record<string, number>;
  /** 이번 탐사에서 누군가 죽을 확률 */
  anyDeath: number;
  /** 같이 가는 사람들 사이의 친한 짝/불화 짝 수 */
  friends: number;
  rivals: number;
  /** 이 구역을 잘 아는 사람들 (최대 2명까지 효과) */
  experts: string[];
}

/** 들켰을 때 죽을 확률. 전투가 세면 낮고, 팀에 의료 능력치가 높은 사람이 있으면 더 낮다. */
export function deathChance(id: string, members: string[], s?: State, now = 0): number {
  const d = SURV_BY_ID[id];
  if (!d || id === 'me') return 0;
  const medic = Math.max(0, ...members.map((m) => SURV_BY_ID[m]?.stats.med ?? 0));
  let p = Math.max(0.03, (0.5 - 0.04 * d.stats.str) * (1 - Math.min(0.4, 0.04 * medic)));
  // 친한 사람이 같이 가면 서로 챙긴다
  if (s && members.some((m) => m !== id && relOf(s, id, m) === 'friend')) p *= 0.85;
  if (s) {
    p *= rationDeathMult(s, now);
    if (catComplete(s, 'medical')) p *= 0.9;
  }
  return Math.min(0.95, p);
}

export function previewExpedition(s: State, zoneId: string, members: string[], now = Date.now()): Preview {
  const zone = ZONE_BY_ID[zoneId];
  let power = 0;
  let guard = 1;
  let loot = 3 + s.upg.pack + (members.length >= 2 ? 1 : 0) + (catComplete(s, 'pet') ? 1 : 0);
  for (const id of members) {
    const d = SURV_BY_ID[id];
    if (!d) continue;
    power += d.power;
    if (d.buff.kind === 'exp_guard') {
      guard = Math.max(0.05, 1 - d.buff.value * buffScale(s, id));
      loot += 1;
    }
    if (d.buff.kind === 'exp_loot') loot += Math.round(d.buff.value * buffScale(s, id));
  }
  // 그 구역을 잘 아는 사람: 구조를 알아서 덜 들키고 물건도 더 챙긴다 (최대 2명)
  const experts = members.filter((id) => SURV_BY_ID[id]?.know.some((k) => zone.know.includes(k))).slice(0, 2);
  loot += experts.length;
  let friends = 0;
  let rivals = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const r = relOf(s, members[i], members[j]);
      if (r === 'friend') friends++;
      else if (r === 'rival') rivals++;
    }
  }
  // 불화인 두 사람이 같이 가면 손발이 안 맞아 들킬 확률이 오른다
  const risk = Math.min(0.5, Math.max(0, (zone.D - power) * 0.12) * guard * (1 + 0.2 * rivals) * 0.9 ** Math.min(2, friends) * 0.85 ** experts.length);
  const deathIf: Record<string, number> = {};
  let safe = 1;
  for (const id of members) {
    deathIf[id] = deathChance(id, members, s, now);
    safe *= 1 - risk * deathIf[id];
  }
  return { ms: expeditionMs(s, zone), risk, loot, power, deathIf, anyDeath: 1 - safe, friends, rivals, experts };
}

function luckOf(s: State, members: string[]): number {
  let luck = 1;
  for (const id of members) {
    const d = SURV_BY_ID[id];
    if (d) luck += 0.03 * d.stats.agi; // 수색 능력치: 희귀·전설 발견 확률
    if (d && d.buff.kind === 'exp_luck') luck += d.buff.value * buffScale(s, id);
  }
  return luck;
}

export function pickItem(s: State, zone: ZoneDef, luck: number): string {
  const pool: { id: string; w: number }[] = [];
  for (const it of ITEMS) {
    const cw = zone.cats[it.cat];
    if (!cw) continue;
    let w = RARITY[it.rarity].weight * cw;
    if (it.rarity === 'rare') w *= (zone.D >= 3 ? 2 : 1) * luck;
    if (it.rarity === 'legend') w *= (zone.D >= 4 ? 2 : 1) * (zone.D >= 5 ? 2 : 1) * luck;
    if (!s.found[it.id]) w *= 1.3;
    pool.push({ id: it.id, w });
  }
  const sum = pool.reduce((a, b) => a + b.w, 0);
  let r = rng() * sum;
  for (const p of pool) {
    r -= p.w;
    if (r <= 0) return p.id;
  }
  return pool[pool.length - 1].id;
}

export type StartResult = { ok: true; exp: Expedition } | { ok: false; error: string };

export function startExpedition(s: State, zoneId: string, members: string[], now: number): StartResult {
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return { ok: false, error: '알 수 없는 구역이에요.' };
  if (!isZoneOpen(s, zone)) return { ok: false, error: '아직 갈 수 없는 구역이에요.' };
  if (members.length < 1 || members.length > 3) return { ok: false, error: '탐사대는 1~3명이에요.' };
  const free = new Set(availableCrew(s, now));
  if (new Set(members).size !== members.length || !members.every((m) => free.has(m))) {
    return { ok: false, error: '지금 나갈 수 없는 사람이 있어요.' };
  }
  const pv = previewExpedition(s, zoneId, members, now);
  const caught = rng() < pv.risk;
  let n = pv.loot;
  if (caught) n = Math.max(1, Math.floor(n / 2));
  const luck = luckOf(s, members);
  const items: string[] = [];
  for (let i = 0; i < n; i++) items.push(pickItem(s, zone, luck));
  let caps = Math.round((6 + 8 * zone.D) * (0.7 + rng() * 0.6));
  if (caught) caps = Math.floor(caps / 2);
  const supplies = { food: 0, water: 0, med: 0 } as Record<ResKey, number>;
  for (const k of Object.keys(zone.supply) as ResKey[]) {
    const [lo, hi] = zone.supply[k] as [number, number];
    supplies[k] = Math.round((lo + rng() * (hi - lo)) * (caught ? 0.5 : 1) * (1 + 0.15 * pv.experts.length));
  }
  const deaths: ExpResult['deaths'] = [];
  if (caught) {
    for (const m of members) {
      if (rng() < pv.deathIf[m]) {
        const pr = PROF_BY_ID[s.people[m].prof];
        deaths.push({ id: m, last: pr.lastWords[Math.floor(rng() * pr.lastWords.length)] });
      }
    }
  }
  const line = caught
    ? deaths.length
      ? '좀비 떼에 포위당했다. 전부 돌아오지는 못했다…'
      : '좀비 떼에 들켜서 도망쳐 왔다! 가방이 반쯤 비었다…'
    : zone.lines[Math.floor(rng() * zone.lines.length)];
  const exp: Expedition = {
    id: `e${s.nextExpId++}`,
    zone: zoneId,
    members: [...members],
    start: now,
    end: now + pv.ms,
    result: { items, caps, caught, line, deaths, supplies },
    notified: false,
  };
  s.exps.push(exp);
  return { ok: true, exp };
}

export interface Report {
  zone: string;
  items: { id: string; isNew: boolean }[];
  caps: number;
  bonusCaps: number;
  caught: boolean;
  line: string;
  firstClear: boolean;
  chapters: { id: string; chapter: number }[];
  rewards: number;
  supplies: Record<ResKey, number>;
  deaths: { id: string; name: string; title: string; last: string }[];
  /** 친구를 잃고 충격받은 사람들 */
  grief: string[];
  /** 이번 탐사에서 새로 생기거나 바뀐 사이 */
  bonds: { a: string; b: string; kind: 'friend' | 'rival' | 'mended' }[];
}

/**
 * 같이 탐사를 다녀온 사람들 사이의 정. 무사히 다녀오면 친해지고, 들키면 서로 탓하게 된다.
 * 사이가 나쁜 두 사람도 성공을 함께하면 풀릴 수 있다.
 */
function rollBonds(s: State, who: string[], caught: boolean): Report['bonds'] {
  const out: Report['bonds'] = [];
  for (let i = 0; i < who.length; i++) {
    for (let j = i + 1; j < who.length; j++) {
      const a = who[i];
      const b = who[j];
      const cur = relOf(s, a, b);
      const cha = Math.max(s.people[a]?.stats.cha ?? 3, s.people[b]?.stats.cha ?? 3);
      if (!caught) {
        if (!cur && rng() < 0.25 + 0.02 * cha) {
          s.rel[relKey(a, b)] = 'friend';
          out.push({ a, b, kind: 'friend' });
        } else if (cur === 'rival' && rng() < 0.2 + 0.02 * cha) {
          delete s.rel[relKey(a, b)];
          out.push({ a, b, kind: 'mended' });
        }
      } else if (!cur && rng() < 0.15) {
        s.rel[relKey(a, b)] = 'rival';
        out.push({ a, b, kind: 'rival' });
      }
    }
  }
  return out;
}

export function claimExpedition(s: State, expId: string, now: number): Report | null {
  const idx = s.exps.findIndex((e) => e.id === expId);
  if (idx < 0) return null;
  const e = s.exps[idx];
  if (e.end > now) return null;
  s.exps.splice(idx, 1);
  const zone = ZONE_BY_ID[e.zone];
  const duri = e.members.some((m) => s.people[m]?.prof === 'kid');
  const items: Report['items'] = [];
  let bonusCaps = 0;
  for (const id of e.result.items) {
    const isNew = !s.found[id];
    if (isNew) {
      s.found[id] = now;
      const rb = 10 * (duri ? 2 : 1);
      bonusCaps += rb;
    }
    s.items[id] = (s.items[id] ?? 0) + 1;
    items.push({ id, isNew });
  }
  const firstClear = !s.zoneClears[e.zone];
  if (firstClear) bonusCaps += zone.D * 30;
  s.zoneClears[e.zone] = (s.zoneClears[e.zone] ?? 0) + 1;
  const sup = { ...(e.result.supplies ?? { food: 0, water: 0, med: 0 }) };
  sup.med = Math.round(sup.med * (1 + homeBuff(s, now, ['med_yield'])));
  const cap = PROD.cap + PROD.capLv * s.upg.store;
  s.res.food = Math.min(cap, s.res.food + sup.food);
  s.res.water = Math.min(cap, s.res.water + sup.water);
  s.res.med = Math.min(PROD.medCap, s.res.med + sup.med);
  const total = e.result.caps + bonusCaps;
  s.caps += total;
  s.stats.totalCaps += total;
  s.stats.expeditions += 1;
  if (e.result.caught) {
    s.stats.caught += 1;
    for (const m of e.members) {
      if ((e.result.deaths ?? []).some((x) => x.id === m)) continue;
      // 다친 사람은 의약품 2개를 쓰면 빨리 낫는다. 없으면 오래 앓는다.
      const cure = s.res.med >= 2;
      if (cure) s.res.med -= 2;
      s.tired[m] = now + ms(cure ? 120000 : 360000);
    }
  }
  const deaths: Report['deaths'] = [];
  for (const dd of e.result.deaths ?? []) {
    const d = SURV_BY_ID[dd.id];
    if (!d || !s.crew.includes(dd.id)) continue;
    s.crew = s.crew.filter((c) => c !== dd.id);
    s.dead.push({ id: dd.id, day: dayNumber(s, now), zone: e.zone, last: dd.last });
    deaths.push({ id: dd.id, name: d.name, title: d.title, last: dd.last });
  }
  const bonds = rollBonds(s, e.members.filter((m) => m !== 'me' && s.crew.includes(m)), e.result.caught);
  const gone = new Set(deaths.map((d) => d.id));
  const grief = new Set<string>();
  for (const d of deaths) {
    for (const f of relatives(s, d.id, 'friend')) {
      if (!s.crew.includes(f) || gone.has(f)) continue;
      grief.add(f);
      s.aff[f] = Math.max(0, affinity(s, f) - 8);
      s.tired[f] = Math.max(s.tired[f] ?? 0, now + ms(180000));
    }
  }
  const chapters: Report['chapters'] = [];
  let rewards = 0;
  for (const m of e.members) {
    if (m === 'me' || gone.has(m)) continue;
    const r = addAffinity(s, m, 4);
    r.chapters.forEach((c) => chapters.push({ id: m, chapter: c }));
    rewards += r.reward;
  }
  return { zone: e.zone, items, caps: e.result.caps, bonusCaps, caught: e.result.caught, line: e.result.line, firstClear, chapters, rewards, supplies: sup, deaths, grief: [...grief], bonds };
}

export function setRation(s: State, r: Ration): void {
  if (r in RATIONS) s.ration = r;
}

// ---------- 굶주림 위기 ----------

/** 위기 때 내보낼 후보: 가장 쓸모가 적은 사람 (능력치 합이 낮고 호감이 낮은 사람) */
export function weakestId(s: State): string | null {
  let best: string | null = null;
  let bestV = Infinity;
  for (const id of s.crew) {
    const d = SURV_BY_ID[id];
    if (!d) continue;
    const v = d.stats.str + d.stats.agi + d.stats.med + d.stats.cha + affinity(s, id) / 25;
    if (v < bestV) {
      bestV = v;
      best = id;
    }
  }
  return best;
}

export type CrisisResult = { ok: true; exiled?: { id: string; last: string }; grief: string[] } | { ok: false };

/** 'exile': 입 하나를 줄인다(추방). 'endure': 모두가 버틴다(호감 -10, 3시간 유예). */
export function resolveCrisis(s: State, choice: 'exile' | 'endure', now: number): CrisisResult {
  if (!s.crisis) return { ok: false };
  s.crisis = false;
  if (choice === 'endure') {
    for (const id of s.crew) s.aff[id] = Math.max(0, affinity(s, id) - 10);
    s.shortMs = Math.max(0, ms(CRISIS_MS) - ms(3 * 3600 * 1000));
    return { ok: true, grief: [] };
  }
  const id = weakestId(s);
  if (!id) return { ok: true, grief: [] };
  const grief: string[] = [];
  const last = '"…알겠어요. 먹을 걸 남겨 줘서 고마웠어요."';
  s.crew = s.crew.filter((c) => c !== id);
  s.dead.push({ id, day: dayNumber(s, now), zone: 'exile', last });
  for (const f of relatives(s, id, 'friend')) {
    if (!s.crew.includes(f)) continue;
    grief.push(f);
    s.aff[f] = Math.max(0, affinity(s, f) - 15);
  }
  // 나머지는 호감이 조금 깎인다 (누구 다음일지 모르니까)
  for (const c of s.crew) if (!grief.includes(c)) s.aff[c] = Math.max(0, affinity(s, c) - 5);
  s.shortMs = 0;
  return { ok: true, exiled: { id, last }, grief };
}

// ---------- 호감도 · 대화 · 선물 ----------

export interface AffResult {
  chapters: number[];
  reward: number;
}

export function addAffinity(s: State, id: string, n: number): AffResult {
  const before = affinity(s, id);
  const after = Math.min(100, before + n);
  s.aff[id] = after;
  const chapters: number[] = [];
  let reward = 0;
  CHAPTER_AFF.forEach((t, i) => {
    if (before < t && after >= t) {
      chapters.push(i);
      if (i === 2) {
        reward = 150;
        s.caps += reward;
      }
    }
  });
  return { chapters, reward };
}

function pickLine(d: SurvDef): string {
  return d.chat[Math.floor(rng() * d.chat.length)];
}

export type TalkResult = ({ ok: true; line: string } & AffResult) | { ok: false; wait: number };

export function talk(s: State, id: string, now: number): TalkResult {
  const d = SURV_BY_ID[id];
  if (!d || id === 'me' || !s.crew.includes(id)) return { ok: false, wait: 0 };
  const until = s.talkAt[id] ?? 0;
  if (until > now) return { ok: false, wait: until - now };
  s.talkAt[id] = now + ms(60000);
  const r = addAffinity(s, id, Math.round(6 * RATIONS[effectiveRation(s)].talk * (catComplete(s, 'culture') ? 1.25 : 1)));
  return { ok: true, line: pickLine(d), ...r };
}

export interface TapResult {
  line: string;
  gained: boolean;
  chapters: number[];
  reward: number;
}

/** 장면에서 생존자를 톡 건드렸을 때 */
export function tapSurvivor(s: State, id: string, now: number): TapResult {
  const d = SURV_BY_ID[id] ?? PLAYER;
  const line = pickLine(d);
  if (id === 'me' || !s.crew.includes(id) || (s.tapAt[id] ?? 0) > now) {
    return { line, gained: false, chapters: [], reward: 0 };
  }
  s.tapAt[id] = now + ms(15000);
  const r = addAffinity(s, id, RATIONS[effectiveRation(s)].talk > 0 ? 1 : 0);
  return { line, gained: true, ...r };
}

export type GiftResult = ({ ok: true; delta: number; mood: 'love' | 'like' | 'meh' } & AffResult) | { ok: false };

export function gift(s: State, id: string, itemId: string): GiftResult {
  const d = SURV_BY_ID[id];
  const it = ITEM_BY_ID[itemId];
  if (!d || !it || id === 'me' || !s.crew.includes(id) || (s.items[itemId] ?? 0) < 1) return { ok: false };
  s.items[itemId] -= 1;
  let delta = 4;
  let mood: 'love' | 'like' | 'meh' = 'meh';
  if (d.likes.items.includes(itemId)) {
    delta = 25;
    mood = 'love';
  } else if (d.likes.cat === it.cat) {
    delta = 12;
    mood = 'like';
  }
  const r = addAffinity(s, id, delta);
  return { ok: true, delta, mood, ...r };
}

// ---------- 판매 · 개조 ----------

/** 벙커에 있는 사람 중 가장 매력적인 사람이 흥정해 준다 (매력 1점당 +3%) */
export function sellPrice(s: State, itemId: string, now: number): number {
  const it = ITEM_BY_ID[itemId];
  if (!it) return 0;
  const cha = Math.max(0, ...homeCrew(s, now).map((id) => SURV_BY_ID[id]?.stats.cha ?? 0));
  return Math.round(RARITY[it.rarity].sell * (1 + 0.03 * cha));
}

export function sellItem(s: State, itemId: string, now: number): number {
  const it = ITEM_BY_ID[itemId];
  if (!it || (s.items[itemId] ?? 0) < 1) return 0;
  const price = sellPrice(s, itemId, now);
  s.items[itemId] -= 1;
  s.caps += price;
  return price;
}

export function upgradeCost(key: UpgKey, lv: number): number {
  const u = UPGRADES[key];
  return Math.round(u.base * Math.pow(u.grow, lv));
}

export function buyUpgrade(s: State, key: UpgKey): boolean {
  const u = UPGRADES[key];
  const lv = s.upg[key];
  if (lv >= u.max) return false;
  const cost = upgradeCost(key, lv);
  if (s.caps < cost) return false;
  s.caps -= cost;
  s.upg[key] = lv + 1;
  return true;
}

// ---------- 저장 ----------

const KEY = 'last-shelter-b7-v1'; // v2 이전 저장은 형식이 달라 불러오지 않는다

export function saveState(s: State): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 공간이 없거나 막혀 있어도 게임은 계속된다 */
  }
}

export function loadState(): State | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<State>;
    if (d.v !== 2 || typeof d.created !== 'number') return null;
    const base = newState(d.name ?? '관리자', d.created);
    const st = { ...base, ...d, upg: { ...base.upg, ...(d.upg ?? {}) }, stats: { ...base.stats, ...(d.stats ?? {}) } } as State;
    resetRegistry();
    registerPlayer(st.player);
    for (const p of Object.values(st.people)) registerPerson(p);
    return st;
  } catch {
    return null;
  }
}

export function clearState(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

/** 접속한 지 며칠째인지 (현실 달력 기준) */
export function dayNumber(s: State, now: number): number {
  return Math.max(1, Math.floor((now - s.created) / 86400000) + 1);
}

export { ZONES };
