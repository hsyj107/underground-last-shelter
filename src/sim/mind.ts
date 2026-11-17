import { lastWords } from './data';
import { alive, atBunker, clamp, hash, inBreak, roomOf, type Say } from './core';
import { injure, PART_LABEL } from './body';
import type { Game, Rng, Survivor } from './types';

/**
 * 기분(생각 목록), 관계, 죽음의 충격, 정신 붕괴.
 * 스트레스는 "지금 쌓여 있는 생각들의 합"이 가리키는 목표치를 향해 매일 조금씩 움직인다.
 * ⚠ 모든 수치는 시험용이다.
 */

// ───────── 생각 ─────────

export function addThought(s: Survivor, id: string, text: string, value: number, until: number, sit = false): void {
  const t = s.thoughts.find((x) => x.id === id);
  if (t) {
    t.text = text;
    t.value = value;
    t.until = until;
    t.sit = sit;
  } else {
    s.thoughts.push({ id, text, value, until, sit });
  }
}

export const activeThoughts = (g: Game, s: Survivor): Survivor['thoughts'] => s.thoughts.filter((t) => t.until >= g.day);
export const moodSum = (g: Game, s: Survivor): number => activeThoughts(g, s).reduce((a, t) => a + t.value, 0);

// ───────── 관계 ─────────

export const bondOf = (a: Survivor, b: Survivor): number => a.bonds[b.id] ?? 0;

export function adjustBond(a: Survivor, b: Survivor, delta: number): void {
  a.bonds[b.id] = clamp(Math.round((a.bonds[b.id] ?? 0) + delta), -100, 100);
  b.bonds[a.id] = clamp(Math.round((b.bonds[a.id] ?? 0) + delta), -100, 100);
}

export function bondLabel(v: number): string {
  if (v >= 80) return '절친';
  if (v >= 45) return '친구';
  if (v >= 15) return '지인';
  if (v <= -45) return '앙숙';
  if (v <= -15) return '불편한 사이';
  return '';
}

/** 두 사람의 타고난 궁합 (-1~1). 같은 두 사람은 언제나 같다 */
export function compat(a: Survivor, b: Survivor): number {
  const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
  return ((hash(key) % 2001) - 1000) / 1000;
}

/** 같은 방에서 지내는 사람끼리 하루에 조금씩 가까워지거나 멀어진다 */
export function updateBonds(g: Game, rng: Rng, say: Say): void {
  const here = atBunker(g);
  for (let i = 0; i < here.length; i++) {
    for (let j = i + 1; j < here.length; j++) {
      const a = here[i];
      const b = here[j];
      const before = bondLabel(bondOf(a, b));
      if (roomOf(g, a) === roomOf(g, b)) {
        const c = compat(a, b);
        const stress = (a.stress + b.stress) / 200;
        adjustBond(a, b, c * 2.2 - stress * 1.2 + (rng() - 0.5));
      } else if (a.bonds[b.id]) {
        // 떨어져 지내면 관계가 천천히 식는다
        const cur = a.bonds[b.id];
        const d = cur > 0 ? -0.3 : 0.3;
        adjustBond(a, b, Math.abs(cur) < 1 ? -cur : d);
      }
      const after = bondLabel(bondOf(a, b));
      if (after !== before) {
        const v = bondOf(a, b);
        if (v >= 45 && before !== '절친' && (after === '친구' || after === '절친')) say('info', `${a.name}과(와) ${b.name}이(가) ${after}${after === '절친' ? '가' : '가'} 되었습니다.`);
        else if (v <= -45 && after === '앙숙') say('warn', `${a.name}과(와) ${b.name}의 사이가 틀어져 앙숙이 되었습니다.`);
      }
    }
  }
}

// ───────── 죽음과 이별 ─────────

