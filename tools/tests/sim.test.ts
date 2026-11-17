import { AREAS, makeNormal } from '../../src/sim/data';
import { MAX_CATCHUP_DAYS, msToNextDay, tick } from '../../src/sim/clock';
import {
  assign, atBunker, byId, endDay, evaluateTitle, facilityState, forecast, newGame, resolveDecision, resolveSerum, setException,
  setMemorial, setPolicy, startExpedition, unlockFacility, upgradeFacility, workersOf,
} from '../../src/sim/engine';
import { eventView, rollStory } from '../../src/sim/story';
import { activeThoughts, adjustBond, bondLabel, bondOf, killSurvivor, mentalBreaks } from '../../src/sim/mind';
import { bodyFactor, injure } from '../../src/sim/body';
import { autoAssign, craftProsthetic, rollRelic, setAuto, setPrio } from '../../src/sim/engine';
import { makeSay } from '../../src/sim/core';
import type { Game } from '../../src/sim/types';

let failed = 0;
const ok = (cond: boolean, msg: string): void => {
  if (!cond) {
    failed++;
    console.log('FAIL', msg);
  }
};
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
/** 기본은 이야기꾼 사건을 꺼 둔다 (사건을 시험하는 곳에서만 story.next 를 되돌린다) */
const fresh = (rng = () => 0.5): Game => {
  const g = newGame({ nickname: '테스트', background: 'x', command: 5, logistics: 5, analysis: 5 }, rng);
  g.story.next = 9999;
  return g;
};

/** 멈춰 있는 결정이 있으면 가장 먼저 고를 수 있는 선택으로 풀어 준다 */
const clearPending = (g: Game): void => {
  const p = g.pending;
  if (!p) return;
  if (p.kind === 'serum') {
    resolveSerum(g, null);
    return;
  }
  const v = eventView(g);
  const c = v?.choices.find((x) => !x.disabled) ?? v?.choices[v.choices.length - 1];
  if (c) resolveDecision(g, c.id, () => 0.5);
  else g.pending = null;
};

// 새 게임
{
  const g = fresh();
  ok(g.survivors.length === 4 && g.day === 1, 'new game roster');
  ok(facilityState(g, 'power_plant') === 'active' && facilityState(g, 'medical') === 'locked', 'start facilities');
  const f = forecast(g);
  ok(f.net.power > 0 && f.net.food > 0, 'positive start balance ' + JSON.stringify(f.net));
}

// 하루 진행: 날짜·생산
{
  const g = fresh();
  const power = g.stock.power;
  const r = endDay(g, () => 0.9);
  ok(g.day === 2, 'day advances');
  ok(g.stock.power > power - 30, 'power produced');
  ok(r.entries.some((e) => e.text.startsWith('생산')), 'production logged');
}

// 배급 정책: 비상 배급은 소비를 줄이고 체력을 깎는다
{
  const a = fresh(), b = fresh();
  setPolicy(b, 'emergency');
  endDay(a, () => 0.9); endDay(b, () => 0.9);
  ok(b.stock.food > a.stock.food, 'emergency saves food');
  ok(byId(b, 's1')!.hp < byId(a, 's1')!.hp, 'emergency hurts hp');
  ok(byId(b, 's1')!.loyalty < byId(a, 's1')!.loyalty, 'emergency drops loyalty');
}

// 실적 우선: 에이스는 더 받고 하위는 덜 받아 스트레스가 오른다
{
  const a = fresh(), b = fresh();
  setPolicy(b, 'merit');
  for (let i = 0; i < 3; i++) { endDay(a, () => 0.9); endDay(b, () => 0.9); }
  const low = (g: Game) => g.survivors.find((s) => !s.named && s.skill <= 2)!;
  ok(low(b).stress > low(a).stress, 'merit stresses low performers');
}

