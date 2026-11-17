import { JOB_LABEL, makeNormal } from './data';
import { atBunker, byId, capacity, clamp, alive, workersOf, type ActionResult, type Say } from './core';
import { addThought, adjustBond, bondOf, killSurvivor } from './mind';
import { bodyFactor, injure } from './body';
import type { EventKind, Game, Job, Rng, Survivor } from './types';

/**
 * 이야기꾼: 정착지 형편을 보고 사건을 일으킨다.
 * 잘 풀릴 때는 위협(습격)이 늘고, 어려울 때는 도움(상인·보급·방랑자)이 늘어 호흡을 조절한다.
 * 선택이 필요한 사건은 g.pending 으로 멈추고, 플레이어가 고를 때까지 시간이 흐르지 않는다.
 * ⚠ 모든 수치는 시험용이다.
 */

export interface Choice {
  id: string;
  label: string;
  hint: string;
  disabled?: boolean;
}
export interface DecisionView {
  title: string;
  text: string;
  choices: Choice[];
}

const RES_NAME = { food: '식량', water: '식수', power: '전력', medicine: '의약품', scrap: '고철' } as const;

/** 지금 쉘터의 방어 전력 */
export function defense(g: Game): number {
  const armory = workersOf(g, 'armory').length > 0 ? g.facilities.armory : 0;
  let p = armory * 6;
  for (const s of atBunker(g)) {
    if (s.status === 'critical' || s.status === 'sick') continue;
    const role = s.job === 'guard' || s.job === 'scout' ? 1.6 : s.job === 'laborer' || s.job === 'mechanic' ? 1.1 : 0.7;
    p += 3 * s.skill * role * (s.hp / 100) * bodyFactor(s);
  }
  return p;
}

const strengthLabel = (ratio: number): string => (ratio >= 1.3 ? '충분' : ratio >= 0.85 ? '보통' : '부족');

function lab(g: Game): boolean {
  return workersOf(g, 'laboratory').length > 0;
}

// ───────── 사건 일으키기 ─────────

function quarrelPair(g: Game): [Survivor, Survivor] | null {
  const here = atBunker(g);
  let best: [Survivor, Survivor] | null = null;
  let low = -30;
  for (let i = 0; i < here.length; i++) {
    for (let j = i + 1; j < here.length; j++) {
      const b = bondOf(here[i], here[j]);
      if (b <= low) {
        low = b;
        best = [here[i], here[j]];
      }
    }
  }
  return best;
}

function weightedPick<T>(items: [T, number][], rng: Rng): T | null {
  const total = items.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r < 0) return item;
  }
  return items[items.length - 1][0];
}

type Auto = 'plague' | 'drop' | 'rot';

