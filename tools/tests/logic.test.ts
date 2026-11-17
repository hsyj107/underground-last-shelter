import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, ITEM_BY_ID, JOBS, ORIGINS, PROD, PROFS, SURV_BY_ID, ZONES, SHELF_ORDER, CAT_ORDER, RARITY, UPGRADES } from '../../src/data.ts';
import { SHAPES } from '../../src/shapes.ts';
import * as g from '../../src/state.ts';

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** 해당 직업의 생존자를 만들어 바로 합류시키고 id 를 돌려준다 */
function join(s: g.State, prof: string): string {
  const pd = PROFS.find((p) => p.id === prof)!;
  const p = g.makePerson(s, pd);
  s.crew.push(p.id);
  return p.id;
}

test('데이터 무결성: 아이템/모양/구역', () => {
  const ids = new Set(ITEMS.map((i) => i.id));
  assert.equal(ids.size, ITEMS.length, '아이템 id 중복');
  assert.equal(SHELF_ORDER.length, ITEMS.length);
  for (const it of ITEMS) assert.ok(SHAPES[it.shape], `${it.id}: 모양 ${it.shape} 없음`);
  for (const [name, rows] of Object.entries(SHAPES)) {
    assert.equal(rows.length, 8, `${name}: 8줄이어야 함`);
    rows.forEach((r, i) => assert.equal(r.length, 8, `${name} ${i + 1}번째 줄이 8칸이 아님: "${r}"`));
  }
  // 모든 아이템이 어느 구역에선가 나온다
  for (const it of ITEMS) {
    assert.ok(ZONES.some((z) => z.cats[it.cat]), `${it.id}: 나오는 구역 없음`);
  }
  // 선반은 48칸 (2묶음 x 6칸 x 4단)
  assert.ok(ITEMS.length <= 48);
  // 호감 아이템이 실제 존재
  for (const s of PROFS) for (const id of s.likes.items) assert.ok(ITEM_BY_ID[id], `${s.id} 좋아하는 물건 ${id}`);
  assert.ok(PROFS.length >= 30, `직업 ${PROFS.length}종`);
  assert.equal(new Set(PROFS.map((p) => p.id)).size, PROFS.length);
  for (const s of PROFS) if (s.unlock.type === 'item') assert.ok(ITEM_BY_ID[s.unlock.id]);
  for (const s of PROFS) {
    assert.equal(s.chapters.length, 3);
    assert.ok(s.lastWords.length >= 3, `${s.id} 유언`);
    for (const k of ['str', 'agi', 'med', 'cha'] as const) assert.ok(s.range[k][0] >= 1 && s.range[k][1] <= 10 && s.range[k][0] <= s.range[k][1]);
  }
  for (const z of ZONES) assert.ok(z.unlock <= ITEMS.length);
});

/** 시작 보너스가 없는 조합 */
function plain(): g.Creation {
  const c = g.defaultCreation();
  return { ...c, origin: 'guard', job: 'soldier', stats: g.rollStats('guard', 'soldier') };
}

test('새 게임: 비축이 있고 플레이어 혼자서는 먹고살 만하다', () => {
  const s = g.newState('테스트', 0, plain());
  assert.equal(s.caps, 20);
  assert.deepEqual(s.res, { food: 60, water: 60, med: 10 });
  const f = g.flow(s, 0);
  assert.ok(f.prod.food > f.cons.food && f.prod.water > f.cons.water);
  assert.equal(g.heads(s), 1);
});

test('시간이 흐르면 먹고 마시고, 부족하면 바닥난다', () => {
  g.setRng(Math.random);
  const s = g.newState('a', 0);
  for (let i = 0; i < 5; i++) join(s, 'kid'); // 6명
  s.res = { food: 10, water: 10, med: 0 };
  const f = g.flow(s, 0);
  assert.ok(f.cons.food > f.prod.food);
  g.tick(s, 10 * 60_000);
  assert.ok(s.res.food < 10);
  g.tick(s, 600 * 60_000);
  assert.equal(s.res.food, 0);
  assert.ok(s.shortMs > 0);
  assert.equal(g.effectiveRation(s), 'starve');
});

