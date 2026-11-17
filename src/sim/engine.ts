import {
  AREAS, DAY_MS, YEAR_DAYS, FACILITY_DEFS, MAX_FACILITY_LEVEL, RATION_BASE, RECRUIT_NAMED, STARTING_NAMED, TITLES,
  fromSeed, makeNormal, upgradeCost, xpToNext, type AreaDef, type FacilityDef,
} from './data';
import {
  RES_KEYS, type BodyPart, type Commander, type Exception, type FacilityId, type Game, type LogEntry, type LogKind,
  type RationPolicy, type ResKey, type Rng, type Stock, type Survivor,
} from './types';
import {
  alive, atBunker, byId, capacity, clamp, makeSay, workersOf, type ActionResult,
} from './core';
import { bodyFactor, canTravel, healWounds, hpPenalty, injure, PROSTHETIC, woundOn } from './body';
import { killSurvivor, mentalBreaks, mourn, updateBonds, updateStress } from './mind';
import { resolveEvent, rollStory } from './story';

export { alive, atBunker, byId, capacity, workersOf };
export type { ActionResult };

/**
 * 게임 규칙 전부. 화면과 상관없이 동작하는 순수 계산이다.
 * ⚠ 지금은 브라우저에서 계산·저장한다. 이후 서버(Supabase)에서 같은 규칙으로 검증한다.
 */

const facilityDef = (id: FacilityId): FacilityDef => FACILITY_DEFS.find((f) => f.id === id) as FacilityDef;

// ───────── 새 게임 ─────────

export function newGame(
  commander: Pick<Commander, 'nickname' | 'background' | 'command' | 'logistics' | 'analysis'>,
  rng: Rng = Math.random, now: number = Date.now(), dayMs: number = DAY_MS,
): Game {
  const facilities = {} as Record<FacilityId, number>;
  for (const f of FACILITY_DEFS) facilities[f.id] = f.unlock === null ? 1 : 0;

  const han = fromSeed(STARTING_NAMED[0]);
  const choi = fromSeed(STARTING_NAMED[1]);
  const a = makeNormal('s1', rng, 'laborer', 1);
  const b = makeNormal('s2', rng, 'farmer', 1);

  const g: Game = {
    version: 5,
    day: 1,
    clock: { last: now, carry: 0, dayMs },
    chronicle: [{ day: 1, text: '정착지 가동 시작.' }],
    collapses: 0,
    commander: { ...commander, level: 1, xp: 0 },
    tally: { ruthless: 0, mercy: 0, efficient: 0, idleDays: 0 },
    title: '신임 관리자',
    stock: { food: 60, water: 60, power: 80, medicine: 10, scrap: 80 },
    facilities,
    survivors: [han, choi, a, b],
    policy: 'equal',
    expeditions: [],
    cleared: {},
    pending: null,
    story: { next: 4, recent: [] },
    serum: null,
    critical: {},
    obituaries: [],
    log: [{ day: 1, kind: 'info', text: '단말기 접속. 벙커 전력 복구 완료. 생존자 4명 확인.' }],
    nextId: 3,
    touched: false,
  };
  autoAssign(g);
  return g;
}

// ───────── 조회 ─────────


export type FacilityState = 'locked' | 'idle' | 'active';
export function facilityState(g: Game, id: FacilityId): FacilityState {
  if (g.facilities[id] <= 0) return 'locked';
  return workersOf(g, id).length > 0 ? 'active' : 'idle';
}

export interface Condition {
  text: string;
  met: boolean;
}

export function unlockConditions(g: Game, id: FacilityId): Condition[] {
  const rule = facilityDef(id).unlock;
  if (!rule) return [];
  const list: Condition[] = [{ text: `지휘 Lv.${rule.command}`, met: g.commander.level >= rule.command }];
  if (rule.prev) {
    list.push({ text: `${facilityDef(rule.prev.id).name} Lv.${rule.prev.level}`, met: g.facilities[rule.prev.id] >= rule.prev.level });
  }
  list.push({ text: `고철 ${rule.scrap}`, met: g.stock.scrap >= rule.scrap });
  return list;
}

// ───────── 칭호와 보정 ─────────

/** 누적 성향으로 사령관 별명을 판정한다. (7일 이전에는 판독하지 않는다) */
export function evaluateTitle(g: Game): string {
  const { ruthless: r, mercy: m, efficient: e, idleDays } = g.tally;
  if (g.day < 7) return '신임 관리자';
  if (idleDays >= 6 && idleDays / g.day >= 0.5) return '방관자';
  if (r >= 15 && e >= 15) return '철혈의 독재자';
  if (r >= 15) return '냉혈한';
  if (e >= 15 && r >= 5) return '비정한 회계사';
  if (e >= 15) return '노련한 여우';
  if (m >= 15) return '위태로운 성자';
  return '신임 관리자';
}