/** 하루 정산 끝에 호출한다. 사건이 일어날 때가 되었으면 하나 고른다 */
export function rollStory(g: Game, rng: Rng, say: Say): void {
  if (g.pending || g.day < g.story.next) return;
  const here = atBunker(g);
  const pop = here.length;
  if (pop === 0) return;
  const sick = here.filter((s) => s.status === 'sick' || s.status === 'injured').length;
  const poor = g.stock.food < pop * 4 || g.stock.water < pop * 4 || sick >= 2;
  const recent = (k: string, days: number): boolean => g.story.recent.some((r) => r.kind === k && g.day - r.day < days);

  const pick = weightedPick<EventKind | Auto>([
    ['raid', g.day >= 6 && !recent('raid', 8) ? (poor ? 1 : 3) : 0],
    ['trader', g.day >= 3 && !recent('trader', 6) ? (poor ? 3 : 2) : 0],
    ['wanderer', alive(g).length < capacity(g) && !recent('wanderer', 5) ? (poor ? 1 : 2) : 0],
    ['quarrel', quarrelPair(g) && !recent('quarrel', 6) ? 3 : 0],
    ['plague', pop >= 3 && g.day >= 8 && !recent('plague', 10) ? (poor ? 2 : 1) : 0],
    ['drop', g.day >= 4 ? (poor ? 3 : 1) : 0],
    ['rot', g.stock.food >= 40 ? 1 : 0],
  ], rng);
  if (!pick) {
    g.story.next = g.day + 2;
    return;
  }
  g.story.recent.push({ day: g.day, kind: pick });
  g.story.recent = g.story.recent.slice(-14);
  g.story.next = g.day + 3 + Math.floor(rng() * 4) + (pick === 'raid' ? 3 : 0);

  if (pick === 'plague') {
    const healthy = here.filter((s) => s.status === 'ok');
    const n = Math.min(healthy.length, 1 + Math.floor(rng() * 3));
    const names: string[] = [];
    for (let i = 0; i < n; i++) {
      const s = healthy.splice(Math.floor(rng() * healthy.length), 1)[0];
      s.status = 'sick';
      names.push(s.name);
    }
    for (const s of here) addThought(s, 'plague', '역병이 돈다는 불안', -6, g.day + 5);
    say('bad', `[사건] 역병: ${names.join(', ')} 발병. 환기구로 병이 번진 듯합니다.`);
    return;
  }
  if (pick === 'drop') {
    const keys = (['food', 'water', 'medicine', 'scrap'] as const).filter(() => rng() < 0.6);
    if (keys.length === 0) keys.push('food');
    const parts = keys.map((k) => {
      const n = k === 'medicine' ? 3 + Math.floor(rng() * 4) : 20 + Math.floor(rng() * 30);
      g.stock[k] += n;
      return `${RES_NAME[k]} +${n}`;
    });
    for (const s of here) addThought(s, 'drop', '보급품이 떨어졌다', 4, g.day + 3);
    say('good', `[사건] 보급 투하: 지상에 떨어진 보급품을 회수했습니다. ${parts.join(' · ')}`);
    return;
  }
  if (pick === 'rot') {
    const lost = Math.max(5, Math.round(g.stock.food * 0.12));
    g.stock.food -= lost;
    say('warn', `[사건] 식량 부패: 저장고 습기로 식량 ${lost}이(가) 상했습니다.`);
    return;
  }

  // 선택이 필요한 사건
  const data: Record<string, number | string> = {};
  if (pick === 'raid') {
    data.power = Math.round(12 + g.day * 0.6 + pop * 3 + rng() * 6);
    say('bad', '[경보] 약탈자 무리가 입구에 접근 중입니다. 결정이 필요합니다.');
  } else if (pick === 'trader') {
    say('info', '[사건] 방랑 상인이 입구를 두드립니다. 거래할 수 있습니다.');
  } else if (pick === 'wanderer') {
    const jobs: Job[] = ['engineer', 'farmer', 'scout', 'guard', 'caretaker', 'mechanic', 'laborer', 'medic', 'researcher'];
    data.job = jobs[Math.floor(rng() * jobs.length)];
    data.sick = rng() < 0.15 ? 1 : 0;
    say('info', '[사건] 입구 앞에 지친 방랑자가 쓰러져 있습니다.');
  } else {
    const pair = quarrelPair(g) as [Survivor, Survivor];
    data.a = pair[0].id;
    data.b = pair[1].id;
    say('warn', `[사건] ${pair[0].name}과(와) ${pair[1].name}이(가) 크게 다투고 있습니다.`);
  }
  g.pending = { kind: 'event', event: pick, data };
}

// ───────── 결정 화면 ─────────

export function eventView(g: Game): DecisionView | null {
  const p = g.pending;
  if (!p || p.kind !== 'event') return null;
  const d = p.data;
  const pop = atBunker(g).length;

  if (p.event === 'raid') {
    const power = Number(d.power);
    const mine = defense(g);
    const ratio = mine / power;
    const tributeFood = Math.round(power * 1.2);
    const tributeScrap = Math.round(power * 0.8);
    const info = lab(g) ? `아군 전력 ${Math.round(mine)} / 적 ${power}` : `아군 전력 ${strengthLabel(ratio)}`;
    return {
      title: '약탈자 습격',
      text: `무장한 약탈자 무리가 입구를 둘러쌌습니다. 식량과 물자를 내놓으라고 합니다. (${info})`,
      choices: [
        { id: 'fight', label: '항전한다', hint: `${info}. 이기면 노획물을 얻지만 부상과 사망이 따릅니다.` },
        { id: 'tribute', label: '굴욕적으로 타협한다', hint: `식량 ${tributeFood}·고철 ${tributeScrap}을(를) 내주고 피를 피합니다. 모두가 굴욕감을 느낍니다.` },
        { id: 'persuade', label: '거래로 회유한다', hint: '식량 20을 내걸고 설득합니다. 성공하면 한 명이 합류할 수도 있고, 실패하면 불리하게 싸웁니다.', disabled: g.stock.food < 20 },
      ],
    };
  }
  if (p.event === 'trader') {
    return {
      title: '방랑 상인',
      text: '낡은 수레를 끈 상인이 거래를 청합니다. 하나만 고를 수 있습니다.',
      choices: [
        { id: 'buy_food', label: '식량 구입', hint: '고철 25 → 식량 35', disabled: g.stock.scrap < 25 },
        { id: 'buy_med', label: '의약품 구입', hint: '고철 30 → 의약품 4', disabled: g.stock.scrap < 30 },
        { id: 'sell_food', label: '식량 매각', hint: '식량 30 → 고철 40', disabled: g.stock.food < 30 + pop * 3 },
        { id: 'leave', label: '돌려보낸다', hint: '아무것도 하지 않습니다.' },
      ],
    };
  }
  if (p.event === 'wanderer') {
    const job = JOB_LABEL[d.job as Job];
    const full = alive(g).length >= capacity(g);
    return {
      title: '방랑자',
      text: `쓰러진 방랑자는 ${job}였다고 합니다. 병에 걸렸는지는 알 수 없습니다.`,
      choices: [
        { id: 'accept', label: '받아들인다', hint: full ? '숙소에 빈 자리가 없습니다.' : '식구가 늡니다. 병을 옮겨 올 수도 있습니다.', disabled: full },
        { id: 'feed', label: '먹을 것만 주고 보낸다', hint: '식량 6을 줍니다. 모질다는 소리는 피합니다.', disabled: g.stock.food < 6 },
        { id: 'refuse', label: '쫓아낸다', hint: '아무것도 주지 않습니다. 지켜보던 사람들의 마음이 무거워집니다.' },
      ],
    };
  }
  const a = byId(g, String(d.a));
  const b = byId(g, String(d.b));
  if (!a || !b) return null;
  return {
    title: '다툼 중재',
    text: `${a.name}과(와) ${b.name}이(가) 서로 멱살을 잡았습니다. 사령관의 처분을 기다립니다.`,
    choices: [
      { id: 'side_a', label: `${a.name}의 편을 든다`, hint: `${b.name}의 불만이 쌓입니다. 두 사람 사이는 더 나빠집니다.` },
      { id: 'side_b', label: `${b.name}의 편을 든다`, hint: `${a.name}의 불만이 쌓입니다. 두 사람 사이는 더 나빠집니다.` },
      { id: 'separate', label: '둘을 갈라놓는다', hint: '양쪽 모두 조금씩 불만이지만 사이는 풀립니다.' },
    ],
  };
}

