import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, ITEM_BY_ID, SURVIVORS, ZONES, SHELF_ORDER, CAT_ORDER, RARITY, UPGRADES } from '../../src/data.ts';
import { SHAPES } from '../../src/shapes.ts';
import * as g from '../../src/state.ts';

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
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
  for (const s of SURVIVORS) for (const id of s.likes.items) assert.ok(ITEM_BY_ID[id], `${s.id} 좋아하는 물건 ${id}`);
  for (const s of SURVIVORS) if (s.unlock.type === 'item') assert.ok(ITEM_BY_ID[s.unlock.id]);
  for (const z of ZONES) assert.ok(z.unlock <= ITEMS.length);
});

test('새 게임과 기본 수입', () => {
  const s = g.newState('테스트', 0);
  assert.equal(s.caps, 20);
  const inc = g.incomeBreakdown(s, 0);
  assert.equal(inc.perMin, g.BASE_INCOME);
  s.items['f_tuna'] = 1;
  assert.equal(g.incomeBreakdown(s, 0).perMin, g.BASE_INCOME + RARITY.common.income);
  s.items['f_tuna'] = 3; // 같은 물건 추가분은 +10%씩
  assert.ok(Math.abs(g.incomeBreakdown(s, 0).perMin - (g.BASE_INCOME + RARITY.common.income * 1.2)) < 1e-9);
});

test('시간이 흐르면 뚜껑이 쌓이고, 자리 비움 한도가 있다', () => {
  const s = g.newState('a', 0);
  g.tick(s, 60_000);
  assert.ok(Math.abs(s.caps - (20 + g.BASE_INCOME)) < 1e-6);
  const cap = g.offlineCapMs(s);
  const s2 = g.newState('b', 0);
  g.tick(s2, cap * 5);
  assert.ok(Math.abs(s2.caps - (20 + (g.BASE_INCOME * cap) / 60000)) < 1e-3);
});

test('첫 방문자는 한송이이고 영입하면 크루가 된다', () => {
  const s = g.newState('a', 0);
  assert.deepEqual(g.tick(s, 1000), []);
  const ev = g.tick(s, 25_000);
  assert.deepEqual(ev, [{ type: 'visitor', id: 'songi' }]);
  assert.equal(s.visitor, 'songi');
  assert.ok(g.recruit(s, 'songi', 25_000));
  assert.deepEqual(s.crew, ['songi']);
  assert.equal(s.visitor, null);
  assert.ok(!g.recruit(s, 'songi', 25_001));
});

test('조건을 만족해야 다음 생존자가 온다', () => {
  const s = g.newState('a', 0);
  s.crew = ['songi'];
  s.nextVisit = 0;
  assert.deepEqual(g.tick(s, 1), []); // 도감 6종 미만
  for (const id of ['f_tuna', 'f_peach', 'f_beans', 'f_spam', 'f_ramen', 'f_snack']) s.found[id] = 1;
  s.nextVisit = 0;
  const ev = g.tick(s, 2);
  assert.deepEqual(ev, [{ type: 'visitor', id: 'hajun' }]);
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
  assert.ok(!g.startExpedition(s, 'mart', ['songi'], 0).ok); // 아직 영입 전
});

test('위험도: 철민은 위험을 크게 줄이고 두리는 전리품을 늘린다', () => {
  const s = g.newState('a', 0);
  s.crew = ['chulmin', 'duri'];
  const solo = g.previewExpedition(s, 'megamart', ['me']);
  const withC = g.previewExpedition(s, 'megamart', ['me', 'chulmin']);
  assert.ok(withC.risk < solo.risk);
  const d = g.previewExpedition(s, 'mart', ['me', 'duri']);
  assert.equal(d.loot, 3 + 1 + 1);
  // D1 구역은 혼자서도 안전
  assert.equal(g.previewExpedition(s, 'mart', ['me']).risk, 0);
});