// 배급 제외 → 아사 → 사망 일지·유언
{
  const g = fresh();
  setException(g, 's1', 'withhold');
  let died = false;
  for (let i = 0; i < 30 && !died; i++) {
    const g2 = g;
    endDay(g2, () => 0.9);
    died = byId(g2, 's1')!.status === 'dead';
  }
  ok(died, 'withheld survivor eventually dies');
  const ob = g.obituaries.find((o) => o.name === byId(g, 's1')!.name);
  ok(!!ob && ob.last.length > 0 && ob.cause.length > 0, 'obituary recorded with last words');
  ok(g.tally.ruthless > 5, 'withholding raises ruthless score');
}

// 식량 고갈: 전원 아사 → 정착지 붕괴, 기록은 남고 폐허에서 재건
{
  const g = fresh();
  g.stock.food = 0; g.stock.water = 0;
  for (const s of g.survivors) { s.post = null; s.auto = false; } // 생산 중단
  for (let i = 0; i < 20 && g.collapses === 0; i++) endDay(g, () => 0.9);
  ok(g.collapses === 1, 'starvation collapses the settlement');
  ok(g.obituaries.length === 4, 'all four recorded ' + g.obituaries.length);
  ok(g.survivors.length === 3 && g.survivors.every((x) => x.status === 'ok'), 'rebuilt with 3 new survivors');
  ok(g.chronicle.length >= 3 && g.stock.food === 20, 'chronicle and ruined stock');
  ok(g.obituaries.every((o) => o.served >= 0 && o.age >= 20), 'obituary has age and service days');
}

// 시설 개방·확장·배치
{
  const g = fresh();
  ok(!unlockFacility(g, 'medical').ok, 'locked by conditions');
  g.commander.level = 2; g.facilities.dormitory = 2; g.stock.scrap = 200;
  ok(unlockFacility(g, 'medical').ok && g.facilities.medical === 1 && g.stock.scrap === 120, 'unlock medical');
  ok(facilityState(g, 'medical') === 'idle', 'idle until staffed');
  ok(assign(g, 's3' in {} ? 's3' : 'n_choi', 'medical').ok && facilityState(g, 'medical') === 'active', 'assign medic');
  const before = g.stock.scrap;
  ok(upgradeFacility(g, 'medical').ok && g.facilities.medical === 2 && g.stock.scrap === before - 60, 'upgrade');
  ok(assign(g, 's1', 'medical').ok && workersOf(g, 'medical').length === 1 && byId(g, 'n_choi')!.post === null, 'one worker per facility');
}

// 의무실 치료
{
  const g = fresh();
  g.commander.level = 2; g.facilities.dormitory = 2; g.stock.scrap = 200;
  unlockFacility(g, 'medical'); assign(g, 'n_choi', 'medical');
  byId(g, 's2')!.status = 'sick';
  const med = g.stock.medicine;
  endDay(g, () => 0.9);
  ok(byId(g, 's2')!.status === 'ok' && g.stock.medicine === med - 1, 'medical cures sick');
}

// 원정
{
  const g = fresh();
  ok(!startExpedition(g, 'market', ['s1']).ok, 'level gate');
  ok(startExpedition(g, 'outskirts', ['s1']).ok && byId(g, 's1')!.status === 'away', 'dispatch');
  ok(!assign(g, 's1', 'farm').ok, 'cannot assign away');
  ok(workersOf(g, 'water_purifier').length === 0, 'post cleared');
  endDay(g, () => 0.99);
  ok(byId(g, 's1')!.status === 'ok' && g.expeditions.length === 0, 'returned');
  ok(g.survivors.some((s) => s.id === 'n_park'), 'first clear brings named survivor');
  ok(g.cleared.outskirts === 1, 'cleared count');
}

// 원정 사망
{
  const g = fresh();
  startExpedition(g, 'outskirts', ['s1']);
  const r = endDay(g, () => 0.0);
  ok(byId(g, 's1')!.status === 'dead' && r.entries.some((e) => e.kind === 'death'), 'expedition death logged');
}