// ───────── 결정 처리 ─────────

function raidFight(g: Game, ratio: number, rng: Rng, say: Say, power: number): void {
  const here = atBunker(g);
  const fighters = here.filter((s) => s.status === 'ok');
  const hurt = (heavy: boolean): string => {
    const s = fighters[Math.floor(rng() * fighters.length)];
    if (!s) return '';
    s.hp = clamp(s.hp - (heavy ? 40 : 20), 1, 100);
    s.status = 'injured';
    const note = injure(s, rng, g.day, heavy);
    return `${s.name}${note ? `(${note})` : ''}`;
  };
  if (ratio >= 1.2) {
    const loot = Math.round(power * 1.5);
    g.stock.scrap += loot;
    const who = hurt(false);
    say('good', `[교전] 약탈자를 물리쳤습니다. 고철 +${loot}${who ? ` · 부상 ${who}` : ''}`);
    for (const s of here) addThought(s, 'victory', '약탈자를 물리쳤다', 5, g.day + 4);
  } else if (ratio >= 0.7) {
    const who = [hurt(true), hurt(false)].filter(Boolean);
    const lf = Math.round(g.stock.food * 0.12);
    g.stock.food -= lf;
    say('warn', `[교전] 겨우 물리쳤지만 피해가 컸습니다. 식량 -${lf} · 부상 ${who.join(', ')}`);
    for (const s of here) addThought(s, 'victory', '간신히 버텨 냈다', -2, g.day + 4);
  } else {
    const dead = fighters.filter(() => rng() < 0.18).slice(0, 2);
    for (const s of dead) killSurvivor(g, s, '약탈자와의 교전', rng, say);
    const who = [hurt(true), hurt(true)].filter(Boolean);
    const lf = Math.round(g.stock.food * 0.3);
    const ls = Math.round(g.stock.scrap * 0.3);
    g.stock.food -= lf;
    g.stock.scrap -= ls;
    say('bad', `[교전] 방어선이 뚫렸습니다. 식량 -${lf} · 고철 -${ls}${who.length ? ` · 부상 ${who.join(', ')}` : ''}`);
    for (const s of atBunker(g)) addThought(s, 'victory', '방어선이 무너졌다', -10, g.day + 8);
  }
}