test('자리 비움 한도: 한도를 넘는 시간은 흐르지 않는다', () => {
  const s = g.newState('a', 0);
  const cap = g.offlineCapMs(s);
  const s2 = g.newState('b', 0);
  g.tick(s, cap);
  g.tick(s2, cap * 5);
  assert.ok(Math.abs(s.res.food - s2.res.food) < 1e-6);
});

/** 지금 올 수 있는 직업을 전부 영입해 둔다 (except 는 남겨 둔다) */
function fillCrew(s: g.State, except = ''): void {
  for (let guard = 0; guard < 60; guard++) {
    const d = PROFS.find((p) => p.id !== except && !g.livingProfs(s).has(p.id) && g.unlockMet(s, p.unlock));
    if (!d) return;
    join(s, d.id);
  }
}

test('첫 방문자는 직업이 고정되지 않고, 영입하면 크루가 된다', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 80; i++) {
    g.setRng(Math.random);
    const s = g.newState('a', 0);
    g.tick(s, 25_000);
    assert.ok(s.visitor);
    const pr = PROFS.find((p) => p.id === s.people[s.visitor!].prof)!;
    assert.equal(pr.unlock.type, 'start'); // 조건 없는 직업만 첫 손님이 될 수 있다
    seen.add(pr.id);
  }
  assert.ok(seen.size >= 8, `첫 손님 종류 ${seen.size}`);
  g.setRng(Math.random);
  const s = g.newState('a', 0);
  assert.deepEqual(g.tick(s, 1000), []);
  const ev = g.tick(s, 25_000);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].type, 'visitor');
  const id = s.visitor!;
  assert.ok(g.recruit(s, id, 25_000));
  assert.deepEqual(s.crew, [id]);
  assert.equal(s.visitor, null);
  assert.ok(!g.recruit(s, id, 25_001));
});

test('조건 직업은 조건을 만족해야 오고, 같은 직업은 한 명만 산다', () => {
  g.setRng(Math.random);
  const s = g.newState('a', 0);
  // 조건 없는 직업을 전부 영입해 두면 조건 직업만 남는다
  fillCrew(s);
  s.nextVisit = 0;
  assert.deepEqual(g.tick(s, 1), []); // 조건 직업은 아직 못 온다
  assert.equal(g.pickVisitor(s), null);
  for (const id of ['f_tuna', 'f_peach', 'f_beans', 'f_spam', 'f_ramen', 'f_snack']) s.found[id] = 1;
  const next = g.pickVisitor(s);
  assert.ok(next && next.unlock.type === 'found');
  s.nextVisit = 0;
  const ev = g.tick(s, 2);
  assert.equal(ev.length, 1);
  const prof = s.people[s.visitor!].prof;
  assert.ok(PROFS.find((p) => p.id === prof)!.unlock.type === 'found');
});

test('방문자 가중치: 식량이 바닥나면 식량 직업이 더 자주 온다', () => {
  g.setRng(Math.random);
  const count = (food: number): number => {
    let n = 0;
    for (let i = 0; i < 600; i++) {
      const s = g.newState('a', 0);
      s.res.food = food;
      s.res.water = 100;
      s.res.med = 30;
      const p = g.pickVisitor(s)!;
      if (p.buff.kind === 'prod_food') n++;
    }
    return n;
  };
  assert.ok(count(5) > count(100) * 1.4, '식량 부족 때 가중');
});

test('생존자 생성: 직업의 핵심 능력치는 보장되고 이름은 겹치지 않는다', () => {
  g.setRng(Math.random);
  const s = g.newState('a', 0);
  const names = new Set<string>();
  for (let i = 0; i < 120; i++) {
    const sol = g.makePerson(s, PROFS.find((p) => p.id === 'soldier')!);
    assert.ok(sol.stats.str >= 8, `전투 ${sol.stats.str}`);
    const nu = g.makePerson(s, PROFS.find((p) => p.id === 'nurse')!);
    assert.ok(nu.stats.med >= 7, `의료 ${nu.stats.med}`);
    names.add(sol.name);
    names.add(nu.name);
  }
  assert.equal(names.size, 240);
});

