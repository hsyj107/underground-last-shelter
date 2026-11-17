// 게임 규칙. 화면과 무관하게 동작하므로 node 로 그대로 테스트할 수 있다.
import {
  CAT_ORDER,
  CHAPTER_AFF,
  ITEMS,
  ITEM_BY_ID,
  PLAYER,
  RARITY,
  SURVIVORS,
  SURV_BY_ID,
  UPGRADES,
  ZONES,
  ZONE_BY_ID,
} from './data.ts';
import type { Cat, SurvDef, Unlock, UpgKey, ZoneDef } from './data.ts';

export const config = { speed: 1 };
let rng: () => number = Math.random;
export function setRng(f: () => number): void {
  rng = f;
}

export interface ExpResult {
  items: string[];
  caps: number;
  caught: boolean;
  line: string;
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

export interface State {
  v: 1;
  name: string;
  created: number;
  last: number;
  caps: number;
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
  exps: Expedition[];
  zoneClears: Record<string, number>;
  visitor: string | null;
  nextVisit: number;
  nextExpId: number;
  stats: { expeditions: number; totalCaps: number; caught: number };
}

export type GameEvent =
  | { type: 'visitor'; id: string }
  | { type: 'exp_done'; id: string; zone: string };

export const BASE_INCOME = 2;
const ms = (n: number): number => Math.round(n / config.speed);

export function newState(name: string, now: number): State {
  return {
    v: 1,
    name: name.trim() || '점장',
    created: now,
    last: now,
    caps: 20,
    items: {},
    found: {},
    crew: [],
    aff: {},
    talkAt: {},
    tapAt: {},
    tired: {},
    upg: { shelf: 0, pack: 0, radio: 0, gen: 0 },
    exps: [],
    zoneClears: {},
    visitor: null,
    nextVisit: now + ms(20000),
    nextExpId: 1,
    stats: { expeditions: 0, totalCaps: 0, caught: 0 },
  };
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

export function itemIncome(rarity: keyof typeof RARITY, n: number): number {
  if (n <= 0) return 0;
  return RARITY[rarity].income * (1 + 0.1 * (Math.min(n, 5) - 1));
}

export interface Income {
  perMin: number;
  base: number;
  shelfMult: number;
  allMult: number;
  finalMult: number;
  byCat: Record<Cat, { sum: number; mult: number; complete: boolean; buff: number }>;
}

export function incomeBreakdown(s: State, now: number): Income {
  const home = homeCrew(s, now);
  const byCat = {} as Income['byCat'];
  let total = BASE_INCOME;
  for (const cat of CAT_ORDER) {
    const sum = ITEMS.filter((i) => i.cat === cat).reduce((a, i) => a + itemIncome(i.rarity, s.items[i.id] ?? 0), 0);
    let buff = 0;
    for (const id of home) {
      const d = SURV_BY_ID[id];
      if (d && d.buff.kind === 'store_cat' && d.buff.cat === cat) buff += d.buff.value * buffScale(s, id);
    }
    const complete = catComplete(s, cat);
    const mult = 1 + buff + (complete ? 0.25 : 0);
    byCat[cat] = { sum, mult, complete, buff };
    total += sum * mult;
  }
  let allBuff = 0;
  for (const id of home) {
    const d = SURV_BY_ID[id];
    if (d && d.buff.kind === 'store_all') allBuff += d.buff.value * buffScale(s, id);
  }
  const shelfMult = 1 + 0.15 * s.upg.shelf;
  const allMult = 1 + allBuff;
  const finalMult = shelfMult * allMult * (allComplete(s) ? 1.5 : 1);
  return { perMin: total * finalMult, base: BASE_INCOME, shelfMult, allMult, finalMult, byCat };
}

export function offlineCapMs(s: State): number {
  return (4 + 2 * s.upg.gen) * 3600 * 1000;
}

// ---------- 시간 진행 ----------

export function tick(s: State, now: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (now < s.last) s.last = now;
  const dt = now - s.last;
  if (dt > 0) {
    const eff = Math.min(dt, offlineCapMs(s));
    const earn = (incomeBreakdown(s, now).perMin * eff) / 60000;
    s.caps += earn;
    s.stats.totalCaps += earn;
    s.last = now;
  }
  for (const e of s.exps) {
    if (e.end <= now && !e.notified) {
      e.notified = true;
      events.push({ type: 'exp_done', id: e.id, zone: e.zone });
    }
  }
  if (!s.visitor && now >= s.nextVisit) {
    const next = SURVIVORS.find((d) => !s.crew.includes(d.id) && unlockMet(s, d.unlock));
    if (next) {
      s.visitor = next.id;
      events.push({ type: 'visitor', id: next.id });
    } else {
      s.nextVisit = now + ms(8000);
    }
  }
  return events;
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

export function recruit(s: State, id: string, now: number): boolean {
  if (s.visitor !== id || s.crew.includes(id)) return false;
  s.crew.push(id);
  s.aff[id] = 0;
  s.visitor = null;
  s.nextVisit = now + Math.round(ms(45000) / (1 + 0.15 * s.upg.radio));
  return true;
}

// ---------- 탐사 ----------

export function expeditionMs(s: State, zone: ZoneDef): number {
  return Math.max(3000, Math.round((zone.minutes * 60000 * (1 - 0.07 * s.upg.radio)) / config.speed));
}

export interface Preview {
  ms: number;
  risk: number;
  loot: number;
  power: number;
}

export function previewExpedition(s: State, zoneId: string, members: string[]): Preview {
  const zone = ZONE_BY_ID[zoneId];
  let power = 0;
  let guard = 1;
  let loot = 3 + s.upg.pack + (members.length >= 2 ? 1 : 0);
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
  const risk = Math.min(0.5, Math.max(0, (zone.D - power) * 0.12)) * guard;
  return { ms: expeditionMs(s, zone), risk, loot, power };
}

function luckOf(s: State, members: string[]): number {
  let luck = 1;
  for (const id of members) {
    const d = SURV_BY_ID[id];
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
  const pv = previewExpedition(s, zoneId, members);
  const caught = rng() < pv.risk;
  let n = pv.loot;
  if (caught) n = Math.max(1, Math.floor(n / 2));
  const luck = luckOf(s, members);
  const items: string[] = [];
  for (let i = 0; i < n; i++) items.push(pickItem(s, zone, luck));
  let caps = Math.round((6 + 8 * zone.D) * (0.7 + rng() * 0.6));
  if (caught) caps = Math.floor(caps / 2);
  const line = caught
    ? '좀비 떼에 들켜서 도망쳐 왔다! 가방이 반쯤 비었다…'
    : zone.lines[Math.floor(rng() * zone.lines.length)];
  const exp: Expedition = {
    id: `e${s.nextExpId++}`,
    zone: zoneId,
    members: [...members],
    start: now,
    end: now + pv.ms,
    result: { items, caps, caught, line },
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
}

export function claimExpedition(s: State, expId: string, now: number): Report | null {
  const idx = s.exps.findIndex((e) => e.id === expId);
  if (idx < 0) return null;
  const e = s.exps[idx];
  if (e.end > now) return null;
  s.exps.splice(idx, 1);
  const zone = ZONE_BY_ID[e.zone];
  const duri = e.members.includes('duri');
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
  const total = e.result.caps + bonusCaps;
  s.caps += total;
  s.stats.totalCaps += total;
  s.stats.expeditions += 1;
  if (e.result.caught) {
    s.stats.caught += 1;
    for (const m of e.members) s.tired[m] = now + ms(120000);
  }
  const chapters: Report['chapters'] = [];
  let rewards = 0;
  for (const m of e.members) {
    if (m === 'me') continue;
    const r = addAffinity(s, m, 4);
    r.chapters.forEach((c) => chapters.push({ id: m, chapter: c }));
    rewards += r.reward;
  }
  return { zone: e.zone, items, caps: e.result.caps, bonusCaps, caught: e.result.caught, line: e.result.line, firstClear, chapters, rewards };
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
  const r = addAffinity(s, id, 6);
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
  const r = addAffinity(s, id, 1);
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

export function sellItem(s: State, itemId: string): number {
  const it = ITEM_BY_ID[itemId];
  if (!it || (s.items[itemId] ?? 0) < 1) return 0;
  s.items[itemId] -= 1;
  const price = RARITY[it.rarity].sell;
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

const KEY = 'last-shelter-b7-v1';

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
    if (d.v !== 1 || typeof d.created !== 'number') return null;
    const base = newState(d.name ?? '점장', d.created);
    return { ...base, ...d, upg: { ...base.upg, ...(d.upg ?? {}) }, stats: { ...base.stats, ...(d.stats ?? {}) } } as State;
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
