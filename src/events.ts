// 습격 · 상인 · 질병 · 구조 신호 · 층 돌파. state.ts 위에 얹힌 사건들 (순수 로직, 화면 없음)
import { PROF_BY_ID, PROFS, ZONES, ME_LAST, FLOORS, SURV_BY_ID, tierOf } from './data.ts';
import type { ResKey } from './data.ts';
import {
  ms,
  rand,
  dayNumber,
  awaySet,
  isTired,
  isSick,
  roleOf,
  defense,
  hasTrait,
  endGame,
  isZoneOpen,
  livingProfs,
  unlockMet,
  freeBeds,
  nextFloor,
  relatives,
  affinity,
  startExpedition,
  guideSteps,
} from './state.ts';
import type { State, StartResult } from './state.ts';

const HOUR = 3600000;
const RES_KEYS: ResKey[] = ['food', 'water', 'med'];
const pick = <T>(a: readonly T[]): T => a[Math.floor(rand() * a.length)];

// ---------- 공통: 사람이 죽는다 ----------

export interface Gone {
  id: string;
  name: string;
  title: string;
  last: string;
}

/** 생존자를 떠나보낸다. 관리자라면 게임이 끝난다. 친구는 충격을 받는다. */
export function killPerson(s: State, id: string, zone: string, last: string, cause: string, now: number): Gone | null {
  const d = SURV_BY_ID[id];
  if (!d) return null;
  if (id === 'me') {
    s.dead.push({ id, day: dayNumber(s, now), zone, last });
    endGame(s, cause, last, now);
    return { id, name: d.name, title: d.title, last };
  }
  if (!s.crew.includes(id)) return null;
  s.crew = s.crew.filter((c) => c !== id);
  delete s.role[id];
  delete s.sick[id];
  s.dead.push({ id, day: dayNumber(s, now), zone, last });
  for (const f of relatives(s, id, 'friend')) {
    if (!s.crew.includes(f)) continue;
    s.aff[f] = Math.max(0, affinity(s, f) - 8);
    s.tired[f] = Math.max(s.tired[f] ?? 0, now + ms(180000));
  }
  return { id, name: d.name, title: d.title, last };
}

const lastWordsOf = (s: State, id: string): string => {
  if (id === 'me') return pick(ME_LAST);
  const pr = PROF_BY_ID[s.people[id]?.prof];
  return pr ? pick(pr.lastWords) : '"…"';
};

/** 지금 문을 지킬 수 있는 사람 (방어조 중 멀쩡한 사람) */
function guardsHere(s: State, now: number): string[] {
  const away = awaySet(s, now);
  return s.crew.filter((id) => roleOf(s, id) === 'guard' && !isSick(s, id) && !isTired(s, id, now) && !away.has(id));
}

function takeRes(s: State, want: Record<ResKey, number>): Record<ResKey, number> {
  const got = { food: 0, water: 0, med: 0 } as Record<ResKey, number>;
  for (const k of RES_KEYS) {
    got[k] = Math.min(Math.max(0, Math.round(want[k])), Math.floor(s.res[k]));
    s.res[k] -= got[k];
  }
  return got;
}

// ---------- 습격 ----------

export type RaidChoice = 'fight' | 'talk' | 'pay' | 'hide';
export interface RaidResult {
  kind: 'raider' | 'horde';
  choice: RaidChoice;
  /** win: 막아냄 · deal: 협상·지불로 끝 · lose: 뚫렸다 */
  outcome: 'win' | 'deal' | 'lose';
  power: number;
  roll: number;
  lost: Record<ResKey, number>;
  caps: number;
  dead: Gone[];
  hurt: string[];
  sick: string[];
  auto: boolean;
}

function spawnRaid(s: State, now: number): void {
  const day = dayNumber(s, now);
  const n = s.crew.length;
  const horde = rand() < 0.3;
  let power = 6 + 1.4 * n + day + rand() * 4;
  if (s.rep.raider <= -3) power *= 1.3;
  power = Math.round(Math.min(60, power) * 10) / 10;
  const k = horde ? 1.2 : 1;
  s.raid = {
    kind: horde ? 'horde' : 'raider',
    power,
    demand: {
      food: Math.round((12 + 3 * n + rand() * 10) * k),
      water: Math.round((10 + 2.5 * n + rand() * 8) * k),
      med: n >= 4 ? Math.round((2 + rand() * 3) * k) : 0,
    },
    deadline: now + ms(12 * HOUR),
  };
}

