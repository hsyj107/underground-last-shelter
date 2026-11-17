import { AREAS } from '../../src/sim/data';
import {
  assign, atBunker, byId, endDay, evaluateTitle, facilityState, forecast, newGame, resolveSerum, setException,
  setPolicy, startExpedition, unlockFacility, upgradeFacility, workersOf,
} from '../../src/sim/engine';
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
const fresh = (rng = () => 0.5): Game => newGame({ nickname: '테스트', background: 'x', command: 5, logistics: 5, analysis: 5 }, rng);

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

// 식량 고갈: 전원 아사 → 게임 오버
{
  const g = fresh();
  g.stock.food = 0; g.stock.water = 0;
  for (const s of g.survivors) s.post = null; // 생산 중단
  for (let i = 0; i < 20 && !g.over; i++) endDay(g, () => 0.9);
  ok(g.over !== null && g.over.cause === '전멸', 'starvation ends the run: ' + JSON.stringify(g.over));
  ok(g.obituaries.length === 4, 'all four recorded ' + g.obituaries.length);
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

// 폭동 게임 오버
{
  const g = fresh();
  for (const s of g.survivors) { s.stress = 95; s.loyalty = 5; }
  endDay(g, () => 0.99);
  ok(g.over !== null, 'riot or collapse ends run: ' + JSON.stringify(g.over));
}

// 장기 안정성: 아무것도 안 하면 어떻게 되는가 (크래시 없이 종료되는지)
{
  const g = fresh(Math.random);
  let n = 0;
  while (!g.over && n < 400) { if (g.pending) resolveSerum(g, null); endDay(g, Math.random); n++; }
  ok(g.day > 1, 'long run completes without throwing, ended day ' + g.day + ' ' + (g.over?.cause ?? 'alive'));
  console.log('idle run: day', g.day, g.over?.cause ?? 'still alive', 'deaths', g.obituaries.length, 'title', g.title);
}
void AREAS;
console.log(failed === 0 ? 'ALL SIM TESTS PASSED' : `${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