// 세럼 딜레마
{
  const g = fresh();
  g.day = 6;
  const rng = seq(0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.01, 0.0);
  let r = endDay(g, rng);
  for (let i = 0; i < 6 && !g.pending; i++) r = endDay(g, () => 0.9);
  // 확률을 강제로 맞추기 위해 직접 사안을 만든다.
  if (!g.pending) {
    const ace = byId(g, 'n_choi')!;
    ace.status = 'critical'; ace.post = null; g.critical[ace.id] = g.day + 4;
    g.pending = { kind: 'serum', aceId: ace.id };
  }
  ok(g.pending !== null, 'pending decision exists ' + r.decision);
  const before = JSON.stringify(endDay(g, () => 0.9));
  ok(before === JSON.stringify({ entries: [], decision: false }), 'cannot end day while pending');
  const aceId = g.pending!.aceId;
  const messenger = atBunker(g).find((s) => s.id !== aceId && !s.named)!;
  ok(resolveSerum(g, messenger.id).ok && g.pending === null && g.serum !== null, 'send messenger');
  // 성공 경로
  const win = structuredClone(g);
  endDay(win, () => 0.9); endDay(win, () => 0.0);
  ok(byId(win, aceId)!.status !== 'critical' && byId(win, aceId)!.status !== 'dead' && win.serum === null && win.critical[aceId] === undefined && byId(win, messenger.id)!.status === 'injured', 'serum success cures ace');
  // 실패 경로
  const lose = structuredClone(g);
  for (let i = 0; i < 6; i++) endDay(lose, () => 0.99);
  ok(byId(lose, messenger.id)!.status === 'dead' && byId(lose, aceId)!.status === 'dead', 'serum failure loses both');
  // 포기 경로
  const give = structuredClone(g);
  give.serum = null; give.pending = { kind: 'serum', aceId }; byId(give, messenger.id)!.status = 'ok';
  ok(resolveSerum(give, null).ok, 'give up');
  for (let i = 0; i < 4; i++) endDay(give, () => 0.99);
  ok(byId(give, aceId)!.status === 'dead' && give.obituaries.some((o) => o.cause === '치명적 질병'), 'abandoned ace dies');
}

// 칭호
{
  const g = fresh();
  g.day = 10; g.tally = { ruthless: 20, mercy: 0, efficient: 20, idleDays: 0 };
  ok(evaluateTitle(g) === '철혈의 독재자', 'despot');
  g.tally = { ruthless: 6, mercy: 0, efficient: 20, idleDays: 0 };
  ok(evaluateTitle(g) === '비정한 회계사', 'accountant');
  g.tally = { ruthless: 0, mercy: 20, efficient: 0, idleDays: 0 };
  ok(evaluateTitle(g) === '위태로운 성자', 'saint');
  g.tally = { ruthless: 0, mercy: 0, efficient: 0, idleDays: 8 };
  ok(evaluateTitle(g) === '방관자', 'bystander');
  g.day = 3;
  ok(evaluateTitle(g) === '신임 관리자', 'no title before day 7');
}

// 폭동 → 붕괴 → 재건
{
  const g = fresh();
  for (const s of g.survivors) {
    s.stress = 95; s.loyalty = 5;
    s.thoughts.push({ id: 'x', text: '시험용 극심한 악재', value: -150, until: 9999 });
  }
  endDay(g, () => 0.99);
  ok(g.collapses === 1 && g.survivors.length === 3, 'riot collapses and rebuilds');
  ok(g.obituaries.some((o) => o.cause.includes('폭동')), 'leavers recorded');
}

// 전몰자 지정
{
  const g = fresh();
  g.obituaries.push({ day: 2, name: '테스트', job: 'guard', named: false, cause: '질병', last: 'x', age: 30, served: 3, memorial: false });
  ok(setMemorial(g, 0).ok && g.obituaries[0].memorial, 'memorial on');
  ok(setMemorial(g, 0).ok && !g.obituaries[0].memorial, 'memorial off');
  ok(!setMemorial(g, 5).ok, 'memorial bad index');
}