/** 이번 습격에서 어떤 선택이 가능한지 */
export function raidChoices(s: State): RaidChoice[] {
  if (!s.raid) return [];
  return s.raid.kind === 'raider' ? ['fight', 'talk', 'pay'] : ['fight', 'hide'];
}

export function talkChance(s: State): number {
  if (!s.raid) return 0;
  const cha = Math.max(0, ...s.crew.map((id) => SURV_BY_ID[id]?.stats.cha ?? 0));
  const p = 0.3 + 0.04 * (SURV_BY_ID.me?.stats.cha ?? 0) + 0.03 * cha + 0.05 * s.rep.raider + (hasTrait(s, 'charm') ? 0.2 : 0) - s.raid.power / 80;
  return Math.min(0.9, Math.max(0.1, p));
}

export function resolveRaid(s: State, choice: RaidChoice, now: number, auto = false): RaidResult | null {
  const r = s.raid;
  if (!r || s.over) return null;
  if (!raidChoices(s).includes(choice)) return null;
  s.raid = null;
  const res: RaidResult = { kind: r.kind, choice, outcome: 'lose', power: r.power, roll: 0, lost: { food: 0, water: 0, med: 0 }, caps: 0, dead: [], hurt: [], sick: [], auto };
  const guards = guardsHere(s, now);
  if (choice === 'pay') {
    res.lost = takeRes(s, r.demand);
    res.outcome = 'deal';
    s.rep.raider = Math.min(5, s.rep.raider + 1);
    s.log.paid += 1;
  } else if (choice === 'talk') {
    if (rand() < talkChance(s)) {
      res.lost = takeRes(s, { food: r.demand.food * 0.5, water: r.demand.water * 0.5, med: r.demand.med * 0.5 });
      res.outcome = 'deal';
      s.rep.raider = Math.min(5, s.rep.raider + 1);
      s.log.paid += 1;
    } else {
      res.lost = takeRes(s, { food: r.demand.food * 1.2, water: r.demand.water * 1.2, med: r.demand.med * 1.2 });
      res.outcome = 'lose';
    }
  } else if (choice === 'hide') {
    res.lost = takeRes(s, { food: r.demand.food * 0.5, water: r.demand.water * 0.5, med: r.demand.med * 0.5 });
    res.outcome = 'deal';
    const pool = s.crew.filter((id) => !isSick(s, id));
    if (pool.length && rand() < 0.35) {
      const id = pick(pool);
      s.sick[id] = { deadline: now + ms((hasTrait(s, 'healer') ? 18 : 12) * HOUR) };
      res.sick.push(id);
    }
  } else {
    // fight
    res.roll = Math.round(defense(s, now) * (0.85 + 0.3 * rand()) * 10) / 10;
    s.log.fought += 1;
    if (res.roll >= r.power) {
      res.outcome = 'win';
      res.caps = Math.round(r.power * 1.5);
      s.caps += res.caps;
      s.stats.totalCaps += res.caps;
      if (r.kind === 'raider') s.rep.raider = Math.max(-5, s.rep.raider - 1);
      for (const g of guards) if (rand() < 0.2) {
        s.tired[g] = now + ms(240000);
        res.hurt.push(g);
      }
    } else {
      res.outcome = 'lose';
      const k = r.kind === 'raider' ? 1.5 : 1;
      res.lost = takeRes(s, { food: r.demand.food * k, water: r.demand.water * k, med: r.demand.med * k });
      if (r.kind === 'raider') s.rep.raider = Math.max(-5, s.rep.raider - 1);
      const gap = (r.power - res.roll) / r.power;
      const pDeath = Math.min(0.5, 0.15 + 0.3 * gap);
      if (guards.length) {
        // 방어조는 앞에서 버티다 다친다. 크게 밀리면 한 명은 돌아오지 못한다.
        for (const g of guards) if (rand() < 0.5) {
          s.tired[g] = now + ms(360000);
          res.hurt.push(g);
        }
        if (rand() < pDeath) {
          const id = pick(guards);
          const gone = killPerson(s, id, 'raid', lastWordsOf(s, id), '습격에 쓰러졌다', now);
          if (gone) res.dead.push(gone);
        }
      } else {
        // 지키는 사람이 없으면 아무나 맞는다. 정말 크게 밀리면 관리자도 위험하다.
        const pool = s.crew.filter((id) => !awaySet(s, now).has(id));
        if (pool.length && rand() < 0.35) {
          const id = pick(pool);
          const gone = killPerson(s, id, 'raid', lastWordsOf(s, id), '습격에 쓰러졌다', now);
          if (gone) res.dead.push(gone);
        }
      }
    }
  }
  return res;
}