export interface Mods {
  consumption: number;
  production: number;
  stress: number;
  loot: number;
  risk: number;
  loyalty: number;
}

export function modifiers(g: Game): Mods {
  const t = TITLES[g.title] ?? TITLES['신임 관리자'];
  const c = g.commander;
  return {
    consumption: (1 - 0.02 * (c.logistics - 5)) * t.consumption,
    production: (1 + 0.02 * (c.logistics - 5)) * t.production,
    stress: (1 - 0.03 * (c.command - 5)) * t.stress,
    loot: (1 + 0.02 * (c.analysis - 5)) * t.loot,
    risk: 1 - 0.03 * (c.analysis - 5),
    loyalty: t.loyalty,
  };
}

// ───────── 일일 수지 예상 ─────────

const skillFactor = (s: Survivor): number => (0.7 + 0.1 * s.skill) * (s.status === 'ok' ? 1 : 0.6) * bodyFactor(s);

function rationFactor(g: Game, s: Survivor): number {
  if (s.exception === 'withhold') return 0;
  if (s.exception === 'special') return 1.5;
  if (g.policy === 'emergency') return 0.5;
  if (g.policy === 'merit') {
    if (s.named || s.skill >= 4) return 1.25;
    if (s.skill <= 2) return 0.6;
  }
  return 1;
}

const isAce = (s: Survivor): boolean => s.named || s.skill >= 4;

/** 오늘 정산했을 때 자원이 얼마나 늘고 줄지 대략 계산한다. (화면 표시용, 상태는 바꾸지 않는다) */
export function forecast(g: Game): { net: Stock; produce: Stock; eat: Stock; offline: string[] } {
  const stock: Stock = { ...g.stock };
  const produce: Stock = { food: 0, water: 0, power: 0, medicine: 0, scrap: 0 };
  const offline: string[] = [];
  produceAll(g, stock, produce, offline, null);
  const eat: Stock = { food: 0, water: 0, power: 0, medicine: 0, scrap: 0 };
  const m = modifiers(g);
  for (const s of atBunker(g)) {
    const need = RATION_BASE * rationFactor(g, s) * m.consumption;
    eat.food += need;
    eat.water += need;
  }
  const net: Stock = { food: 0, water: 0, power: 0, medicine: 0, scrap: 0 };
  for (const k of RES_KEYS) net[k] = Math.round(stock[k] - g.stock[k] - eat[k]);
  return { net, produce, eat, offline };
}

/** 시설 생산·가동 비용 처리. 맡은 사람이 있고 비용을 낼 수 있는 시설만 돌아간다. */
function produceAll(g: Game, stock: Stock, produced: Stock, offline: string[], say: ((k: LogKind, t: string) => void) | null): void {
  const m = modifiers(g);
  for (const def of FACILITY_DEFS) {
    const level = g.facilities[def.id];
    if (level <= 0) continue;
    const workers = workersOf(g, def.id);
    if (workers.length === 0) continue;
    const lacking = RES_KEYS.filter((k) => (def.upkeep[k] ?? 0) > stock[k]);
    if (lacking.length > 0) {
      offline.push(def.name);
      say?.('warn', `${def.name} 가동 중지: ${lacking.map(resLabel).join('·')} 부족.`);
      continue;
    }
    for (const k of RES_KEYS) stock[k] -= def.upkeep[k] ?? 0;
    const factor = workers.reduce((sum, w) => sum + skillFactor(w), 0) / workers.length;
    for (const k of RES_KEYS) {
      const base = def.produce[k];
      if (!base) continue;
      const amount = Math.round(base * (1 + 0.5 * (level - 1)) * factor * m.production);
      stock[k] += amount;
      produced[k] += amount;
    }
  }
}

export const resLabel = (k: ResKey): string => ({ food: '식량', water: '식수', power: '전력', medicine: '의약품', scrap: '고철' })[k];

// ───────── 플레이어 조작 ─────────

const fail = (message: string): ActionResult => ({ ok: false, message });
const done = (g: Game, message: string): ActionResult => {
  g.touched = true;
  return { ok: true, message };
};

export function setPolicy(g: Game, policy: RationPolicy): ActionResult {
  if (g.policy === policy) return fail('이미 적용 중인 정책입니다.');
  g.policy = policy;
  return done(g, '배급 정책을 변경했습니다. 다음 정산부터 적용됩니다.');
}

export function setException(g: Game, id: string, ex: Exception): ActionResult {
  const s = byId(g, id);
  if (!s || s.status === 'dead') return fail('대상을 찾을 수 없습니다.');
  s.exception = ex;
  if (ex === 'special') g.tally.mercy += 2;
  if (ex === 'withhold') g.tally.ruthless += 2;
  return done(g, ex === 'special' ? `${s.name}: 특식 지급 지정.` : ex === 'withhold' ? `${s.name}: 배급 제외 지정.` : `${s.name}: 예외 해제.`);
}