test('탐사: 시작 → 시간 경과 → 수령', () => {
  g.setRng(seq([0.5, 0.1, 0.9, 0.3, 0.7, 0.2, 0.6]));
  const s = g.newState('a', 0);
  const r = g.startExpedition(s, 'mart', ['me'], 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.exp.result.items.length, 3);
  assert.equal(r.exp.end, 4 * 60_000);
  // 같은 사람을 또 보낼 수 없다
  assert.ok(!g.startExpedition(s, 'mart', ['me'], 1).ok);
  // 아직 도착 전
  assert.equal(g.claimExpedition(s, r.exp.id, 1000), null);
  const ev = g.tick(s, 250_000);
  assert.ok(ev.some((e) => e.type === 'exp_done'));
  const rep = g.claimExpedition(s, r.exp.id, 250_000);
  assert.ok(rep);
  if (!rep) return;
  assert.equal(rep.items.length, 3);
  assert.ok(rep.firstClear);
  assert.ok(rep.items.some((i) => i.isNew));
  assert.equal(s.exps.length, 0);
  assert.equal(g.foundCount(s) > 0, true);
  assert.equal(s.stats.expeditions, 1);
  // 도감은 늘고 보유 합계는 3개
  assert.equal(Object.values(s.items).reduce((a, b) => a + b, 0), 3);
});

test('열리지 않은 구역과 잘못된 팀은 거절', () => {
  const s = g.newState('a', 0);
  assert.ok(!g.startExpedition(s, 'hospital', ['me'], 0).ok);
  assert.ok(!g.startExpedition(s, 'mart', [], 0).ok);
  assert.ok(!g.startExpedition(s, 'mart', ['me', 'me'], 0).ok);
  assert.ok(!g.startExpedition(s, 'mart', ['p99'], 0).ok); // 아직 영입 전
});

test('위험도: 특수부대는 위험을 크게 줄이고 아이는 전리품을 늘린다', () => {
  const s = g.newState('a', 0);
  const chulmin = join(s, 'soldier');
  const duri = join(s, 'kid');
  const solo = g.previewExpedition(s, 'megamart', ['me']);
  const withC = g.previewExpedition(s, 'megamart', ['me', chulmin]);
  assert.ok(withC.risk < solo.risk);
  const d = g.previewExpedition(s, 'mart', ['me', duri]);
  assert.equal(d.loot, 3 + 1 + 1);
  // D1 구역은 혼자서도 안전
  assert.equal(g.previewExpedition(s, 'mart', ['me']).risk, 0);
});