// ---------- 상인 ----------

export interface Offer {
  id: string;
  res: ResKey;
  amount: number;
  price: number;
  sold: boolean;
}

export function marketMult(s: State): number {
  return Math.min(1.2, Math.max(0.6, 1 - 0.05 * s.rep.market - 0.01 * (SURV_BY_ID.me?.stats.cha ?? 0)));
}

function spawnMerchant(s: State, now: number): void {
  const base: Record<ResKey, [number, number]> = { food: [20, 8], water: [20, 6], med: [4, 12] };
  const mult = marketMult(s);
  const offers: Offer[] = RES_KEYS.map((k, i) => ({
    id: `o${i}`,
    res: k,
    amount: base[k][0],
    price: Math.max(1, Math.round(base[k][1] * mult * (0.85 + 0.3 * rand()))),
    sold: false,
  }));
  s.merchant = { until: now + ms(2 * HOUR), offers };
}

export function buyOffer(s: State, offerId: string, now: number): boolean {
  const m = s.merchant;
  if (!m || s.over || m.until <= now) return false;
  const o = m.offers.find((x) => x.id === offerId);
  if (!o || o.sold || s.caps < o.price) return false;
  s.caps -= o.price;
  o.sold = true;
  s.guide.trade = true;
  s.res[o.res] += o.amount;
  s.rep.market = Math.min(5, s.rep.market + 0.5);
  return true;
}

/** 상인이 식량·물을 사 주는 값. 그 상인이 파는 값(개당)의 60%라서 사고 되파는 것으론 절대 남지 않는다. */
export function sellQuote(s: State, k: 'food' | 'water', n = 10): number {
  const o = s.merchant?.offers.find((x) => x.res === k);
  if (!o) return 0;
  return Math.max(1, Math.floor(((n * o.price) / o.amount) * 0.6));
}

/** 남는 식량·물을 팔아 병마개로 바꾼다 (상인이 있을 때만) */
export function sellRes(s: State, k: 'food' | 'water', now: number, n = 10): number {
  const m = s.merchant;
  if (!m || s.over || m.until <= now) return 0;
  if (s.res[k] < n + 10) return 0;
  const price = sellQuote(s, k, n);
  s.res[k] -= n;
  s.caps += price;
  s.guide.trade = true;
  return price;
}

// ---------- 질병 ----------

export function treatCost(s: State): number {
  return hasTrait(s, 'healer') ? 3 : 4;
}

/** 병든 사람을 치료한다. 의약품이 든다. */
export function treat(s: State, id: string): boolean {
  if (!s.sick[id]) return false;
  const c = treatCost(s);
  if (s.res.med < c) return false;
  s.res.med -= c;
  delete s.sick[id];
  s.log.healed += 1;
  s.aff[id] = Math.min(100, affinity(s, id) + 5);
  return true;
}

function spawnSick(s: State, now: number): string | null {
  const away = awaySet(s, now);
  const pool = s.crew.filter((id) => !isSick(s, id) && !away.has(id));
  if (!pool.length) return null;
  const works = s.crew.filter((id) => roleOf(s, id) === 'work').length;
  const medic = Math.max(0, ...s.crew.map((id) => SURV_BY_ID[id]?.stats.med ?? 0));
  const skip = Math.min(0.6, 0.12 * works + (medic >= 6 ? 0.2 : 0)) + (hasTrait(s, 'lucky') ? 0.25 : 0);
  if (rand() < skip) return null;
  const id = pick(pool);
  s.sick[id] = { deadline: now + ms((hasTrait(s, 'healer') ? 18 : 12) * HOUR) };
  return id;
}

