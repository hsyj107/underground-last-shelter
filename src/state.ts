// 게임 규칙. 화면과 무관하게 동작하므로 node 로 그대로 테스트할 수 있다.
import {
  CAT_NAMES,
  CAT_ORDER,
  CHAPTER_AFF,
  DARK_HAIRS,
  GIVEN,
  ITEMS,
  ITEM_BY_ID,
  KID_NAMES,
  OLD_GIVEN,
  PLAYER,
  PROFS,
  PROF_BY_ID,
  RARITY,
  SKINS,
  SURNAMES,
  SURV_BY_ID,
  UPGRADES,
  ZONES,
  ZONE_BY_ID,
  registerPerson,
  resetRegistry,
} from './data.ts';
import type { Cat, Look, Person, ProfDef, Stats, SurvDef, Unlock, UpgKey, ZoneDef } from './data.ts';

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

export interface State {
  v: 2;
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
  resetRegistry();
  return {
    v: 2,
    rel: {},
    people: {},
    dead: [],
    nextPid: 1,
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
    const next = PROFS.find((d) => !livingProfs(s).has(d.id) && unlockMet(s, d.unlock));
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
  rollRelations(s, id);
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
  /** 들키면 이 사람이 죽을 확률 (점장 제외) */
  deathIf: Record<string, number>;
  /** 이번 탐사에서 누군가 죽을 확률 */
  anyDeath: number;
  /** 같이 가는 사람들 사이의 친한 짝/불화 짝 수 */
  friends: number;
  rivals: number;
}

/** 들켰을 때 죽을 확률. 전투가 세면 낮고, 팀에 의료 능력치가 높은 사람이 있으면 더 낮다. */
export function deathChance(id: string, members: string[], s?: State): number {
  const d = SURV_BY_ID[id];
  if (!d || id === 'me') return 0;
  const medic = Math.max(0, ...members.map((m) => SURV_BY_ID[m]?.stats.med ?? 0));
  let p = Math.max(0.03, (0.5 - 0.04 * d.stats.str) * (1 - Math.min(0.4, 0.04 * medic)));
  // 친한 사람이 같이 가면 서로 챙긴다
  if (s && members.some((m) => m !== id && relOf(s, id, m) === 'friend')) p *= 0.85;
  return p;
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
  const risk = Math.min(0.5, Math.max(0, (zone.D - power) * 0.12) * guard * (1 + 0.2 * rivals));
  const deathIf: Record<string, number> = {};
  let safe = 1;
  for (const id of members) {
    deathIf[id] = deathChance(id, members, s);
    safe *= 1 - risk * deathIf[id];
  }
  return { ms: expeditionMs(s, zone), risk, loot, power, deathIf, anyDeath: 1 - safe, friends, rivals };
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
    result: { items, caps, caught, line, deaths },
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
  deaths: { id: string; name: string; title: string; last: string }[];
  /** 친구를 잃고 충격받은 사람들 */
  grief: string[];
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
    for (const m of e.members) if (!(e.result.deaths ?? []).some((x) => x.id === m)) s.tired[m] = now + ms(120000);
  }
  const deaths: Report['deaths'] = [];
  for (const dd of e.result.deaths ?? []) {
    const d = SURV_BY_ID[dd.id];
    if (!d || !s.crew.includes(dd.id)) continue;
    s.crew = s.crew.filter((c) => c !== dd.id);
    s.dead.push({ id: dd.id, day: dayNumber(s, now), zone: e.zone, last: dd.last });
    deaths.push({ id: dd.id, name: d.name, title: d.title, last: dd.last });
  }
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
  return { zone: e.zone, items, caps: e.result.caps, bonusCaps, caught: e.result.caught, line: e.result.line, firstClear, chapters, rewards, deaths, grief: [...grief] };
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

/** 매장에 있는 사람 중 가장 매력적인 사람이 흥정해 준다 (점장 제외, 매력 1점당 +3%) */
export function sellPrice(s: State, itemId: string, now: number): number {
  const it = ITEM_BY_ID[itemId];
  if (!it) return 0;
  const cha = Math.max(0, ...homeCrew(s, now).filter((id) => id !== 'me').map((id) => SURV_BY_ID[id]?.stats.cha ?? 0));
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
    const base = newState(d.name ?? '점장', d.created);
    const st = { ...base, ...d, upg: { ...base.upg, ...(d.upg ?? {}) }, stats: { ...base.stats, ...(d.stats ?? {}) } } as State;
    resetRegistry();
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