export function assign(g: Game, id: string, post: FacilityId | null): ActionResult {
  const s = byId(g, id);
  if (!s || s.status === 'dead' || s.status === 'away' || s.status === 'critical') return fail('지금은 배치할 수 없습니다.');
  if (post) {
    if (g.facilities[post] <= 0) return fail('아직 개방되지 않은 시설입니다.');
    for (const other of g.survivors) if (other.post === post && other.id !== id) other.post = null;
  }
  s.post = post;
  s.auto = false;
  return done(g, post ? `${s.name}: ${facilityDef(post).name} 배치.` : `${s.name}: 대기 전환.`);
}

// ───────── 작업 우선순위와 자동 배치 ─────────

/** 기본 시설들이 먼저 돌아가도록 하는 중요도 */
const FACILITY_WEIGHT: Record<FacilityId, number> = {
  power_plant: 3, water_purifier: 3, farm: 3, medical: 2, dormitory: 2, workshop: 1, laboratory: 1, armory: 1,
};

/**
 * 자동 배치 대상 인원을 우선순위 표대로 시설에 앉힌다.
 * 직접 배치한 인원(auto 꺼짐)의 시설은 건드리지 않는다.
 */
export function autoAssign(g: Game): void {
  const open = FACILITY_DEFS.filter((d) => g.facilities[d.id] > 0).map((d) => d.id);
  const held = new Set<FacilityId>();
  for (const s of atBunker(g)) if (!s.auto && s.post && open.includes(s.post)) held.add(s.post);
  const pool = atBunker(g).filter((s) => s.auto && s.status !== 'critical');
  const pairs: { s: Survivor; f: FacilityId; score: number }[] = [];
  for (const s of pool) {
    for (const f of open) {
      const pr = s.prio[f] ?? 3;
      if (held.has(f) || pr <= 0) continue;
      pairs.push({ s, f, score: FACILITY_WEIGHT[f] * 20 + (5 - pr) * 8 + s.skill * 3 + (s.post === f ? 10 : 0) });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  const usedS = new Set<string>();
  const usedF = new Set<FacilityId>();
  for (const s of pool) s.post = null;
  for (const p of pairs) {
    if (usedS.has(p.s.id) || usedF.has(p.f)) continue;
    p.s.post = p.f;
    usedS.add(p.s.id);
    usedF.add(p.f);
  }
}

export function setPrio(g: Game, id: string, facility: FacilityId, value: number): ActionResult {
  const s = byId(g, id);
  if (!s || s.status === 'dead') return fail('대상을 찾을 수 없습니다.');
  s.prio[facility] = clamp(Math.round(value), 0, 4);
  if (s.auto) autoAssign(g);
  return done(g, `${s.name}: ${facilityDef(facility).name} 우선순위 ${s.prio[facility] === 0 ? '제외' : s.prio[facility]}.`);
}

export function setAuto(g: Game, id: string, auto: boolean): ActionResult {
  const s = byId(g, id);
  if (!s || s.status === 'dead') return fail('대상을 찾을 수 없습니다.');
  s.auto = auto;
  if (auto) autoAssign(g);
  return done(g, auto ? `${s.name}: 우선순위 표대로 자동 배치.` : `${s.name}: 직접 배치로 전환.`);
}

/** 공방에서 잃은 팔다리를 의수·의족으로 대신한다 */
export function craftProsthetic(g: Game, id: string, part: BodyPart): ActionResult {
  const s = byId(g, id);
  if (!s || s.status === 'dead' || s.status === 'away') return fail('지금은 제작할 수 없습니다.');
  const w = woundOn(s, part);
  if (!w || w.kind !== 'lost') return fail('잃은 부위가 아닙니다.');
  if (g.facilities.workshop < PROSTHETIC.workshop || workersOf(g, 'workshop').length === 0) {
    return fail(`공방 Lv.${PROSTHETIC.workshop} 이상에 담당자가 있어야 합니다.`);
  }
  if (g.stock.scrap < PROSTHETIC.scrap || g.stock.medicine < PROSTHETIC.medicine) {
    return fail(`고철 ${PROSTHETIC.scrap}·의약품 ${PROSTHETIC.medicine}이(가) 필요합니다.`);
  }
  g.stock.scrap -= PROSTHETIC.scrap;
  g.stock.medicine -= PROSTHETIC.medicine;
  w.kind = 'prosthetic';
  g.tally.mercy += 1;
  g.log.push({ day: g.day, kind: 'good', text: `${s.name}에게 의수·의족을 달아 주었습니다.` });
  return done(g, `${s.name}: 의수·의족 장착 완료.`);
}

/** 사건 결정을 처리한다 */
export function resolveDecision(g: Game, choice: string, rng: Rng = Math.random): ActionResult {
  const r = resolveEvent(g, choice, rng, makeSay(g));
  if (r.ok) g.touched = true;
  return r;
}

export function unlockFacility(g: Game, id: FacilityId): ActionResult {
  if (g.facilities[id] > 0) return fail('이미 개방된 시설입니다.');
  const rule = facilityDef(id).unlock;
  if (!rule) return fail('이미 개방된 시설입니다.');
  if (!unlockConditions(g, id).every((c) => c.met)) return fail('개방 조건을 충족하지 못했습니다.');
  g.stock.scrap -= rule.scrap;
  g.facilities[id] = 1;
  return done(g, `${facilityDef(id).name} 복구 완료. 담당자를 배치해야 가동됩니다.`);
}

export function upgradeFacility(g: Game, id: FacilityId): ActionResult {
  const level = g.facilities[id];
  if (level <= 0) return fail('개방되지 않은 시설입니다.');
  if (level >= MAX_FACILITY_LEVEL) return fail('이미 최고 레벨입니다.');
  const cost = upgradeCost(level);
  if (g.stock.scrap < cost) return fail(`고철이 부족합니다. (필요 ${cost})`);
  g.stock.scrap -= cost;
  g.facilities[id] = level + 1;
  return done(g, `${facilityDef(id).name} Lv.${level + 1} 확장 완료.`);
}

// ───────── 원정 ─────────

export interface ExpeditionPlan {
  /** 팀 전력 대비 위험 비율. 1 이상이면 안정적 */
  ratio: number;
  /** 팀원 1명당 사망 확률 (0~1) */
  death: number;
  injure: number;
}

function expeditionOdds(g: Game, area: AreaDef, members: Survivor[]): ExpeditionPlan {
  const power = members.reduce((sum, s) => sum + 10 * s.skill * (0.5 + 0.5 * (s.hp / 100)) * bodyFactor(s), 0);
  const ratio = power / (area.danger + 10);
  let death = (0.3 * (area.danger / 100)) / Math.max(0.3, ratio);
  const armory = workersOf(g, 'armory').length > 0 ? g.facilities.armory : 0;
  death *= (1 - 0.08 * armory) * modifiers(g).risk;
  death = clamp(death, 0, 0.6);
  return { ratio, death, injure: clamp(death * 1.6, 0, 0.7) };
}

/** 위험도 표시: 연구실에 담당자가 있으면 수치, 없으면 등급 */
export function dangerLabel(g: Game, area: AreaDef, members: Survivor[]): string {
  if (members.length === 0) return `위험도 ${area.danger >= 60 ? '높음' : area.danger >= 35 ? '보통' : '낮음'}`;
  const odds = expeditionOdds(g, area, members);
  if (workersOf(g, 'laboratory').length > 0) return `1인당 사망 ${Math.round(odds.death * 100)}% · 부상 ${Math.round(odds.injure * 100)}%`;
  return odds.ratio >= 1.4 ? '전력 충분' : odds.ratio >= 0.9 ? '전력 보통' : '전력 부족';
}

export function startExpedition(g: Game, areaId: string, memberIds: string[]): ActionResult {
  const area = AREAS.find((a) => a.id === areaId);
  if (!area) return fail('지역을 찾을 수 없습니다.');
  if (g.commander.level < area.command) return fail(`지휘 Lv.${area.command} 필요.`);
  if (memberIds.length === 0 || memberIds.length > 3) return fail('1~3명을 선택하세요.');
  if (g.expeditions.some((e) => e.areaId === areaId)) return fail('이미 이 지역으로 파견 중입니다.');
  const members = memberIds.map((id) => byId(g, id));
  if (members.some((s) => !s || s.status !== 'ok')) return fail('건강한 인원만 파견할 수 있습니다.');
  if (members.some((s) => s && (!canTravel(s) || s.breakUntil !== undefined && s.breakUntil >= g.day))) return fail('원정을 나갈 수 없는 몸 상태입니다.');
  for (const s of members as Survivor[]) {
    s.status = 'away';
    s.post = null;
  }
  g.expeditions.push({ areaId, members: memberIds, returnDay: g.day + area.days });
  if (area.danger >= 60) g.tally.ruthless += 1;
  return done(g, `${area.name}으로 ${members.length}명 파견. ${area.days}일 후 귀환 예정.`);
}

// ───────── 세럼 딜레마 ─────────

/** survivorId 를 보내면 세럼 확보 작전, null 이면 에이스를 포기한다. */
export function resolveSerum(g: Game, survivorId: string | null): ActionResult {
  const p = g.pending;
  if (!p || p.kind !== 'serum') return fail('결정할 사안이 없습니다.');
  const ace = byId(g, p.aceId);
  if (!ace) {
    g.pending = null;
    return fail('대상이 없습니다.');
  }
  if (survivorId === null) {
    g.critical[ace.id] = g.day + 2;
    g.pending = null;
    g.tally.mercy += 2;
    g.tally.efficient = Math.max(0, g.tally.efficient - 1);
    g.log.push({ day: g.day, kind: 'bad', text: `${ace.name} 치료 포기 결정. 약 이틀을 넘기지 못할 것으로 보임.` });
    return done(g, '치료를 포기했습니다.');
  }
  const messenger = byId(g, survivorId);
  if (!messenger || messenger.status !== 'ok' || messenger.id === ace.id) return fail('파견할 수 없는 인원입니다.');
  messenger.status = 'away';
  messenger.post = null;
  g.serum = { survivorId: messenger.id, aceId: ace.id, dueDay: g.day + 2 };
  g.pending = null;
  g.tally.ruthless += 3;
  g.tally.efficient += 2;
  g.log.push({ day: g.day, kind: 'warn', text: `${messenger.name}을(를) 특수 세럼 확보 작전에 파견. ${ace.name}은(는) 격리 중.` });
  return done(g, '세럼 확보 작전을 개시했습니다.');
}

// ───────── 하루 정산 ─────────

export interface DayResult {
  entries: LogEntry[];
  /** 정산 후 새로 생긴 결정 사안이 있는지 */
  decision: boolean;
}

export function endDay(g: Game, rng: Rng = Math.random): DayResult {
  const entries: LogEntry[] = [];
  if (g.pending) return { entries, decision: false };
  autoAssign(g);
  const say = makeSay(g, entries);
  const mods = modifiers(g);
  const kill = (s: Survivor, cause: string): void => killSurvivor(g, s, cause, rng, say);

  // 1. 시설 가동
  const produced: Stock = { food: 0, water: 0, power: 0, medicine: 0, scrap: 0 };
  produceAll(g, g.stock, produced, [], say);
  const summary = RES_KEYS.filter((k) => produced[k] > 0).map((k) => `${resLabel(k)} +${produced[k]}`).join(' · ');
  if (summary) say('info', `생산: ${summary}`);

  // 2. 원정 귀환
  for (const exp of [...g.expeditions]) {
    if (exp.returnDay > g.day + 1) continue;
    g.expeditions.splice(g.expeditions.indexOf(exp), 1);
    resolveExpedition(g, exp.areaId, exp.members, rng, say, kill);
  }

  // 3. 세럼 작전
  if (g.serum && g.serum.dueDay <= g.day + 1) {
    const s = g.serum;
    g.serum = null;
    const messenger = byId(g, s.survivorId);
    const ace = byId(g, s.aceId);
    const lab = workersOf(g, 'laboratory').length > 0 ? g.facilities.laboratory : 0;
    const chance = clamp(0.45 + 0.04 * (g.commander.analysis - 5) + 0.06 * lab, 0.2, 0.85);
    if (messenger && messenger.status === 'away') {
      if (rng() < chance) {
        messenger.status = 'injured';
        messenger.hp = Math.max(25, messenger.hp - 40);
        if (ace && ace.status === 'critical') {
          ace.status = 'ok';
          ace.hp = Math.max(ace.hp, 50);
          delete g.critical[ace.id];
          say('good', `${messenger.name}이(가) 특수 세럼을 확보해 귀환했습니다. ${ace.name}의 증세가 안정됩니다.`);
        }
      } else {
        kill(messenger, '원정 중 실종');
        say('bad', '세럼 확보 작전 실패. 교신이 끊겼습니다.');
      }
    }
  }

  // 4. 배급
  const eaters = atBunker(g).filter((s) => s.status !== 'critical' || true);
  const need = (s: Survivor): number => RATION_BASE * rationFactor(g, s) * mods.consumption;
  const order = g.policy === 'merit'
    ? [...eaters].sort((a, b) => Number(isAce(b)) - Number(isAce(a)))
    : eaters;
  const got = new Map<string, { food: number; water: number }>();
  for (const key of ['food', 'water'] as const) {
    const total = order.reduce((sum, s) => sum + need(s), 0);
    let left = g.stock[key];
    const ratio = total > 0 ? Math.min(1, left / total) : 1;
    for (const s of order) {
      const want = need(s);
      const give = g.policy === 'merit' ? Math.min(want, left) : want * ratio;
      left -= give;
      const rec = got.get(s.id) ?? { food: 0, water: 0 };
      rec[key] = give;
      got.set(s.id, rec);
    }
    const used = g.stock[key] - left;
    g.stock[key] = Math.max(0, Math.round((g.stock[key] - used) * 100) / 100);
    if (ratio < 1) say('warn', `${resLabel(key)} 부족: 필요량의 ${Math.round(ratio * 100)}%만 배급됐습니다.`);
  }
  g.stock.food = Math.round(g.stock.food);
  g.stock.water = Math.round(g.stock.water);

  // 5. 의무실 치료
  const medical = facilityState(g, 'medical') === 'active' && g.stock.power >= 0;
  if (medical) {
    let slots = g.facilities.medical * 2;
    for (const s of eaters.filter((x) => x.status === 'sick' || x.status === 'injured')) {
      if (slots <= 0 || g.stock.medicine < 1) break;
      g.stock.medicine -= 1;
      slots -= 1;
      if (s.status === 'sick') {
        s.status = 'ok';
        say('good', `${s.name}: 치료 완료.`);
      } else {
        s.hp = Math.min(100, s.hp + 15);
        if (s.hp >= 60) s.status = 'ok';
        say('info', `${s.name}: 상처 치료.`);
      }
    }
  }

  // 6. 개인 상태 갱신
  const withheld = eaters.filter((s) => s.exception === 'withhold').length;
  const dormStaffed = facilityState(g, 'dormitory') === 'active';
  for (const s of eaters) {
    const rec = got.get(s.id) ?? { food: RATION_BASE, water: RATION_BASE };
    const rf = clamp(rec.food / RATION_BASE, 0, 1);
    const rw = clamp(rec.water / RATION_BASE, 0, 1);
    const low = !isAce(s) && s.skill <= 2;
    const ace = isAce(s);

    // 노화: 나이가 들수록 체력 상한이 내려가고 병에 약해진다 (⚠ 임시 수치)
    s.age += 1 / YEAR_DAYS;
    const hpMax = Math.max(40, 100 - Math.max(0, s.age - 60) * 1.5 - hpPenalty(s));
    for (const note of healWounds(s, rng, g.day)) say('warn', `${s.name}: ${note}.`);
    const agePenalty = Math.max(0, s.age - 55) * 0.002;

    // 체력
    if (s.status === 'critical') {
      // 치명적 질병: 체력은 유지, 기한 안에 치료하지 못하면 사망 (아래에서 처리)
    } else {
      const deficit = (1 - rf) * 8 + (1 - rw) * 12;
      s.hp = clamp(s.hp + (deficit <= 0 ? 2 : -deficit), 0, hpMax);
      if (s.status === 'sick') s.hp = clamp(s.hp - 5, 0, 100);
      if (s.status === 'injured') s.hp = clamp(s.hp + 3, 0, 100);
      if (s.status === 'injured' && s.hp >= 70) s.status = 'ok';
      if (s.status === 'sick' && rng() < 0.2) {
        s.status = 'ok';
        say('good', `${s.name}: 자연 회복.`);
      }
      // 발병
      const sickChance = 0.02 + 0.05 * (1 - Math.min(rf, rw)) + (g.policy === 'emergency' ? 0.03 : 0) + (s.stress >= 70 ? 0.02 : 0) + agePenalty;
      if (s.status === 'ok' && rng() < sickChance) {
        s.status = 'sick';
        say('warn', `${s.name}: 발열·기침 증세. 질병 의심.`);
      }
    }

    // 스트레스: 오늘의 생각들이 가리키는 목표치로 움직인다
    updateStress(g, s, {
      rf, rw, stressMod: mods.stress, withheld, dormStaffed, dormLevel: g.facilities.dormitory, low, ace,
    });

    // 충성도
    let loy = 0;
    if (rf >= 1 && rw >= 1 && s.stress < 60) loy += 1;
    if (s.stress >= 70) loy -= 2;
    if (g.policy === 'emergency') loy -= 3;
    if (g.policy === 'merit') loy += low ? -3 : ace ? 2 : 0;
    if (s.exception === 'special') loy += 4;
    if (s.exception === 'withhold') loy -= 8;
    loy -= (1 - Math.min(rf, rw)) * 5;
    loy += mods.loyalty;
    s.loyalty = clamp(s.loyalty + loy, 0, 100);
  }

  // 7. 사망 판정
  for (const s of eaters) {
    if (s.status === 'dead') continue;
    const due = g.critical[s.id];
    if (due !== undefined && due <= g.day + 1 && !(g.serum && g.serum.aceId === s.id)) {
      kill(s, '치명적 질병');
      continue;
    }
    if (s.hp <= 0) {
      const rec = got.get(s.id);
      const cause = rec && rec.water / RATION_BASE < 0.5 ? '탈수' : rec && rec.food / RATION_BASE < 0.5 ? '아사'
        : s.status === 'sick' ? '질병' : s.status === 'injured' ? '부상 악화' : '쇠약';
      kill(s, cause);
    }
  }

  // 7b. 노령 사망: 고령에만 아주 낮은 확률로 시작해 천천히 올라간다
  for (const s of atBunker(g)) {
    if (s.age >= 70 && rng() < 0.00002 * (s.age - 69) ** 2) kill(s, '노령');
  }

  // 8. 관계 변화와 정신 붕괴, 야반도주
  updateBonds(g, rng, say);
  mentalBreaks(g, rng, say);
  for (const s of atBunker(g)) {
    if (s.stress >= 90 && s.loyalty <= 25 && rng() < 0.35) {
      const loot: Partial<Stock> = {
        food: Math.min(g.stock.food, 10), water: Math.min(g.stock.water, 10), scrap: Math.min(g.stock.scrap, 20),
      };
      for (const k of RES_KEYS) g.stock[k] -= loot[k] ?? 0;
      s.status = 'dead';
      s.post = null;
      g.obituaries.push({ day: g.day, name: s.name, job: s.job, named: s.named, cause: '야반도주 (자원 탈취)', last: '(기록 없음)', age: Math.floor(s.age), served: g.day - s.joined, memorial: false });
      say('bad', `[이탈] ${s.name}이(가) 식량·식수·고철을 챙겨 야반도주했습니다.`);
      mourn(g, s);
    }
  }

  // 10. 성향·경험치·칭호
  if (g.policy === 'equal') g.tally.mercy += 0.5;
  if (g.policy === 'merit') {
    g.tally.efficient += 1.5;
    g.tally.ruthless += 0.5;
  }
  if (g.policy === 'emergency') {
    g.tally.ruthless += 1.5;
    g.tally.efficient += 1;
  }
  g.tally.ruthless += 2 * atBunker(g).filter((s) => s.exception === 'withhold').length;
  if (!g.touched) g.tally.idleDays += 1;
  g.touched = false;

  g.day += 1;
  g.commander.xp += 8;
  while (g.commander.xp >= xpToNext(g.commander.level)) {
    g.commander.xp -= xpToNext(g.commander.level);
    g.commander.level += 1;
    say('good', `지휘 레벨 상승: Lv.${g.commander.level}`);
  }
  const title = evaluateTitle(g);
  if (title !== g.title) {
    g.title = title;
    say('info', `단말기 판독: 사령관 성향 "${title}" — ${TITLES[title].passive}`);
  }

  // 11. 붕괴: 전멸하거나 폭동이 나면 정착지가 무너지고 폐허에서 재건한다
  const here = atBunker(g);
  const rebels = here.filter((s) => s.stress >= 85 && s.loyalty <= 30).length;
  if (alive(g).length === 0) {
    collapse(g, '전멸', '생존자 전원 사망. 벙커의 불이 꺼졌습니다.', say, rng);
    return { entries, decision: false };
  }
  if (here.length >= 3 && rebels >= Math.max(2, Math.ceil(here.length / 2))) {
    collapse(g, '폭동', '착취와 불신이 폭동으로 번졌습니다. 생존자들이 벙커를 떠났습니다.', say, rng);
    return { entries, decision: false };
  }

  // 12. 새 결정 사안: 에이스의 치명적 질병
  if (g.day >= 5 && !g.pending && !g.serum && Object.keys(g.critical).length === 0 && rng() < 0.05) {
    const aces = atBunker(g).filter((s) => s.status === 'ok' && isAce(s));
    if (aces.length > 0) {
      const ace = aces[Math.floor(rng() * aces.length)];
      ace.status = 'critical';
      ace.post = null;
      g.critical[ace.id] = g.day + 4;
      g.pending = { kind: 'serum', aceId: ace.id };
      say('bad', `[경보] ${ace.name}: 치명적 질병. 일반 약품으로는 치료할 수 없습니다.`);
    }
  }

  // 13. 이야기꾼: 사건
  if (!g.pending) rollStory(g, rng, say);

  if (atBunker(g).length === 0 && g.expeditions.length === 0 && !g.serum) {
    collapse(g, '전멸', '벙커에 남은 인원이 없습니다.', say, rng);
    return { entries, decision: false };
  }
  return { entries, decision: g.pending !== null };
}

// ───────── 원정 결과 ─────────

function resolveExpedition(
  g: Game, areaId: string, memberIds: string[], rng: Rng,
  say: (k: LogKind, t: string) => void, kill: (s: Survivor, cause: string) => void,
): void {
  const area = AREAS.find((a) => a.id === areaId) as AreaDef;
  const members = memberIds.map((id) => byId(g, id)).filter((s): s is Survivor => !!s && s.status === 'away');
  const odds = expeditionOdds(g, area, members);
  const dead: string[] = [];
  const hurt: string[] = [];
  const back: Survivor[] = [];
  for (const s of members) {
    const roll = rng();
    if (roll < odds.death) {
      kill(s, '원정 중 실종');
      dead.push(s.name);
    } else if (roll < odds.death + odds.injure) {
      s.status = 'injured';
      s.hp = Math.max(20, s.hp - 35);
      const note = injure(s, rng, g.day, rng() < 0.3);
      hurt.push(note ? `${s.name}(${note})` : s.name);
      back.push(s);
    } else {
      s.status = 'ok';
      back.push(s);
    }
  }

  const workshop = workersOf(g, 'workshop').length > 0 ? g.facilities.workshop : 0;
  const scale = clamp(odds.ratio, 0.5, 1.5) * (0.8 + 0.4 * rng()) * modifiers(g).loot;
  const gained: string[] = [];
  if (back.length > 0 || dead.length === 0) {
    for (const k of RES_KEYS) {
      const range = area.loot[k];
      if (!range) continue;
      let amount = (range[0] + rng() * (range[1] - range[0])) * scale;
      if (k === 'scrap') amount *= 1 + 0.15 * workshop;
      const n = Math.round(amount);
      if (back.length === 0) continue;
      g.stock[k] += n;
      gained.push(`${resLabel(k)} +${n}`);
    }
  }
  g.commander.xp += Math.round(10 + area.danger / 5);
  g.cleared[area.id] = (g.cleared[area.id] ?? 0) + 1;

  const head = `[원정 귀환] ${area.name}`;
  if (back.length === 0) {
    say('bad', `${head}: 전원 귀환하지 못했습니다.`);
    return;
  }
  say(dead.length > 0 ? 'warn' : 'good',
    `${head}: ${gained.join(' · ') || '획득 없음'}${hurt.length ? ` · 부상 ${hurt.join(', ')}` : ''}${dead.length ? ` · 실종 ${dead.join(', ')}` : ''}`);

  // 생존자 발견
  const first = g.cleared[area.id] === 1;
  const waiting = area.named.filter((id) => !g.survivors.some((s) => s.id === id));
  let found: Survivor | null = null;
  let rescue = '';
  if (waiting.length > 0 && (first || rng() < 0.35)) {
    const seed = RECRUIT_NAMED[waiting[0]];
    found = fromSeed(seed, g.day);
    rescue = seed.rescue;
  } else if (rng() < area.recruit) {
    found = makeNormal(`s${g.nextId}`, rng, undefined, g.day);
    g.nextId += 1;
    rescue = '폐허에서 홀로 버티던 생존자.';
  }
  if (found) {
    if (alive(g).length >= capacity(g)) {
      say('warn', `생존자를 발견했지만 수용 공간이 없어 두고 왔습니다. (숙소 확장 필요)`);
    } else {
      g.survivors.push(found);
      say('good', `[신규 생존자] ${found.name} (${found.named ? '네임드' : '일반'}) — ${rescue}`);
    }
  }
}

// ───────── 붕괴와 재건 ─────────

/**
 * 정착지가 무너진다. 죽은 사람의 기록(전몰자 기록)과 연대기는 그대로 남고,
 * 폐허에서 소수의 새 생존자와 함께 다시 시작한다. (⚠ 재건 수치는 임시)
 */
function collapse(g: Game, cause: string, summary: string, say: (k: LogKind, t: string) => void, rng: Rng): void {
  say('bad', `[붕괴] ${cause}: ${summary}`);
  for (const s of alive(g)) {
    g.obituaries.push({
      day: g.day, name: s.name, job: s.job, named: s.named, cause: `${cause} 후 이탈`, last: '(기록 없음)',
      age: Math.floor(s.age), served: g.day - s.joined, memorial: false,
    });
  }
  g.collapses += 1;
  g.chronicle.push({ day: g.day, text: `${cause}: ${summary}` });
  g.stock = { food: 20, water: 20, power: 40, medicine: 0, scrap: 30 };
  for (const f of FACILITY_DEFS) g.facilities[f.id] = Math.max(f.unlock === null ? 1 : 0, g.facilities[f.id] - 2);
  g.expeditions = [];
  g.serum = null;
  g.pending = null;
  g.story = { next: g.day + 4, recent: [] };
  g.critical = {};
  g.survivors = [];
  const crew: [FacilityId, 'engineer' | 'laborer' | 'farmer'][] = [['power_plant', 'engineer'], ['water_purifier', 'laborer'], ['farm', 'farmer']];
  for (const [post, job] of crew) {
    const s = makeNormal(`s${g.nextId}`, rng, job, g.day);
    g.nextId += 1;
    s.post = post;
    g.survivors.push(s);
  }
  autoAssign(g);
  g.touched = true;
  const entry = { day: g.day, text: '폐허 속에서 생존자 3명이 모여 정착지를 다시 일으킵니다.' };
  g.chronicle.push(entry);
  say('info', `[재건] ${entry.text} 시설 일부가 파손되어 규모가 줄었습니다.`);
}

/** 기억할 사람으로 지정하거나 해제한다 */
export function setMemorial(g: Game, index: number): ActionResult {
  const o = g.obituaries[index];
  if (!o) return { ok: false, message: '기록이 없습니다.' };
  o.memorial = !o.memorial;
  return { ok: true, message: o.memorial ? `${o.name}을(를) 기억하기로 했습니다.` : '지정을 해제했습니다.' };
}