export function resolveEvent(g: Game, choice: string, rng: Rng, say: Say): ActionResult {
  const p = g.pending;
  if (!p || p.kind !== 'event') return { ok: false, message: '결정할 사안이 없습니다.' };
  const view = eventView(g);
  const c = view?.choices.find((x) => x.id === choice);
  if (!view || !c) return { ok: false, message: '알 수 없는 선택입니다.' };
  if (c.disabled) return { ok: false, message: '지금은 고를 수 없습니다.' };
  const d = p.data;
  const here = atBunker(g);
  let message = '결정했습니다.';

  if (p.event === 'raid') {
    const power = Number(d.power);
    const ratio = defense(g) / power;
    if (choice === 'fight') {
      raidFight(g, ratio, rng, say, power);
      g.tally.ruthless += 1;
      message = '항전했습니다.';
    } else if (choice === 'tribute') {
      const f = Math.min(g.stock.food, Math.round(power * 1.2));
      const sc = Math.min(g.stock.scrap, Math.round(power * 0.8));
      g.stock.food -= f;
      g.stock.scrap -= sc;
      for (const s of here) addThought(s, 'tribute', '약탈자에게 굴복했다', -7, g.day + 8);
      g.tally.mercy += 1;
      g.tally.efficient += 1;
      say('warn', `[타협] 약탈자에게 식량 ${f}·고철 ${sc}을(를) 내주고 돌려보냈습니다.`);
      message = '타협했습니다.';
    } else {
      g.stock.food -= 20;
      const chance = clamp(0.3 + 0.05 * g.commander.analysis + (here.some((s) => s.job === 'caretaker') ? 0.1 : 0), 0.1, 0.8);
      if (rng() < chance) {
        say('good', '[회유] 약탈자 무리를 설득해 돌려보냈습니다.');
        if (alive(g).length < capacity(g)) {
          const n = makeNormal(`s${g.nextId}`, rng, undefined, g.day);
          g.nextId += 1;
          n.loyalty = 40;
          g.survivors.push(n);
          say('good', `[신규 생존자] ${n.name} — 약탈자 무리를 떠나 합류했습니다.`);
        }
        g.tally.efficient += 2;
      } else {
        say('bad', '[회유] 설득에 실패했습니다. 약탈자들이 달려듭니다.');
        raidFight(g, ratio * 0.8, rng, say, power);
      }
      message = '거래를 시도했습니다.';
    }
  } else if (p.event === 'trader') {
    if (choice === 'buy_food') {
      g.stock.scrap -= 25;
      g.stock.food += 35;
      say('info', '[거래] 고철 25로 식량 35를 샀습니다.');
    } else if (choice === 'buy_med') {
      g.stock.scrap -= 30;
      g.stock.medicine += 4;
      say('info', '[거래] 고철 30으로 의약품 4를 샀습니다.');
    } else if (choice === 'sell_food') {
      g.stock.food -= 30;
      g.stock.scrap += 40;
      say('info', '[거래] 식량 30을 넘기고 고철 40을 받았습니다.');
    } else {
      say('info', '[거래] 상인을 돌려보냈습니다.');
    }
    g.tally.efficient += choice === 'leave' ? 0 : 1;
  } else if (p.event === 'wanderer') {
    if (choice === 'accept') {
      const n = makeNormal(`s${g.nextId}`, rng, d.job as Job, g.day);
      g.nextId += 1;
      n.loyalty = 65;
      if (d.sick === 1) n.status = 'sick';
      g.survivors.push(n);
      for (const s of here) addThought(s, `welcome_${n.id}`, '새 식구를 받아들였다', 2, g.day + 3);
      g.tally.mercy += 1;
      say('good', `[신규 생존자] ${n.name} (${JOB_LABEL[n.job]}) — 방랑자를 받아들였습니다.${d.sick === 1 ? ' 열이 있습니다.' : ''}`);
    } else if (choice === 'feed') {
      g.stock.food -= 6;
      g.tally.mercy += 1;
      say('info', '[방랑자] 식량 6을 쥐여 보냈습니다.');
    } else {
      g.tally.ruthless += 1;
      for (const s of here) addThought(s, 'turnaway', '방랑자를 내쫓는 모습을 봤다', -3, g.day + 5);
      say('warn', '[방랑자] 쓰러진 방랑자를 문밖으로 내보냈습니다.');
    }
  } else {
    const a = byId(g, String(d.a));
    const b = byId(g, String(d.b));
    if (a && b) {
      if (choice === 'separate') {
        addThought(a, 'quarrel', '중재에 불만이다', -2, g.day + 3);
        addThought(b, 'quarrel', '중재에 불만이다', -2, g.day + 3);
        adjustBond(a, b, 12);
        g.tally.efficient += 1;
        say('info', `[중재] ${a.name}과(와) ${b.name}을(를) 갈라놓았습니다.`);
      } else {
        const win = choice === 'side_a' ? a : b;
        const lose = choice === 'side_a' ? b : a;
        addThought(win, 'quarrel', '편을 들어 주었다', 6, g.day + 5);
        addThought(lose, 'quarrel', '부당한 처분을 받았다', -10, g.day + 7);
        adjustBond(win, lose, -10);
        g.tally.ruthless += 1;
        say('warn', `[중재] ${win.name}의 편을 들었습니다. ${lose.name}의 불만이 쌓입니다.`);
      }
    }
  }
  g.pending = null;
  return { ok: true, message };
}