test('들키면 전리품 절반, 피로가 생긴다', () => {
  g.setRng(() => 0); // 항상 들킴
  const s = g.newState('a', 0);
  s.found = Object.fromEntries(ITEMS.slice(0, 40).map((i) => [i.id, 1]));
  const r = g.startExpedition(s, 'megamart', ['me'], 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(r.exp.result.caught);
  assert.equal(r.exp.result.items.length, 1); // floor(3/2)
  const rep = g.claimExpedition(s, r.exp.id, r.exp.end);
  assert.ok(rep?.caught);
  assert.ok(g.isTired(s, 'me', r.exp.end + 1));
  assert.ok(!g.availableCrew(s, r.exp.end + 1).includes('me'));
  g.setRng(Math.random);
});

test('호감도와 이야기 해금, 3장 보상', () => {
  const s = g.newState('a', 0);
  s.crew = ['songi'];
  s.aff['songi'] = 15;
  const r = g.addAffinity(s, 'songi', 6);
  assert.deepEqual(r.chapters, [0]);
  assert.equal(g.chapterReached(s, 'songi'), 1);
  const r2 = g.addAffinity(s, 'songi', 200);
  assert.deepEqual(r2.chapters, [1, 2]);
  assert.equal(r2.reward, 150);
  assert.equal(s.aff['songi'], 100);
  assert.equal(g.buffScale(s, 'songi'), 1.5);
});

test('대화에는 쿨타임, 선물은 개수를 소모하고 취향에 따라 호감이 다르다', () => {
  g.setRng(() => 0);
  const s = g.newState('a', 0);
  s.crew = ['songi'];
  const t1 = g.talk(s, 'songi', 0);
  assert.ok(t1.ok);
  const t2 = g.talk(s, 'songi', 1000);
  assert.ok(!t2.ok && t2.wait > 0);
  const t3 = g.talk(s, 'songi', 70_000);
  assert.ok(t3.ok);
  s.items = { f_ramen: 1, d_roll: 1, f_tuna: 1 };
  const love = g.gift(s, 'songi', 'f_ramen');
  assert.ok(love.ok && love.mood === 'love' && love.delta === 25);
  const like = g.gift(s, 'songi', 'f_tuna');
  assert.ok(like.ok && like.mood === 'like');
  const meh = g.gift(s, 'songi', 'd_roll');
  assert.ok(meh.ok && meh.mood === 'meh');
  assert.ok(!g.gift(s, 'songi', 'd_roll').ok); // 이제 없음
  g.setRng(Math.random);
});

test('생존자 버프는 매장에 있을 때만 수입에 반영된다', () => {
  const s = g.newState('a', 0);
  s.crew = ['songi'];
  s.items['f_tuna'] = 1;
  const home = g.incomeBreakdown(s, 0).perMin;
  assert.ok(Math.abs(home - (g.BASE_INCOME + RARITY.common.income * 1.4)) < 1e-9);
  s.exps.push({ id: 'x', zone: 'mart', members: ['songi'], start: 0, end: 1000, result: { items: [], caps: 0, caught: false, line: '' }, notified: false });
  assert.ok(Math.abs(g.incomeBreakdown(s, 500).perMin - (g.BASE_INCOME + RARITY.common.income)) < 1e-9); // 탐사 중
  assert.ok(Math.abs(g.incomeBreakdown(s, 1500).perMin - home) < 1e-9); // 돌아옴
});

test('분류 완성 보너스와 전체 완성 보너스', () => {
  const s = g.newState('a', 0);
  for (const it of ITEMS.filter((i) => i.cat === 'pet')) {
    s.found[it.id] = 1;
    s.items[it.id] = 1;
  }
  assert.ok(g.catComplete(s, 'pet'));
  assert.equal(g.incomeBreakdown(s, 0).byCat.pet.mult, 1.25);
  for (const it of ITEMS) s.found[it.id] = 1;
  assert.ok(g.allComplete(s));
  assert.ok(Math.abs(g.incomeBreakdown(s, 0).finalMult - 1.5) < 1e-9);
});

test('판매와 개조', () => {
  const s = g.newState('a', 0);
  s.items['m_serum'] = 2;
  assert.equal(g.sellItem(s, 'm_serum'), 100);
  assert.equal(s.items['m_serum'], 1);
  assert.equal(g.sellItem(s, 'f_tuna'), 0);
  const c0 = UPGRADES.shelf.base;
  s.caps = c0 - 1;
  assert.ok(!g.buyUpgrade(s, 'shelf'));
  s.caps = c0;
  assert.ok(g.buyUpgrade(s, 'shelf'));
  assert.equal(s.upg.shelf, 1);
  assert.equal(s.caps, 0);
  assert.equal(g.upgradeCost('shelf', 1), Math.round(UPGRADES.shelf.base * UPGRADES.shelf.grow));
  s.items = {}; // 남은 전설 아이템의 수입을 빼고 계산
  assert.ok(Math.abs(g.incomeBreakdown(s, 0).perMin - g.BASE_INCOME * 1.15) < 1e-9);
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