/** 죽은(떠난) 사람 때문에 남은 사람들이 받는 충격. 관계가 깊을수록 오래 간다 */
export function mourn(g: Game, dead: Survivor): void {
  for (const o of alive(g)) {
    if (o.id === dead.id) continue;
    const bond = o.bonds[dead.id] ?? 0;
    const tid = `mourn_${dead.id}`;
    if (bond >= 80) {
      addThought(o, tid, `절친 ${dead.name}의 죽음`, -35, g.day + 20);
      o.loyalty = clamp(o.loyalty - 10, 0, 100);
    } else if (bond >= 45) {
      addThought(o, tid, `친구 ${dead.name}의 죽음`, -20, g.day + 14);
    } else if (bond <= -45) {
      addThought(o, tid, `앙숙 ${dead.name}이(가) 사라졌다`, 4, g.day + 6);
    } else {
      addThought(o, tid, `동료 ${dead.name}의 죽음`, dead.named ? -8 : -3, g.day + 6);
    }
    delete o.bonds[dead.id];
  }
}

/** 사망 처리. 유언과 전몰자 기록을 남기고, 남은 사람들의 기분에 반영한다 */
export function killSurvivor(g: Game, s: Survivor, cause: string, rng: Rng, say: Say): void {
  if (s.status === 'dead') return;
  const last = lastWords(s, cause, rng);
  s.status = 'dead';
  s.post = null;
  delete g.critical[s.id];
  g.obituaries.push({ day: g.day, name: s.name, job: s.job, named: s.named, cause, last, age: Math.floor(s.age), served: g.day - s.joined, memorial: false });
  say('death', `[사망] ${s.name} — ${cause}. 마지막 기록: "${last}"`);
  mourn(g, s);
}

// ───────── 스트레스 ─────────

export interface StressInput {
  /** 오늘 받은 식량·식수 비율 (0~1) */
  rf: number;
  rw: number;
  /** 사령관 보정: 나쁜 생각의 무게 배수 */
  stressMod: number;
  withheld: number;
  dormStaffed: boolean;
  dormLevel: number;
  low: boolean;
  ace: boolean;
}

/** 오늘의 상황에서 생기는 생각들을 갱신하고, 스트레스를 목표치로 움직인다 */
export function updateStress(g: Game, s: Survivor, p: StressInput): void {
  const today = g.day;
  const sit = (id: string, text: string, value: number): void => {
    if (value === 0) return;
    // 정산 뒤 날짜가 하루 넘어가도 화면에 보이도록 다음 날까지 둔다
    addThought(s, id, text, Math.round(value * 10) / 10, today + 1, true);
  };
  s.thoughts = s.thoughts.filter((t) => t.until >= today && !t.sit);

  sit('hunger', '배가 고프다', -(1 - p.rf) * 30);
  sit('thirst', '목이 마르다', -(1 - p.rw) * 35);
  if (g.policy === 'emergency') sit('policy', '전시 비상 배급이 이어진다', -8);
  if (g.policy === 'merit') {
    if (p.low) sit('policy', '실적이 낮다며 배급이 깎였다', -10);
    else if (p.ace) sit('policy', '실적을 인정받아 우대받는다', 4);
  }
  if (s.exception === 'withhold') sit('exception', '배급에서 제외되었다', -30);
  if (s.exception === 'special') sit('exception', '특식을 받았다', 14);
  else if (p.withheld > 0) sit('witness', '굶는 동료를 지켜봐야 한다', -Math.min(12, 4 * p.withheld));
  sit('dorm', p.dormStaffed ? '잘 관리되는 숙소' : '방치된 숙소', p.dormStaffed ? 3 + 2 * p.dormLevel : -3);
  if (s.status === 'sick') sit('sick', '몸이 아프다', -8);
  if (s.status === 'injured') sit('hurt', '상처가 쑤신다', -6);
  if (s.status === 'critical') sit('crit', '죽음이 다가온다', -25);

  // 몸의 후유증은 평생 간다
  const lost = s.wounds.filter((w) => w.kind === 'lost').map((w) => PART_LABEL[w.part]);
  if (lost.length > 0) sit('lost', `${lost.join('·')}이(가) 없다`, -6 * lost.length);
  const pros = s.wounds.filter((w) => w.kind === 'prosthetic').length;
  if (pros > 0) sit('pros', '의수·의족이 아직 어색하다', -2 * pros);
  if (s.wounds.some((w) => w.part === 'head' && w.kind === 'scar')) sit('head', '두통과 이명이 가시지 않는다', -4);

  // 일과 사람
  if (s.post && g.facilities[s.post] > 0) {
    const pr = s.prio[s.post] ?? 3;
    if (pr === 1) sit('job', '하고 싶던 일을 한다', 6);
    else if (pr === 0) sit('job', '싫은 일을 억지로 한다', -6);
  } else if (s.status === 'ok') {
    sit('job', '할 일이 없다', -2);
  }
  const room = roomOf(g, s);
  for (const o of atBunker(g)) {
    if (o.id === s.id || roomOf(g, o) !== room) continue;
    const b = bondOf(s, o);
    if (b >= 80) sit(`with_${o.id}`, `절친 ${o.name}과(와) 함께 있다`, 8);
    else if (b >= 45) sit(`with_${o.id}`, `친구 ${o.name}과(와) 함께 있다`, 4);
    else if (b <= -45) sit(`with_${o.id}`, `앙숙 ${o.name}과(와) 같은 방이다`, -6);
  }

  const sum = activeThoughts(g, s).reduce((a, t) => a + (t.value < 0 ? t.value * p.stressMod : t.value), 0);
  const target = clamp(28 - sum, 0, 100);
  s.stress = clamp(Math.round((s.stress + (target - s.stress) * 0.35) * 10) / 10, 0, 100);
}