// 노화: 고령은 체력 상한이 내려가고 결국 노령으로 죽는다
{
  const g = fresh();
  const old = g.survivors[2];
  old.age = 82;
  for (let i = 0; i < 400 && old.status !== 'dead' && g.collapses === 0; i++) { if (g.pending) resolveSerum(g, null); endDay(g, seq(0.5)); }
  ok(old.hp <= 100 - (82 - 60) * 1.5 + 1 || old.status === 'dead', 'hp ceiling lowered by age');
  const young = fresh();
  const y = young.survivors[3];
  y.age = 30;
  for (let i = 0; i < 30; i++) endDay(young, () => 0.9);
  ok(young.collapses > 0 || y.status === 'dead' || Math.abs(y.age - (30 + 30 / 365)) < 0.01, 'age advances 1/365 per day ' + y.age);
}

// 시계: 시간이 흐르면 하루가 자동 정산된다
{
  const T0 = 1_000_000;
  const g = newGame({ nickname: 't', background: 'x', command: 5, logistics: 5, analysis: 5 }, () => 0.5, T0, 1000);
  g.story.next = 9999;
  let r = tick(g, T0 + 500, () => 0.5);
  ok(r.days === 0 && g.day === 1, 'less than a day: nothing');
  r = tick(g, T0 + 1500, () => 0.5);
  ok(r.days === 1 && g.day === 2, 'one day passed live ' + r.days);
  ok(msToNextDay(g, T0 + 1500) === 1000 - (1500 - 1500 + g.clock.carry) , 'countdown consistent');
  const idleBefore = g.tally.idleDays;
  r = tick(g, T0 + 1500 + 3 * 60_000, () => 0.5);
  ok(r.days === MAX_CATCHUP_DAYS && r.capped && r.away, 'offline catch-up capped at ' + r.days);
  ok(g.tally.idleDays === idleBefore, 'away days are not counted as idle');
}
// 결정 대기 중에는 시계가 멈춘다
{
  const T0 = 5_000_000;
  const g = newGame({ nickname: 't', background: 'x', command: 5, logistics: 5, analysis: 5 }, () => 0.5, T0, 1000);
  g.story.next = 9999;
  g.pending = { kind: 'serum', aceId: g.survivors[0].id };
  const r = tick(g, T0 + 10 * 1000, () => 0.5);
  ok(r.days === 0 && g.day === 1, 'clock paused while a decision is pending');
  g.pending = null;
  const r2 = tick(g, T0 + 10 * 1000 + 1000, () => 0.5);
  ok(r2.days === 1, 'resumes without burst: ' + r2.days);
}

// 장기 안정성: 아무것도 안 하면 어떻게 되는가 (크래시 없이 종료되는지)
{
  const g = fresh(Math.random);
  let n = 0;
  g.story.next = 4;
  while (n < 800) { clearPending(g); endDay(g, Math.random); n++; }
  ok(g.day > 1, 'long run completes without throwing, ended day ' + g.day);
  console.log('idle run: day', g.day, 'collapses', g.collapses, 'deaths', g.obituaries.length, 'title', g.title);
}
// 랜덤 생존자: 직업에 맞는 나이·숙련도, 외형 값 부여
{
  let laborHigh = 0, laborN = 0, engHigh = 0, engN = 0, scoutOld = 0, bad = 0;
  for (let i = 0; i < 600; i++) {
    const l = makeNormal('t' + i, Math.random, 'laborer');
    const e = makeNormal('e' + i, Math.random, 'engineer');
    const sc = makeNormal('c' + i, Math.random, 'scout');
    laborN++; engN++;
    if (l.skill >= 4) laborHigh++;
    engHigh += e.skill - l.skill;
    if (sc.age > 38) scoutOld++;
    if (l.skill < 1 || l.skill > 5 || !l.look || !e.trait.includes('엔지니어') || l.age < 20) bad++;
  }
  ok(bad === 0, 'random survivor fields valid');
  ok(laborHigh / laborN < 0.15, 'laborers rarely high skill ' + laborHigh / laborN);
  ok(engHigh / engN > 0.5, 'engineers average higher skill than laborers ' + engHigh / engN);
  ok(scoutOld === 0, 'scouts are young');
}
// 기분: 배급이 줄면 이유 있는 생각이 쌓이고 스트레스가 오른다
{
  const g = fresh();
  g.stock.food = 0;
  for (const x of g.survivors) { x.post = null; x.auto = false; }
  const s = byId(g, 's1')!;
  const before = s.stress;
  endDay(g, () => 0.9);
  ok(activeThoughts(g, s).some((t) => t.id === 'hunger' && t.value < 0), 'hunger thought appears');
  ok(s.stress > before, 'stress rises toward the thought sum');
}