// ---------- 구조 신호 ----------

function spawnRescue(s: State, now: number): boolean {
  const here = livingProfs(s);
  const profs = PROFS.filter((p) => tierOf(p.id) !== 'common' && !here.has(p.id) && unlockMet(s, p.unlock));
  const zones = ZONES.filter((z) => isZoneOpen(s, z) && z.D >= 2);
  if (!profs.length || !zones.length) return false;
  s.rescue = { zone: pick(zones).id, prof: pick(profs).id, deadline: now + ms(10 * HOUR) };
  return true;
}

/** 구조 신호가 온 구역으로 탐사대를 보낸다. 성공하면 그 사람이 합류한다. */
export function startRescue(s: State, members: string[], now: number): StartResult {
  const r = s.rescue;
  if (!r) return { ok: false, error: '구조 신호가 없어요.' };
  if (r.deadline <= now) return { ok: false, error: '신호가 끊겼어요.' };
  if (s.exps.some((e) => e.rescue)) return { ok: false, error: '이미 구조대가 나가 있어요.' };
  if (freeBeds(s) <= 0 && !s.visitor) return { ok: false, error: '침대가 없어요. 층을 넓히세요.' };
  const res = startExpedition(s, r.zone, members, now);
  if (res.ok) res.exp.rescue = r.prof;
  return res;
}

// ---------- 층 돌파 ----------

/** 다음 층으로 가는 문을 뚫을 때 몰려오는 좀비의 힘 (층마다 세진다) */
export const BREACH_POWER = [0, 8, 16, 26, 38];

export interface BreachPreview {
  power: number;
  defense: number;
  cost: number;
  name: string;
  /** 지금 방어력으로 성공할 확률 (0~1) */
  chance: number;
  /** 운이 가장 나빠도 이기려면 방어력이 얼마나 더 필요한가 (0이면 확실) */
  needMore: number;
}

/** 판정은 방어력 x (0.85~1.15 무작위) >= 상대 힘. 그 확률. */
export function breachChance(defense: number, power: number): number {
  if (defense <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - (power / defense - 0.85) / 0.3));
}
export function previewBreach(s: State, now: number): BreachPreview | null {
  const nx = nextFloor(s);
  if (!nx) return null;
  const power = BREACH_POWER[s.floor + 1] ?? 50;
  const def = defense(s, now);
  return {
    power,
    defense: def,
    cost: nx.cost,
    name: FLOORS[s.floor + 1].name,
    chance: breachChance(def, power),
    needMore: Math.max(0, Math.ceil(power / 0.85 - def)),
  };
}

export type BreachResult =
  | { ok: false; error: string }
  | { ok: true; win: boolean; power: number; roll: number; lostCaps: number; dead: Gone[]; hurt: string[] };

export function breachFloor(s: State, now: number): BreachResult {
  const pv = previewBreach(s, now);
  if (!pv || s.over) return { ok: false, error: '더 넓힐 층이 없어요.' };
  if (s.caps < pv.cost) return { ok: false, error: '병마개가 모자라요.' };
  const roll = Math.round(pv.defense * (0.85 + 0.3 * rand()) * 10) / 10;
  const guards = guardsHere(s, now);
  const dead: Gone[] = [];
  const hurt: string[] = [];
  if (roll >= pv.power) {
    s.caps -= pv.cost;
    s.floor += 1;
    s.log.breaches += 1;
    for (const g of guards) if (rand() < 0.2) {
      s.tired[g] = now + ms(240000);
      hurt.push(g);
    }
    return { ok: true, win: true, power: pv.power, roll, lostCaps: pv.cost, dead, hurt };
  }
  // 실패: 공사비의 60%를 날리고, 막던 사람이 다칠 수 있다
  const lost = Math.round(pv.cost * 0.6);
  s.caps -= lost;
  for (const g of guards) if (rand() < 0.5) {
    s.tired[g] = now + ms(360000);
    hurt.push(g);
  }
  if (guards.length && rand() < 0.2) {
    const id = pick(guards);
    const gone = killPerson(s, id, 'breach', lastWordsOf(s, id), '돌파 중 쓰러졌다', now);
    if (gone) dead.push(gone);
  }
  return { ok: true, win: false, power: pv.power, roll, lostCaps: lost, dead, hurt };
}