// ───────── 정신 붕괴 ─────────

export const BREAK_LABEL: Record<string, string> = { daze: '넋이 나감', hoard: '사재기', rage: '난동', murder: '살인' };

/** 스트레스가 한계를 넘으면 가끔 무너진다. 무너지고 나면 어느 정도 가라앉는다 */
export function mentalBreaks(g: Game, rng: Rng, say: Say): void {
  for (const s of atBunker(g)) {
    if (s.breakUntil !== undefined && s.breakUntil < g.day) {
      delete s.breakUntil;
      delete s.breakKind;
    }
    if (s.stress < 85 || inBreak(g, s) || s.status === 'critical' || rng() >= 0.4) continue;

    const others = atBunker(g).filter((o) => o.id !== s.id);
    const rival = others.filter((o) => bondOf(s, o) <= -45).sort((a, b) => bondOf(s, a) - bondOf(s, b))[0];
    const roll = rng();
    let kind: string;
    if (rival && bondOf(s, rival) <= -60 && s.stress >= 92 && roll < 0.2) kind = 'murder';
    else if (roll < 0.45) kind = 'daze';
    else if (roll < 0.7) kind = 'hoard';
    else kind = 'rage';
    if (kind === 'rage' && others.length === 0) kind = 'daze';

    s.stress = 55;
    s.breakKind = kind;
    if (kind === 'daze') {
      s.breakUntil = g.day + 2;
      say('warn', `[정신 붕괴] ${s.name}이(가) 넋이 나가 아무 일도 하지 못합니다.`);
    } else if (kind === 'hoard') {
      s.breakUntil = g.day + 1;
      const food = Math.min(g.stock.food, 8);
      const water = Math.min(g.stock.water, 6);
      g.stock.food -= food;
      g.stock.water -= water;
      s.loyalty = clamp(s.loyalty - 8, 0, 100);
      say('bad', `[정신 붕괴] ${s.name}이(가) 식량 ${food}·식수 ${water}를 몰래 빼돌렸습니다.`);
    } else if (kind === 'rage') {
      s.breakUntil = g.day + 2;
      const target = rival ?? others[Math.floor(rng() * others.length)];
      target.hp = clamp(target.hp - 20, 1, 100);
      const note = injure(target, rng, g.day, false);
      addThought(target, `beaten_${s.id}`, `${s.name}에게 폭행당했다`, -10, g.day + 7);
      adjustBond(s, target, -25);
      g.stock.scrap = Math.max(0, g.stock.scrap - 6);
      say('bad', `[정신 붕괴] ${s.name}이(가) 난동을 부려 ${target.name}${note ? `(${note})` : ''}이(가) 다쳤고 고철 일부가 망가졌습니다.`);
    } else if (rival) {
      s.breakUntil = g.day + 3;
      killSurvivor(g, rival, `${s.name}에게 살해당함`, rng, say);
      addThought(s, 'killer', '사람을 죽였다', -15, g.day + 20);
      s.loyalty = clamp(s.loyalty - 30, 0, 100);
      say('bad', `[정신 붕괴] ${s.name}이(가) ${rival.name}을(를) 살해했습니다.`);
    }
  }
}