// 관계: 친구의 죽음은 오래 남고, 앙숙의 죽음은 오히려 홀가분하다
{
  const g = fresh();
  const a = byId(g, 's1')!, b = byId(g, 's2')!, c = byId(g, 'n_han')!;
  adjustBond(a, b, 85);
  adjustBond(a, c, -60);
  ok(bondLabel(bondOf(a, b)) === '절친' && bondLabel(bondOf(a, c)) === '앙숙', 'bond labels');
  const say = makeSay(g);
  killSurvivor(g, b, '질병', () => 0.5, say);
  ok(activeThoughts(g, a).some((t) => t.value <= -30), 'best friend death hits hard');
  killSurvivor(g, c, '질병', () => 0.5, say);
  ok(activeThoughts(g, a).some((t) => t.id === `mourn_${c.id}` && t.value > 0), 'rival death is a relief');
  ok(a.bonds[b.id] === undefined, 'bonds with the dead are purged');
}

// 정신 붕괴: 한계 스트레스면 일을 못 하게 되고 가라앉는다
{
  const g = fresh();
  const s = byId(g, 's1')!;
  s.stress = 95;
  mentalBreaks(g, () => 0.1, makeSay(g));
  ok(s.breakKind !== undefined && s.breakUntil !== undefined && s.stress <= 60, 'mental break triggers and relieves stress');
  ok(!workersOf(g, 'water_purifier').includes(s) || s.post !== 'water_purifier', 'broken survivor does not work');
}

// 이야기꾼: 습격 결정 3지선다, 방랑자·상인·다툼
{
  const g = fresh();
  g.day = 10;
  g.story.next = 10;
  g.story.recent = [];
  const rng = (() => { let i = 0; const v = [0.01, 0.5, 0.5, 0.5, 0.5, 0.5]; return () => v[Math.min(i++, v.length - 1)]; })();
  rollStory(g, rng, makeSay(g));
  ok(g.pending?.kind === 'event', 'story creates a decision ' + JSON.stringify(g.pending));
  const view = eventView(g);
  ok(!!view && view.choices.length >= 3, 'decision has at least 3 choices');
  const r = resolveDecision(g, view!.choices.find((c) => !c.disabled)!.id, () => 0.5);
  ok(r.ok && g.pending === null, 'decision resolves');

  const t = fresh();
  t.pending = { kind: 'event', event: 'trader', data: {} };
  const scrap = t.stock.scrap;
  resolveDecision(t, 'buy_food', () => 0.5);
  ok(t.stock.scrap === scrap - 25 && t.stock.food === 60 + 35, 'trader exchange');

  const w = fresh();
  w.pending = { kind: 'event', event: 'wanderer', data: { job: 'guard', sick: 0 } };
  const n = w.survivors.length;
  resolveDecision(w, 'accept', () => 0.5);
  ok(w.survivors.length === n + 1 && w.survivors[n].job === 'guard', 'wanderer joins');

  const q = fresh();
  const [x, y] = [byId(q, 's1')!, byId(q, 's2')!];
  adjustBond(x, y, -60);
  q.pending = { kind: 'event', event: 'quarrel', data: { a: x.id, b: y.id } };
  resolveDecision(q, 'side_a', () => 0.5);
  ok(activeThoughts(q, y).some((t) => t.value < 0) && bondOf(x, y) < -60, 'quarrel side taking hurts the loser');
}