// ---------- 시간이 흐른다 ----------

export type Notice =
  | { type: 'raid' }
  | { type: 'raid_auto'; result: RaidResult }
  | { type: 'merchant' }
  | { type: 'merchant_left' }
  | { type: 'sick'; id: string }
  | { type: 'sick_death'; gone: Gone }
  | { type: 'rescue' }
  | { type: 'rescue_lost' }
  | { type: 'guide_done' };

const later = (hours: number): number => ms((hours + 0) * HOUR);

/** 사건이 생기거나 끝났는지 본다. tick 직후에 부르면 된다. */
export function tickEvents(s: State, now: number): Notice[] {
  const out: Notice[] = [];
  if (s.over) return out;
  const day = dayNumber(s, now);

  // 첫날 안내: 첫 탐사를 보내면 상인이 금방 지나가게 해서 기다리는 시간을 채운다
  if (!s.guide.done) {
    if (!s.guide.seeded && s.exps.length > 0) {
      s.guide.seeded = true;
      if (!s.merchant) s.nextMerchant = Math.min(s.nextMerchant, now + ms(60000));
    }
    if (guideSteps(s).every((g) => g.done)) {
      s.guide.done = true;
      s.res.food += 10;
      s.res.water += 10;
      s.res.med += 2;
      out.push({ type: 'guide_done' });
    }
  }

  // 습격
  if (s.raid && now >= s.raid.deadline) {
    const r = resolveRaid(s, s.raid.kind === 'raider' ? 'pay' : 'fight', now, true);
    if (r) out.push({ type: 'raid_auto', result: r });
  }
  if (!s.raid && now >= s.nextRaid && !s.over) {
    if (s.crew.length >= 2 && day >= 2) {
      spawnRaid(s, now);
      out.push({ type: 'raid' });
      s.nextRaid = now + later((10 + rand() * 8) * (s.rep.raider >= 3 ? 1.5 : 1));
    } else {
      s.nextRaid = now + later(2);
    }
  }
  if (s.over) return out;

  // 상인
  if (s.merchant && s.merchant.until <= now) {
    s.merchant = null;
    out.push({ type: 'merchant_left' });
  }
  if (!s.merchant && now >= s.nextMerchant) {
    spawnMerchant(s, now);
    out.push({ type: 'merchant' });
    s.nextMerchant = now + later((8 + rand() * 6) / (1 + 0.1 * Math.max(0, s.rep.market)));
  }

  // 질병: 방치하면 죽고, 절반쯤 지나면 옆 사람에게 옮는다
  for (const id of Object.keys(s.sick)) {
    const sk = s.sick[id];
    if (!s.crew.includes(id)) {
      delete s.sick[id];
      continue;
    }
    const dur = ms((hasTrait(s, 'healer') ? 18 : 12) * HOUR);
    if (now >= sk.deadline) {
      s.log.sickDeaths += 1;
      const gone = killPerson(s, id, 'sick', lastWordsOf(s, id), '병을 이기지 못했다', now);
      if (gone) out.push({ type: 'sick_death', gone });
    } else if (!sk.spread && sk.deadline - now <= dur / 2) {
      sk.spread = true;
      const pool = s.crew.filter((c) => !isSick(s, c) && c !== id);
      if (pool.length && rand() < 0.5) {
        const c = pick(pool);
        s.sick[c] = { deadline: now + dur };
        out.push({ type: 'sick', id: c });
      }
    }
  }
  if (now >= s.nextSick) {
    s.nextSick = now + later(14 + rand() * 8);
    if (s.crew.length >= 2) {
      const id = spawnSick(s, now);
      if (id) out.push({ type: 'sick', id });
    }
  }

  // 구조 신호
  if (s.rescue && s.rescue.deadline <= now && !s.exps.some((e) => e.rescue)) {
    s.rescue = null;
    out.push({ type: 'rescue_lost' });
  }
  if (!s.rescue && now >= s.nextRescue) {
    s.nextRescue = now + later(16 + rand() * 8);
    if (s.crew.length >= 1 && day >= 3 && freeBeds(s) > 0 && spawnRescue(s, now)) out.push({ type: 'rescue' });
  }
  return out;
}