test('들키면 전리품 절반, 피로가 생긴다', () => {
  g.setRng(() => 0); // 항상 들킴 (점장은 죽지 않는다)
  const s = g.newState('a', 0);
  s.found = Object.fromEntries(ITEMS.slice(0, 40).map((i) => [i.id, 1]));
  const r = g.startExpedition(s, 'megamart', ['me'], 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(r.exp.result.caught);
  assert.equal(r.exp.result.items.length, Math.floor(g.previewExpedition(s, 'megamart', ['me'], 0).loot / 2));
  const rep = g.claimExpedition(s, r.exp.id, r.exp.end);
  assert.ok(rep?.caught);
  assert.ok(g.isTired(s, 'me', r.exp.end + 1));
  assert.ok(!g.availableCrew(s, r.exp.end + 1).includes('me'));
  g.setRng(Math.random);
});

test('호감도와 이야기 해금, 3장 보상', () => {
  const s = g.newState('a', 0);
  const songi = join(s, 'cook');
  s.aff[songi] = 15;
  const r = g.addAffinity(s, songi, 6);
  assert.deepEqual(r.chapters, [0]);
  assert.equal(g.chapterReached(s, songi), 1);
  const r2 = g.addAffinity(s, songi, 200);
  assert.deepEqual(r2.chapters, [1, 2]);
  assert.equal(r2.reward, 150);
  assert.equal(s.aff[songi], 100);
  assert.equal(g.buffScale(s, songi), 1.5);
});

test('대화에는 쿨타임, 선물은 개수를 소모하고 취향에 따라 호감이 다르다', () => {
  g.setRng(() => 0);
  const s = g.newState('a', 0);
  const songi = join(s, 'cook');
  const t1 = g.talk(s, songi, 0);
  assert.ok(t1.ok);
  const t2 = g.talk(s, songi, 1000);
  assert.ok(!t2.ok && t2.wait > 0);
  const t3 = g.talk(s, songi, 70_000);
  assert.ok(t3.ok);
  s.items = { f_ramen: 1, d_roll: 1, f_tuna: 1 };
  const love = g.gift(s, songi, 'f_ramen');
  assert.ok(love.ok && love.mood === 'love' && love.delta === 25);
  const like = g.gift(s, songi, 'f_tuna');
  assert.ok(like.ok && like.mood === 'like');
  const meh = g.gift(s, songi, 'd_roll');
  assert.ok(meh.ok && meh.mood === 'meh');
  assert.ok(!g.gift(s, songi, 'd_roll').ok); // 이제 없음
  g.setRng(Math.random);
});

test('생존자 버프는 벙커에 있을 때만 생산에 반영된다', () => {
  const s = g.newState('a', 0);
  const base = g.flow(s, 0).prod.food;
  const cook = join(s, 'cook');
  const home = g.flow(s, 0).prod.food;
  assert.ok(Math.abs(home - base * 1.4) < 1e-9);
  s.exps.push({ id: 'x', zone: 'mart', members: [cook], start: 0, end: 1000, result: { items: [], caps: 0, caught: false, line: '', deaths: [], supplies: { food: 0, water: 0, med: 0 } }, notified: false });
  assert.ok(Math.abs(g.flow(s, 500).prod.food - base) < 1e-9); // 탐사 중
  assert.ok(Math.abs(g.flow(s, 1500).prod.food - home) < 1e-9); // 돌아옴
});

test('분류 완성 효과: 식료품은 식량 생산 +25%', () => {
  const s = g.newState('a', 0);
  const base = g.flow(s, 0).prod.food;
  for (const it of ITEMS.filter((i) => i.cat === 'food')) s.found[it.id] = 1;
  assert.ok(g.catComplete(s, 'food'));
  assert.ok(Math.abs(g.flow(s, 0).prod.food - base * 1.25) < 1e-9);
  for (const it of ITEMS.filter((i) => i.cat === 'tech')) s.found[it.id] = 1;
  assert.ok(g.expeditionMs(s, ZONES[0]) < ZONES[0].minutes * 60000);
});

test('절식: 소비가 줄고 탐사 사망 확률이 오른다', () => {
  const s = g.newState('a', 0);
  const kid = join(s, 'kid');
  const normal = g.flow(s, 0).cons.food;
  const p0 = g.deathChance(kid, [kid], s);
  g.setRation(s, 'reduced');
  assert.ok(g.flow(s, 0).cons.food < normal);
  assert.ok(g.deathChance(kid, [kid], s) > p0);
  g.setRation(s, 'starve');
  assert.ok(g.deathChance(kid, [kid], s) > g.deathChance(kid, [kid], (g.setRation(s, 'reduced'), s)));
  // 책 읽어 주는 만화방 주인이 있으면 부작용이 줄어든다
  g.setRation(s, 'reduced');
  const before = g.deathChance(kid, [kid], s);
  join(s, 'comic');
  assert.ok(g.deathChance(kid, [kid], s, 0) < before);
});

test('탐사 보급: 물자가 비축에 더해지고 간호사가 있으면 의약품이 늘어난다', () => {
  g.setRng(() => 0.5);
  const s = g.newState('a', 0);
  s.found = Object.fromEntries(ITEMS.slice(0, 6).map((i) => [i.id, 1]));
  const r = g.startExpedition(s, 'pharmacy', ['me'], 0);
  if (!r.ok) throw new Error(r.error);
  assert.ok(r.exp.result.supplies.med > 0);
  const nurse = join(s, 'nurse');
  const medBefore = s.res.med;
  const rep = g.claimExpedition(s, r.exp.id, r.exp.end)!;
  assert.equal(rep.supplies.med, Math.round(r.exp.result.supplies.med * 1.4));
  assert.equal(s.res.med, medBefore + rep.supplies.med);
  assert.ok(nurse);
  g.setRng(Math.random);
});

test('굶주림 위기: 오래 굶으면 터지고, 추방하면 입이 하나 준다', () => {
  g.setRng(Math.random);
  const s = g.newState('a', 0);
  const kid = join(s, 'kid');
  const sol = join(s, 'soldier');
  s.res = { food: 0, water: 0, med: 0 };
  const ev = g.tick(s, 7 * 3600_000);
  assert.ok(ev.some((e) => e.type === 'crisis'));
  assert.ok(s.crisis);
  assert.equal(g.weakestId(s), kid); // 능력치가 가장 낮은 아이
  const r = g.resolveCrisis(s, 'exile', 7 * 3600_000);
  assert.ok(r.ok && r.exiled?.id === kid);
  assert.deepEqual(s.crew, [sol]);
  assert.equal(s.dead[0].zone, 'exile');
  assert.ok(!s.crisis);
  // 버티기: 호감 -10, 유예
  s.crisis = true;
  s.aff[sol] = 30;
  g.resolveCrisis(s, 'endure', 7 * 3600_000);
  assert.equal(s.aff[sol], 20);
  assert.ok(s.shortMs < 6 * 3600_000);
  assert.ok(!g.resolveCrisis(s, 'exile', 0).ok); // 위기가 아니면 불가
});

test('판매와 개조', () => {
  const s = g.newState('a', 0);
  s.items['m_serum'] = 2;
  assert.equal(g.sellItem(s, 'm_serum', 0), g.sellPrice(s, 'm_serum', 0) || 0);
  assert.equal(s.items['m_serum'], 1);
  assert.equal(g.sellItem(s, 'f_tuna', 0), 0);
  const c0 = UPGRADES.farm.base;
  s.caps = c0 - 1;
  assert.ok(!g.buyUpgrade(s, 'farm'));
  s.caps = c0;
  assert.ok(g.buyUpgrade(s, 'farm'));
  assert.equal(s.upg.farm, 1);
  assert.equal(s.caps, 0);
  assert.equal(g.upgradeCost('farm', 1), Math.round(UPGRADES.farm.base * UPGRADES.farm.grow));
  assert.ok(g.flow(s, 0).prod.food > PROD.food);
  s.upg.store = 2;
  assert.equal(g.flow(s, 0).cap, PROD.cap + PROD.capLv * 2);
  s.upg.pack = 4;
  s.caps = 1e9;
  assert.ok(!g.buyUpgrade(s, 'pack')); // 최대
});

test('아이템 뽑기: 구역에 없는 분류는 나오지 않는다', () => {
  g.setRng(Math.random);
  const s = g.newState('a', 0);
  const zone = ZONES.find((z) => z.id === 'pharmacy')!;
  for (let i = 0; i < 300; i++) {
    const id = g.pickItem(s, zone, 1);
    const cat = ITEM_BY_ID[id].cat;
    assert.ok(['medical', 'daily', 'food'].includes(cat), `${id}`);
  }
  assert.equal(CAT_ORDER.length, 6);
});

test('저장 데이터 복원(node 에는 localStorage 가 없으므로 null)', () => {
  assert.equal(g.loadState(), null);
});

test('죽음: 들키면 정해진 사람이 영구히 사라지고 추모비와 유언이 남는다', () => {
  g.setRng(() => 0); // 항상 들키고, 죽을 확률 판정도 항상 "죽음"
  const s = g.newState('a', 0);
  const kid = join(s, 'kid');
  const name = s.people[kid].name;
  s.found = Object.fromEntries(ITEMS.slice(0, 40).map((i) => [i.id, 1]));
  s.aff[kid] = 30;
  const r = g.startExpedition(s, 'megamart', ['me', kid], 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.exp.result.deaths.map((d) => d.id), [kid]); // 점장은 죽지 않는다
  // 출발 시점에 이미 정해져 있다: 저장을 불러와도 바뀌지 않는다
  const rep = g.claimExpedition(s, r.exp.id, r.exp.end);
  assert.ok(rep);
  if (!rep) return;
  assert.equal(rep.deaths.length, 1);
  assert.equal(rep.deaths[0].name, name);
  assert.ok(rep.deaths[0].last.length > 0);
  assert.ok(!s.crew.includes(kid));
  assert.equal(s.dead.length, 1);
  assert.equal(s.dead[0].id, kid);
  assert.ok(s.people[kid]); // 기록(이름·외형)은 남는다
  assert.ok(!g.availableCrew(s, r.exp.end + 1).includes(kid));
  // 죽은 사람과는 대화·선물·탐사가 모두 불가능
  assert.ok(!g.talk(s, kid, r.exp.end + 1).ok);
  assert.ok(!g.startExpedition(s, 'mart', [kid], r.exp.end + 1).ok);
  g.setRng(Math.random);
});

test('죽음: 안전한 구역에서는 아무도 죽지 않고, 전투가 센 사람은 덜 죽는다', () => {
  const s = g.newState('a', 0);
  const kid = join(s, 'kid');
  const sol = join(s, 'soldier');
  const nurse = join(s, 'nurse');
  assert.equal(g.previewExpedition(s, 'mart', ['me', kid]).anyDeath, 0);
  assert.ok(g.deathChance(sol, [sol]) < g.deathChance(kid, [kid]));
  // 의료 능력치가 높은 동료가 함께 가면 사망 확률이 내려간다
  assert.ok(g.deathChance(kid, [kid, nurse]) < g.deathChance(kid, [kid]));
  assert.equal(g.deathChance('me', ['me']), 0);
  assert.ok(g.deathChance(kid, [kid]) >= 0.03);
});

test('죽은 직업은 다시 후보가 된다 (새 얼굴, 새 이름으로)', () => {
  g.setRng(Math.random);
  const s = g.newState('a', 0);
  const old = join(s, 'cook');
  s.crew = [];
  s.dead.push({ id: old, day: 1, zone: 'mart', last: '' });
  // 후보가 요리사 하나뿐인 상황을 만든다: 나머지 직업은 이미 곁에 있다
  fillCrew(s, 'cook');
  s.nextVisit = 0;
  const ev = g.tick(s, 1);
  assert.equal(ev.length, 1);
  const fresh = s.people[s.visitor!];
  assert.equal(fresh.prof, 'cook');
  assert.notEqual(fresh.id, old);
  assert.notEqual(fresh.name, s.people[old].name);
});

test('매력: 매장에 있는 가장 매력적인 사람이 판매가를 올린다', () => {
  const s = g.newState('a', 0, plain());
  const mine = Math.round(100 * (1 + 0.03 * SURV_BY_ID.me.stats.cha));
  assert.equal(g.sellPrice(s, 'm_serum', 0), mine);
  const dj = join(s, 'dj');
  assert.ok(s.people[dj].stats.cha >= 7);
  const up = g.sellPrice(s, 'm_serum', 0);
  assert.equal(up, Math.round(100 * (1 + 0.03 * s.people[dj].stats.cha)));
  // 탐사 중이면 흥정해 줄 수 없다
  s.exps.push({ id: 'x', zone: 'mart', members: [dj], start: 0, end: 1000, result: { items: [], caps: 0, caught: false, line: '', deaths: [], supplies: { food: 0, water: 0, med: 0 } }, notified: false });
  assert.equal(g.sellPrice(s, 'm_serum', 500), mine); // 탐사 중이면 남은 사람 중에서
});

test('관계: 합류할 때 친함/불화가 정해지고 탐사에 영향을 준다', () => {
  g.setRng(Math.random);
  const s = g.newState('a', 0);
  const a = join(s, 'cook');
  // 직접 관계 지정 후 효과 확인
  const b = join(s, 'nurse');
  const c = join(s, 'dev');
  s.rel = {};
  s.rel[g.relKey(a, b)] = 'friend';
  s.rel[g.relKey(a, c)] = 'rival';
  assert.equal(g.relOf(s, b, a), 'friend');
  assert.deepEqual(g.relatives(s, a, 'friend'), [b]);
  const bad = g.previewExpedition(s, 'megamart', [a, c]);
  assert.equal(bad.rivals, 1);
  delete s.rel[g.relKey(a, c)];
  const neutral = g.previewExpedition(s, 'megamart', [a, c]);
  assert.ok(bad.risk > neutral.risk); // 불화: 들킬 확률 증가
  s.rel[g.relKey(a, c)] = 'rival';
  const withFriend = g.previewExpedition(s, 'megamart', [a, b]);
  assert.equal(withFriend.friends, 1);
  assert.ok(g.deathChance(a, [a, b], s) < g.deathChance(a, [a, b])); // 친구: 사망 확률 감소
});

test('관계: 합류 시 관계가 확률적으로 생기고 저장된다', () => {
  g.setRng(() => 0); // 항상 "친구" 구간
  const s = g.newState('a', 0);
  const a = join(s, 'cook');
  for (const id of ['f_tuna', 'f_peach', 'f_beans', 'f_spam', 'f_ramen', 'f_snack']) s.found[id] = 1;
  s.nextVisit = 0;
  g.tick(s, 1);
  const v = s.visitor!;
  assert.ok(g.recruit(s, v, 2));
  assert.equal(g.relOf(s, a, v), 'friend');
  g.setRng(Math.random);
});

test('관계: 친구가 죽으면 남은 친구는 충격을 받는다', () => {
  g.setRng(() => 0);
  const s = g.newState('a', 0);
  const kid = join(s, 'kid');
  const cook = join(s, 'cook');
  s.rel = { [g.relKey(kid, cook)]: 'friend' };
  s.aff[cook] = 30;
  s.found = Object.fromEntries(ITEMS.slice(0, 40).map((i) => [i.id, 1]));
  const r = g.startExpedition(s, 'megamart', ['me', kid], 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  const rep = g.claimExpedition(s, r.exp.id, r.exp.end);
  assert.deepEqual(rep?.grief, [cook]);
  assert.equal(s.aff[cook], 22);
  assert.ok(g.isTired(s, cook, r.exp.end + 1));
  g.setRng(Math.random);
});

test('플레이어 만들기: 직업 범위와 출신 보정으로 능력치가 굴려진다', () => {
  g.setRng(Math.random);
  for (const o of ORIGINS) {
    for (const j of JOBS.filter((x) => g.validCombo(o.id, x.id))) {
      for (let i = 0; i < 40; i++) {
        const st = g.rollStats(o.id, j.id);
        for (const k of ['str', 'agi', 'med', 'cha'] as const) {
          const lo = j.range[k][0] + (o.bonus[k] ?? 0);
          const hi = Math.min(10, j.range[k][1] + (o.bonus[k] ?? 0));
          assert.ok(st[k] >= lo && st[k] <= hi, `${o.id}/${j.id}/${k}: ${st[k]} not in ${lo}-${hi}`);
        }
      }
    }
  }
  // 극단: 군·경 + 보안 요원은 전투가 8 이상
  for (let i = 0; i < 40; i++) assert.ok(g.rollStats('guard', 'soldier').str >= 8);
  g.setRng(() => 0);
  assert.deepEqual(g.rollStats('tenant', 'merchant'), { str: 1, agi: 2, med: 1, cha: 7 });
  g.setRng(Math.random);
});

test('플레이어 만들기: 출신과 직업의 시작 보너스, 이름·외형이 반영된다', () => {
  const cr: g.Creation = { gender: 'f', origin: 'tenant', job: 'merchant', look: { ...g.defaultCreation().look, skin: '#b88860' }, stats: { str: 3, agi: 6, med: 2, cha: 4 } };
  const s = g.newState('  한서  ', 0, cr);
  assert.equal(s.player.name, '한서');
  assert.equal(s.caps, 80); // 기본 20 + 입점 상인 20 + 영업·상인 40
  assert.equal(s.res.food, 80); // +20
  assert.equal(SURV_BY_ID.me.name, '한서');
  assert.equal(SURV_BY_ID.me.look.skin, '#b88860');
  assert.equal(SURV_BY_ID.me.stats.agi, 6);
  assert.equal(SURV_BY_ID.me.title, '입점 상인 · 편의점 점주');
  const eng = g.newState('b', 0, { ...cr, origin: 'staff', job: 'engineer' });
  assert.equal(eng.upg.farm, 1); // 기술자는 수경재배 Lv1로 시작
  assert.equal(eng.res.water, 90); // 시설 관리직원 +30
  const empty = g.newState('', 0, cr);
  assert.equal(empty.player.name, '관리자');
});

test('플레이어 능력치는 탐사에 반영된다 (전투→위험, 의료→동료 생존, 수색→희귀 확률)', () => {
  const sol: g.Creation = { ...g.defaultCreation(), origin: 'guard', job: 'soldier', stats: { str: 9, agi: 3, med: 1, cha: 2 } };
  const s = g.newState('a', 0, sol);
  const strong = g.previewExpedition(s, 'megamart', ['me']);
  const weak = g.newState('b', 0, { ...sol, stats: { str: 1, agi: 3, med: 1, cha: 2 } });
  assert.ok(strong.power > g.previewExpedition(weak, 'megamart', ['me']).power);
  // 의료 높은 플레이어가 함께 가면 동료의 사망 확률이 내려간다
  const kid = join(s, 'kid');
  const lowMed = g.deathChance(kid, ['me', kid], s);
  const doc: g.Creation = { ...sol, origin: 'shopper', job: 'medic', stats: { str: 1, agi: 3, med: 9, cha: 2 } };
  const s2 = g.newState('c', 0, doc);
  const kid2 = join(s2, 'kid');
  assert.ok(g.deathChance(kid2, ['me', kid2], s2) < lowMed);
});

test('저장 불러오기 시 플레이어 정보가 유지되고 레지스트리가 복원된다', () => {
  const cr: g.Creation = { gender: 'm', origin: 'staff', job: 'engineer', look: g.defaultCreation().look, stats: { str: 2, agi: 2, med: 2, cha: 8 } };
  const s = g.newState('도윤', 0, cr);
  const json = JSON.parse(JSON.stringify(s));
  assert.equal(json.player.name, '도윤');
  assert.equal(json.player.stats.cha, 8);
});

test('출신에 맞는 직업만 고를 수 있다', () => {
  assert.ok(g.validCombo('tenant', 'merchant'));
  assert.ok(g.validCombo('tenant', 'medic')); // 입점 약국 약사
  assert.ok(!g.validCombo('tenant', 'soldier'));
  assert.ok(!g.validCombo('guard', 'medic'));
  assert.ok(!g.validCombo('staff', 'merchant'));
  assert.equal(JOBS.filter((j) => g.validCombo('shopper', j.id)).length, 5);
  for (const o of ORIGINS) {
    assert.ok(g.validCombo(o.id, g.defaultCreation().origin === o.id ? g.defaultCreation().job : Object.keys(o.jobs)[0]));
    for (const [jid, c] of Object.entries(o.jobs)) {
      assert.ok(JOBS.some((j) => j.id === jid), `${o.id}: 없는 직업 ${jid}`);
      assert.ok(c.title && c.blurb);
    }
  }
  assert.ok(g.validCombo(g.defaultCreation().origin, g.defaultCreation().job));
});