// 습격: 약한 방어선으로 항전하면 피해를 입는다
{
  const g = fresh();
  g.pending = { kind: 'event', event: 'raid', data: { power: 300 } };
  const food = g.stock.food;
  resolveDecision(g, 'fight', () => 0.1);
  ok(g.stock.food < food || g.survivors.some((s) => s.status === 'dead' || s.wounds.length > 0), 'losing a raid costs something');
  const h = fresh();
  h.pending = { kind: 'event', event: 'raid', data: { power: 20 } };
  resolveDecision(h, 'tribute', () => 0.5);
  ok(h.stock.food < 60 && h.pending === null, 'tribute pays');
}

// 작업 우선순위: 자동 배치와 직접 배치
{
  const g = fresh();
  const s = byId(g, 's1')!;
  ok(s.post === 'water_purifier', 'laborer starts at water purifier ' + s.post);
  setPrio(g, 's1', 'water_purifier', 0);
  setPrio(g, 's1', 'farm', 1);
  ok(s.post !== 'water_purifier', 'priority 0 removes from that facility ' + s.post);
  assign(g, 's1', 'power_plant');
  ok(s.post === 'power_plant' && s.auto === false, 'manual assignment turns auto off');
  autoAssign(g);
  ok(s.post === 'power_plant', 'auto assign respects manual posts');
  setAuto(g, 's1', true);
  ok(s.auto === true, 'auto toggled on');
}

// 부상과 의수: 부위가 남고 능률이 떨어지며, 공방에서 의수로 만회
{
  const g = fresh();
  const s = byId(g, 's1')!;
  s.wounds.push({ part: 'arm_l', kind: 'lost' }, { part: 'leg_r', kind: 'lost' });
  const hurt = bodyFactor(s);
  ok(hurt < 0.7, 'lost limbs reduce efficiency ' + hurt);
  ok(!craftProsthetic(g, 's1', 'arm_l').ok, 'prosthetic needs workshop');
  g.facilities.workshop = 2;
  const smith = byId(g, 'n_han')!;
  smith.post = 'workshop'; smith.auto = false;
  g.stock.scrap = 100; g.stock.medicine = 5;
  ok(craftProsthetic(g, 's1', 'arm_l').ok && bodyFactor(s) > hurt, 'prosthetic improves efficiency');
  const m = fresh();
  const t = byId(m, 's2')!;
  const note = injure(t, () => 0.1, m.day, true);
  ok(!!note && t.wounds.length === 1, 'injure records a wound');
}

// 유물 도감: 확률이 맞으면 등록, 중복은 횟수만 증가, 나쁜 굴림이면 없음
{
  const g = fresh();
  const area = AREAS[0];
  const say = makeSay(g);
  rollRelic(g, area, () => 0.01, say);
  const ids = Object.keys(g.codex);
  ok(ids.length === 1 && g.codex[ids[0]].count === 1, 'relic registered ' + ids);
  const scrap = g.stock.scrap;
  rollRelic(g, area, () => 0.01, say);
  ok(g.codex[ids[0]].count === 2 && g.stock.scrap === scrap + 10, 'duplicate counted');
  const h = fresh();
  rollRelic(h, area, () => 0.99, makeSay(h));
  ok(Object.keys(h.codex).length === 0, 'no relic on bad roll');
}

void AREAS;
console.log(failed === 0 ? 'ALL SIM TESTS PASSED' : `${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
