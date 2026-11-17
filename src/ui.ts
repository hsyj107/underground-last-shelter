// 화면(탭, 모달, 알림). 규칙은 state.ts, 장면은 scene.ts.
import {
  CATS,
  CAT_ORDER,
  CHAPTER_AFF,
  GENDERS,
  JOB_BY_ID,
  jobTitle,
  jobsOf,
  LOOK_OPTS,
  NAME_POOL,
  ORIGINS,
  ORIGIN_BY_ID,
  ITEMS,
  ITEM_BY_ID,
  RARITY,
  PROFS,
  RES,
  STAT_NAME,
  SURV_BY_ID,
  UPGRADES,
  FLOORS,
  TIER,
  tierOf,
  ZONES,
  KNOW_NAME,
  ZONE_BY_ID,
  PROF_BY_ID,
  TRAITS,
  TRAIT_BY_ID,
} from './data.ts';
import type { Cat, Gender, Look, ResKey, Stats, UpgKey } from './data.ts';
import { Scene } from './scene.ts';
import {
  affinity,
  availableCrew,
  awaySet,
  buffScale,
  buyUpgrade,
  catComplete,
  catFound,
  catTotal,
  chapterReached,
  claimExpedition,
  clearState,
  RATIONS,
  effectiveRation,
  resolveCrisis,
  setRation,
  weakestId,
  config,
  dayNumber,
  foundCount,
  gift,
  homeCrew,
  heads,
  isTired,
  isZoneOpen,
  flow,
  minutesLeft,
  loadState,
  newState,
  rollStats,
  offlineCapMs,
  previewExpedition,
  recruit,
  capacity,
  freeBeds,
  nextFloor,
    rejectVisitor,
  EAT,
  saveState,
  relatives,
  sellItem,
  sellPrice,
  startExpedition,
  talk,
  tapSurvivor,
  tick,
  upgradeCost,
  roleOf,
  ROLES,
  setRole,
  isSick,
  defense,
  nickname,
  loadHall,
  recordHall,
  workBoost,
} from './state.ts';
import type { GameEvent, Report, Role, State } from './state.ts';
import {
  tickEvents,
  resolveRaid,
  raidChoices,
  talkChance,
  buyOffer,
  sellRes,
  treat,
  treatCost,
  startRescue,
  previewBreach,
  breachFloor,
  marketMult,
} from './events.ts';
import type { Notice, RaidChoice, RaidResult, Gone } from './events.ts';
import { cutawayURL } from './cutaway.ts';
import { iconURL, lookPortraitURL, portraitURL, profPortraitURL } from './sprites.ts';

type Tab = 'home' | 'explore' | 'shelf' | 'crew';

let S: State;
let scene: Scene;
let tab: Tab = 'home';
let sel: { zone: string | null; members: string[] } = { zone: null, members: [] };
let shelfCat: Cat | 'all' = 'all';
let modalKind: string | null = null;
let say = '';
let bubbleTimer = 0;

/** 받침에 따라 조사를 붙인다 */
function josa(word: string, kind: 'iga' | 'eunneun' | 'eulreul' | 'euro'): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const has = code >= 0 && code % 28 !== 0;
  const rieul = code >= 0 && code % 28 === 8; // ㄹ 받침
  switch (kind) {
    case 'iga': return word + (has ? '이' : '가');
    case 'eunneun': return word + (has ? '은' : '는');
    case 'eulreul': return word + (has ? '을' : '를');
    case 'euro': return word + (has && !rieul ? '으로' : '로');
  }
}
const fmt = (n: number): string => Math.floor(n).toLocaleString('en-US');
const fmt2 = (n: number): string => (Math.round(n * 100) / 100).toString();

function timeText(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}분${sec % 60 ? ` ${sec % 60}초` : ''}`;
  const h = Math.floor(m / 60);
  return `${h}시간${m % 60 ? ` ${m % 60}분` : ''}`;
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector(sel) as T;

// ---------- 시작 ----------

export function startApp(root: HTMLElement): void {
  const sp = Number(new URLSearchParams(location.search).get('speed'));
  if (sp > 0) config.speed = sp;
  if (new URLSearchParams(location.search).has('reset')) clearState();

  root.innerHTML = `
    <div class="shell">
      <header id="hud">
        <div class="hud-l"><b id="hud-day"></b><span id="hud-name"></span></div>
        <div class="hud-c"><span class="cap">●</span> <b id="hud-caps">0</b><small id="hud-rate"></small></div>
        <button class="gear" data-act="settings" aria-label="설정">⚙</button>
      </header>
      <div id="stage">
        <canvas id="scene"></canvas>
        <div id="bubble" class="bubble hide"></div>
        <div id="stage-actions"></div>
      </div>
      <main id="panel"></main>
      <nav id="tabs">
        <button data-tab="home"><i>🏪</i>벙커<u></u></button>
        <button data-tab="explore"><i>🎒</i>탐사<u></u></button>
        <button data-tab="shelf"><i>🗄️</i>선반<u></u></button>
        <button data-tab="crew"><i>👥</i>생존자<u></u></button>
      </nav>
      <div id="modal" class="hide"></div>
      <div id="toasts"></div>
    </div>`;

  const loaded = loadState();
  const now = Date.now();
  let offline: { ms: number; food: number; water: number } | null = null;
  let events: GameEvent[] = [];
  if (loaded) {
    S = loaded;
    const before = { ...S.res };
    const gap = now - S.last;
    events = tick(S, now);
    if (gap > 120000) offline = { ms: gap, food: S.res.food - before.food, water: S.res.water - before.water };
  } else {
    S = newState('관리자', now);
  }

  scene = new Scene(
    $<HTMLCanvasElement>('#scene'),
    () => ({
      items: S.items,
      present: homeCrew(S, Date.now()),
      visitor: S.visitor,
      roles: S.role,
      sick: Object.keys(S.sick),
      alert: !!S.raid,
      bags: S.exps.filter((e) => e.end <= Date.now()).length,
      hour: new Date().getHours(),
    }),
    {
      onSurvivor: (id, lx, ly) => onTapSurvivor(id, lx, ly),
      onVisitor: () => openVisitor(),
      onBag: () => openBag(),
    },
  );
  scene.start();

  root.addEventListener('click', onClick);
  $('#modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget && modalKind !== 'intro' && modalKind !== 'over') closeModal();
  });
  document.querySelectorAll<HTMLElement>('#tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab as Tab;
      renderAll();
    }),
  );

  renderAll();
  if (!loaded) openIntro();
  else {
    if (offline) openOffline(offline.ms, offline.food, offline.water);
    handleEvents(events);
    handleNotices(tickEvents(S, now));
    autoOpen();
  }

  setInterval(step, 1000);
  setInterval(() => saveState(S), 10000);
  window.addEventListener('beforeunload', () => saveState(S));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveState(S);
    else step();
  });
}

function step(): void {
  if (!S || modalKind === 'intro') return;
  const events = tick(S, Date.now());
  if (events.length) handleEvents(events);
  handleNotices(tickEvents(S, Date.now()));
  autoOpen();
  updateHud();
  updateLive();
}

function handleEvents(events: GameEvent[]): void {
  for (const e of events) {
    if (e.type === 'visitor') toast('🚪 누군가 문을 두드린다…', 'warm');
    if (e.type === 'crisis') toast('⚠ 굶주림이 한계에 달했다…', 'bad');
    if (e.type === 'exp_done') toast(`🎒 ${ZONE_BY_ID[e.zone].name} 탐사대가 돌아왔다!`, 'good');
  }
  if (events.length) {
    saveState(S);
    if (modalKind === null) renderAll();
    else updateHud();
  }
}

// ---------- 공통 ----------

function toast(msg: string, kind = ''): void {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

function announce(id: string, chapters: number[], reward: number): void {
  const name = SURV_BY_ID[id]?.name ?? '';
  for (const c of chapters) toast(`📖 ${name}의 이야기 ${c + 1}장이 열렸어요`, 'good');
  if (reward) toast(`🎁 ${name}의 이야기를 끝까지 들었다! 뚜껑 +${reward}`, 'good');
}

function openModal(kind: string, html: string): void {
  modalKind = kind;
  const m = $('#modal');
  m.innerHTML = `<div class="dialog">${html}</div>`;
  m.classList.remove('hide');
}

function closeModal(): void {
  modalKind = null;
  say = '';
  $('#modal').classList.add('hide');
  $('#modal').innerHTML = '';
  renderAll();
}

function renderAll(): void {
  updateHud();
  document.querySelectorAll<HTMLElement>('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  renderPanel();
  renderStageActions();
  updateDots();
}

function updateHud(): void {
  const now = Date.now();
  $('#hud-day').textContent = `DAY ${dayNumber(S, now)}`;
  $('#hud-name').textContent = `B7 · ${S.name}`;
  $('#hud-caps').textContent = fmt(S.caps);
  const lowF = (minutesLeft(S, now, 'food') ?? 9999) < 60 || S.res.food <= 0;
  const lowW = (minutesLeft(S, now, 'water') ?? 9999) < 60 || S.res.water <= 0;
  $('#hud-rate').innerHTML = `<span class="${lowF ? 'low' : ''}">🍞 ${fmt(S.res.food)}</span> <span class="${lowW ? 'low' : ''}">💧 ${fmt(S.res.water)}</span>`;
}

function readyExps(now = Date.now()): number {
  return S.exps.filter((e) => e.end <= now).length;
}

function renderStageActions(): void {
  const now = Date.now();
  const parts: string[] = [];
  if (S.visitor) parts.push(`<button class="pill warm" data-act="visitor">🚪 방문자가 기다려요</button>`);
  const r = readyExps(now);
  if (r) parts.push(`<button class="pill good" data-act="bag">🎒 배낭 ${r}개 도착</button>`);
  if (S.raid) parts.push(`<button class="pill bad" data-act="raid">${S.raid.kind === 'raider' ? '⚔ 약탈자가 문 앞에!' : '🧟 좀비 떼가 몰려온다!'}</button>`);
  if (S.merchant && S.merchant.until > now) parts.push(`<button class="pill warm" data-act="merchant">🛒 상인이 왔어요</button>`);
  if (S.rescue && !S.exps.some((e) => e.rescue)) parts.push(`<button class="pill warm" data-act="rescue">📡 구조 신호</button>`);
  const sk = Object.keys(S.sick).length;
  if (sk) parts.push(`<button class="pill bad" data-act="tab-crew">🤒 앓는 사람 ${sk}명</button>`);
  $('#stage-actions').innerHTML = parts.join('');
}

function updateDots(): void {
  const now = Date.now();
  const dots: Record<Tab, boolean> = {
    home: readyExps(now) > 0 || !!S.visitor,
    explore: S.exps.length === 0 && availableCrew(S, now).length > 0 && S.stats.expeditions > 0,
    shelf: false,
    crew: !!S.visitor || Object.keys(S.sick).length > 0,
  };
  document.querySelectorAll<HTMLElement>('#tabs button').forEach((b) => b.classList.toggle('dot', dots[b.dataset.tab as Tab]));
}

function updateLive(): void {
  const now = Date.now();
  let rerender = false;
  document.querySelectorAll<HTMLElement>('[data-prog]').forEach((el) => {
    const e = S.exps.find((x) => x.id === el.dataset.prog);
    if (!e) return;
    const done = e.end <= now;
    const pct = done ? 100 : Math.min(100, ((now - e.start) / (e.end - e.start)) * 100);
    (el.firstElementChild as HTMLElement).style.width = `${pct}%`;
    const eta = document.querySelector<HTMLElement>(`[data-eta="${e.id}"]`);
    if (eta) eta.textContent = done ? '도착!' : `${timeText(e.end - now)} 남음`;
    if (done && el.dataset.done !== '1') rerender = true;
  });
  if (rerender && modalKind === null) renderAll();
  renderStageActions();
  updateDots();
}

// ---------- 탭 ----------

function renderPanel(): void {
  const p = $('#panel');
  const top = p.scrollTop;
  p.innerHTML = tab === 'home' ? homeHtml() : tab === 'explore' ? exploreHtml() : tab === 'shelf' ? shelfHtml() : crewHtml();
  p.scrollTop = top;
}

function pt(id: string, cls = 'pt', silhouette = false): string {
  return `<img class="${cls}" src="${portraitURL(id, silhouette)}" alt="">`;
}

function homeHtml(): string {
  const now = Date.now();
  let h = '';

  if (S.stats.expeditions === 0 && S.exps.length === 0) {
    h += `<section class="card tip"><h3>💡 처음이라면</h3>
      <p>1. <b>탐사</b> 탭에서 '동네 슈퍼마트'로 당신을 보내 보세요.<br>
      2. 돌아온 배낭을 열면 식량·물·약이 <b>비축</b>에 더해지고, 물건은 <b>선반</b> 도감에 채워집니다.<br>
      3. 사람이 늘수록 더 많이 먹어요. 비축이 바닥나면 누군가를 내보내야 할 수도 있어요.</p></section>`;
  }

  h += `<section class="card"><h3>🎒 탐사 현황</h3>`;
  if (!S.exps.length) {
    h += `<p class="dim">나가 있는 탐사대가 없어요. <b>탐사</b> 탭에서 보내 보세요.</p>`;
  } else {
    for (const e of S.exps) {
      const z = ZONE_BY_ID[e.zone];
      const done = e.end <= now;
      const pct = done ? 100 : Math.min(100, ((now - e.start) / (e.end - e.start)) * 100);
      h += `<div class="exp">
        <div class="exp-h"><span class="zi">${z.icon}</span><b>${z.name}</b>
          <span class="mem">${e.members.map((m) => pt(m, 'pt xs')).join('')}</span></div>
        <div class="bar" data-prog="${e.id}" data-done="${done ? 1 : 0}"><i style="width:${pct}%"></i></div>
        <div class="exp-f"><span data-eta="${e.id}">${done ? '도착!' : `${timeText(e.end - now)} 남음`}</span>
        ${done ? `<button class="btn primary sm" data-act="open-bag" data-id="${e.id}">배낭 열기</button>` : ''}</div>
      </div>`;
    }
  }
  h += `</section>`;

  h += supplyHtml(now);

  h += rolesHtml(now);
  h += floorHtml();
  h += `<section class="card"><h3>🛠 개조</h3>`;
  (Object.keys(UPGRADES) as UpgKey[]).forEach((k) => {
    const u = UPGRADES[k];
    const lv = S.upg[k];
    const maxed = lv >= u.max;
    const cost = upgradeCost(k, lv);
    h += `<div class="upg"><div class="ui">${u.icon}</div>
      <div class="ut"><b>${u.name} <small>Lv.${lv}/${u.max}</small></b><span>${u.text(lv)}${maxed ? '' : ` → ${u.text(lv + 1)}`}</span></div>
      ${maxed ? '<span class="max">MAX</span>' : `<button class="btn sm ${S.caps >= cost ? 'primary' : ''}" data-act="buy" data-key="${k}" ${S.caps >= cost ? '' : 'disabled'}>● ${fmt(cost)}</button>`}
    </div>`;
  });
  h += `</section>`;
  return h;
}

function rolesHtml(now: number): string {
  if (!S.crew.length) return '';
  const cnt = (r: Role): number => S.crew.filter((id) => roleOf(S, id) === r).length;
  const wb = Math.round(workBoost(S) * 100);
  const fl = flow(S, now);
  const wk = 1 + workBoost(S);
  const addF = fl.prod.food - fl.prod.food / wk;
  const addW = fl.prod.water - fl.prod.water / wk;
  const sick = Object.keys(S.sick).length;
  return `<section class="card"><h3>🛡 벙커 살림</h3>
    <p class="sm">🎒 탐사조 <b>${cnt('scout') + 1}</b> · 🌱 생산조 <b>${cnt('work')}</b> ${wb ? `<span class="ok">(식량·식수 +${wb}%)</span>` : ''}</p>
    ${wb ? `<p class="ok sm">🌱 생산조가 밭과 정수 통을 돌봐요 → 🍞 +${fmt2(addF)}/분 · 💧 +${fmt2(addW)}/분</p>` : '<p class="dim sm">🌱 생산조를 정하면 밭과 정수 통이 생기고 식량·식수가 늘어요.</p>'}
    <p class="sm"> · 🛡 방어조 <b>${cnt('guard')}</b></p>
    <p class="sm">문을 지키는 힘 <b>${defense(S, now)}</b> ${cnt('guard') ? '' : '<em class="warn">— 방어조가 없어요. 습격과 층 돌파에는 방어조가 필요해요.</em>'}</p>
    ${sick ? `<p class="bad sm">🤒 앓는 사람 ${sick}명 — 생존자 탭에서 치료하세요.</p>` : ''}
    <p class="dim sm">생존자 탭에서 사람을 눌러 맡은 일을 정할 수 있어요.</p></section>`;
}

function floorHtml(): string {
  const f = FLOORS[Math.min(S.floor, FLOORS.length - 1)];
  const nx = nextFloor(S);
  const used = S.crew.length;
  const cap = capacity(S);
  const beds = Array.from({ length: Math.max(cap, used) }, (_, i) => `<i class="bed ${i < used ? 'used' : ''}"></i>`).join('');
  return `<section class="card floor"><h3>${f.icon} 거주 구역 <small>${f.name}</small></h3>
    <p class="dim sm">${f.blurb}</p>
    <img class="cutaway" src="${cutawayURL(S.floor, used, Object.keys(S.sick).length)}" alt="벙커 단면도">
    <div class="beds">${beds}</div>
    <p class="sm"><b>침대 ${used}/${cap}</b> ${used >= cap ? '<em class="bad">— 가득 찼어요. 새 손님을 받으려면 넓혀야 해요.</em>' : `<span class="dim">· ${cap - used}자리 남음</span>`}</p>
    ${
      nx
        ? `<div class="upg"><div class="ui">${nx.icon}</div>
      <div class="ut"><b>아래로 파 내려가기 <small>${nx.name}</small></b><span>수용 ${cap}명 → ${nx.cap}명</span></div>
      <button class="btn sm ${S.caps >= nx.cost ? 'primary' : ''}" data-act="breach-open" ${S.caps >= nx.cost ? '' : 'disabled'}>⛏ ● ${fmt(nx.cost)}</button></div>`
        : '<p class="dim sm">더 이상 파 내려갈 곳이 없어요. 지금이 가장 깊은 층이에요.</p>'
    }</section>`;
}

function resRow(k: ResKey, now: number): string {
  const f = flow(S, now);
  const cap = k === 'med' ? 60 : f.cap;
  const v = S.res[k];
  let rate = '';
  let left = '';
  if (k !== 'med') {
    const net = f.prod[k] - f.cons[k];
    rate = `<small class="${net < 0 ? 'bad' : 'ok'}">+${fmt2(f.prod[k])} −${fmt2(f.cons[k])} /분</small>`;
    const m = minutesLeft(S, now, k);
    left = m === null ? '' : v <= 0 ? '<em class="bad">바닥남</em>' : `<em class="${m < 60 ? 'bad' : 'warn'}">${timeText(m * 60000)} 뒤 바닥</em>`;
  } else rate = '<small>탐사로만 얻어요 · 다친 사람 치료에 써요</small>';
  return `<li><span>${RES[k].icon} ${RES[k].name} <b>${fmt(v)}</b><small>/${cap}</small> ${left}</span>${rate}<div class="bar res-${k}"><i style="width:${Math.min(100, (v / cap) * 100)}%"></i></div></li>`;
}

function supplyHtml(now: number): string {
  const eff = effectiveRation(S);
  let h = `<section class="card"><h3>📦 비축 <small>${heads(S)}명이 먹고 마셔요</small></h3><ul class="res">`;
  h += (['food', 'water', 'med'] as ResKey[]).map((k) => resRow(k, now)).join('');
  h += `</ul>`;
  if (eff !== S.ration) h += `<p class="warn sm">⚠ 물자가 바닥나서 극한 절식 중이에요. 탐사 사망 확률이 오르고 호감을 얻기 어려워요.</p>`;
  h += `<div class="rations">`;
  (Object.keys(RATIONS) as (keyof typeof RATIONS)[]).forEach((k) => {
    h += `<button class="chip ${S.ration === k ? 'on' : ''}" data-act="ration" data-id="${k}">${RATIONS[k].icon} ${RATIONS[k].name}</button>`;
  });
  h += `</div><p class="dim sm">${RATIONS[S.ration].text}</p>`;
  h += `<p class="dim sm">자리를 비워도 벙커는 최대 ${Math.round(offlineCapMs(S) / 3600000)}시간까지 돌아가요.</p></section>`;
  return h;
}

/** 이 구역에 유리한 분야를 가진 사람의 해당 분야들 */
function matchKnow(id: string, zoneId: string): string[] {
  const z = ZONES.find((x) => x.id === zoneId);
  const d = SURV_BY_ID[id];
  if (!z || !d) return [];
  return d.know.filter((k) => z.know.includes(k)).map((k) => KNOW_NAME[k]);
}

function zoneExperts(zoneId: string, now: number): string {
  const ids = ['me', ...S.crew].filter((id) => matchKnow(id, zoneId).length > 0 && !awaySet(S, now).has(id) && !isTired(S, id, now));
  return ids.length ? ` → <b>${ids.map((id) => SURV_BY_ID[id].name).join(', ')}</b>` : ' → 지금 없음';
}

/** 성별 표시 (♂ 파랑 / ♀ 분홍) */
function gm(id: string): string {
  const g = SURV_BY_ID[id]?.gender;
  return g ? `<i class="gd gd-${g}" title="${g === 'f' ? '여성' : '남성'}">${g === 'f' ? '♀' : '♂'}</i>` : '';
}
const gname = (id: string): string => (SURV_BY_ID[id]?.gender === 'f' ? '여성' : '남성');

function memberChip(id: string, now: number, zoneId = ''): string {
  const d = SURV_BY_ID[id];
  const away = awaySet(S, now).has(id);
  const tired = isTired(S, id, now);
  const on = sel.members.includes(id);
  const role = roleOf(S, id);
  const ok = !away && !tired && !isSick(S, id) && role === 'scout';
  const note = away ? '탐사 중' : isSick(S, id) ? '앓는 중' : tired ? '부상' : role !== 'scout' ? ROLES[role].name : id === 'me' ? '나' : `전투 ${d.stats.str}`;
  const known = matchKnow(id, zoneId);
  const expert = known.length > 0;
  return `<button class="chip ${on ? 'on' : ''} ${expert ? 'exp' : ''}" data-act="member" data-id="${id}" ${ok ? '' : 'disabled'}>
    ${expert ? '<i class="expbadge">🎓 경험자</i>' : ''}${pt(id, 'pt sm')}<span class="cn"><b>${gm(id)}${d.name}</b><small>${expert ? `${known.join('·')} · ` : ''}${note}</small></span></button>`;
}

function exploreHtml(): string {
  const now = Date.now();
  const found = foundCount(S);
  let h = '';
  if (S.rescue && !S.exps.some((e) => e.rescue)) {
    const z = ZONE_BY_ID[S.rescue.zone];
    h += `<section class="card tip"><h3>📡 구조 신호</h3><p><b>${z.icon} ${z.name}</b>에서 <b>${PROF_BY_ID[S.rescue.prof].title}</b>이(가) 갇혀 있다는 신호가 들어왔어요. ${timeText(S.rescue.deadline - now)} 안에 그 구역으로 탐사대를 보내면 구해 올 수 있어요. 들키면 늦습니다.</p></section>`;
  }
  h += `<p class="lead">탐사대는 1~3명. 같이 가면 전리품이 늘어요. 들키면 <b>죽는 사람이 나올 수 있고, 죽은 사람은 돌아오지 않아요.</b> 전투가 센 사람과 의료가 높은 사람이 함께 가면 덜 위험해요.</p>`;
  for (const z of ZONES) {
    const open = isZoneOpen(S, z);
    const cur = sel.zone === z.id;
    const skulls = '☠'.repeat(z.D) + `<span class="dim">${'☠'.repeat(5 - z.D)}</span>`;
    h += `<section class="card zone ${open ? '' : 'locked'} ${cur ? 'cur' : ''}">
      <button class="zone-h" data-act="zone" data-id="${z.id}" ${open ? '' : 'disabled'}>
        <span class="zi">${open ? z.icon : '🔒'}</span>
        <span class="zt"><b>${z.name}</b><small>${open ? z.blurb : `도감 ${z.unlock}종 발견 시 열려요 (${found}/${z.unlock})`}</small>${open ? `<small class="know">🎓 ${z.know.map((k) => KNOW_NAME[k]).join(' · ')} 경험자 유리${zoneExperts(z.id, now)}</small>` : ''}</span>
        <span class="zm"><i class="sk">${skulls}</i><small>${z.minutes}분~</small></span>
      </button>`;
    if (cur && open) {
      const crew = ['me', ...S.crew].sort((x, y) => Number(matchKnow(y, z.id).length > 0) - Number(matchKnow(x, z.id).length > 0));
      const free = crew.filter((id) => availableCrew(S, now).includes(id) && matchKnow(id, z.id).length > 0);
      const hint = free.length
        ? `<p class="exphint ok">🎓 이 구역에 유리한 사람: ${free.map((id) => `<b>${SURV_BY_ID[id].name}</b>(${matchKnow(id, z.id).join('·')})`).join(', ')} — 함께 보내면 들킬 확률 -15%, 전리품 +1, 물자 +15%</p>`
        : `<p class="exphint dim">🎓 지금 이 구역을 잘 아는 사람이 없어요. (필요한 경험: ${z.know.map((k) => KNOW_NAME[k]).join(' · ')})</p>`;
      const pv = sel.members.length ? previewExpedition(S, z.id, sel.members) : null;
      const riskPct = pv ? Math.round(pv.risk * 100) : 0;
      const deathPct = pv ? Math.round(pv.anyDeath * 100) : 0;
      const deathList = pv
        ? sel.members.filter((m) => pv.deathIf[m] > 0).map((m) => `${SURV_BY_ID[m].name} ${Math.round(pv.deathIf[m] * 100)}%`).join(' · ')
        : '';
      h += `<div class="team">${hint}<div class="chips">${crew.map((id) => memberChip(id, now, z.id)).join('')}</div>
        ${
          pv
            ? `<div class="pv"><span>⏱ ${timeText(pv.ms)}</span><span>🎒 전리품 ${pv.loot}개</span>
               <span class="${riskPct > 25 ? 'bad' : riskPct > 0 ? 'warn' : 'ok'}">⚠ 들킬 확률 ${riskPct}%</span>
               <span class="${deathPct >= 10 ? 'bad' : deathPct > 0 ? 'warn' : 'ok'}">☠ 누군가 죽을 확률 ${deathPct}%</span></div>
               ${deathList ? `<p class="dim sm">들키면 죽을 확률: ${deathList}</p>` : ''}
               ${pv.experts.length ? `<p class="ok sm">🎓 ${pv.experts.map((m) => SURV_BY_ID[m].name).join('·')}: 이 구역을 잘 알아요 (들킬 확률 -${Math.round((1 - 0.85 ** pv.experts.length) * 100)}% · 전리품 +${pv.experts.length} · 물자 +${15 * pv.experts.length}%)</p>` : ''}
               ${pv.supplyMult < 0.95 ? `<p class="warn sm">🧹 이 구역은 최근 많이 털려서 물자가 ${Math.round((1 - pv.supplyMult) * 100)}% 줄어요. 한동안 쉬게 두면 돌아와요.</p>` : ''}
               ${pv.friends ? `<p class="dim sm">🤝 친한 사이가 함께 가서 서로 챙겨요 (들킬 확률 -10% · 죽을 확률 -15%)</p>` : ''}
               ${pv.rivals ? `<p class="warn sm">⚡ 사이 나쁜 두 사람이 함께 가요 (들킬 확률 +20%)</p>` : ''}`
            : '<div class="pv dim">함께 갈 사람을 골라 주세요.</div>'
        }
        <button class="btn primary wide" data-act="go" ${pv ? '' : 'disabled'}>출발하기</button>
        ${S.rescue && S.rescue.zone === z.id && !S.exps.some((e) => e.rescue) ? `<button class="btn wide" data-act="rescue-go" ${pv ? '' : 'disabled'}>📡 구조 신호를 따라 나가기 (${PROF_BY_ID[S.rescue.prof].title})</button>` : ''}</div>`;
    }
    h += `</section>`;
  }
  return h;
}

function shelfHtml(): string {
  const total = ITEMS.length;
  const found = foundCount(S);
  let h = `<section class="card"><h3>🗄️ 진열 도감 <b class="big">${found}/${total}</b></h3>
    <div class="bar"><i style="width:${(found / total) * 100}%"></i></div>
    <div class="cats">`;
  for (const c of CAT_ORDER) {
    const f = catFound(S, c);
    const t = catTotal(c);
    h += `<span class="cs ${catComplete(S, c) ? 'done' : ''}">${CATS[c].icon} ${f}/${t}${catComplete(S, c) ? ' ✓' : ''}</span>`;
  }
  h += `</div><p class="dim sm">분류를 모두 채우면 벙커에 효과가 생겨요. 🍞식료품: 식량 생산 +25% · 🧴생활: 식수 생산 +25% · 💊의약품: 탐사 사망 -10% · 🔌전자: 탐사 시간 -10% · 📚문화: 대화 호감 +25% · 🐾반려: 전리품 +1</p></section>`;
  h += `<div class="filters"><button class="chip sm ${shelfCat === 'all' ? 'on' : ''}" data-act="cat" data-c="all">전체</button>`;
  for (const c of CAT_ORDER) h += `<button class="chip sm ${shelfCat === c ? 'on' : ''}" data-act="cat" data-c="${c}">${CATS[c].icon}</button>`;
  h += `</div><div class="grid">`;
  for (const it of ITEMS) {
    if (shelfCat !== 'all' && it.cat !== shelfCat) continue;
    const fnd = !!S.found[it.id];
    const n = S.items[it.id] ?? 0;
    h += `<button class="tile r-${it.rarity} ${fnd ? '' : 'unk'}" data-act="item" data-id="${it.id}">
      <img src="${iconURL(it.id, !fnd)}" alt=""><span class="nm">${fnd ? it.name : '???'}</span>${n > 0 ? `<b class="cnt">×${n}</b>` : ''}</button>`;
  }
  h += `</div>`;
  return h;
}

function crewHtml(): string {
  const now = Date.now();
  const away = awaySet(S, now);
  let h = '';
  if (S.visitor) {
    h += `<button class="card visit" data-act="visitor">${pt(S.visitor, 'pt', true)}<span><b>🚪 문 앞에 누군가 서 있다</b><small>눌러서 문을 열어 보세요</small></span></button>`;
  }
  const row = (id: string): string => {
    const d = SURV_BY_ID[id];
    const a = affinity(S, id);
    const ch = chapterReached(S, id);
    const r = roleOf(S, id);
    const status = isSick(S, id)
      ? '<em class="st tired">🤒 앓는 중</em>'
      : away.has(id)
        ? '<em class="st away">탐사 중</em>'
        : isTired(S, id, now)
          ? '<em class="st tired">지침</em>'
          : `<em class="st home">${ROLES[r].icon} ${ROLES[r].name}</em>`;
    return `<button class="card crew" data-act="surv" data-id="${id}">
      ${pt(id)}
      <span class="ct"><b>${gm(id)}${d.name} ${status}</b><small>${gname(id)} · ${d.title}</small>
        ${id === 'me' ? '' : `<small class="buff">${d.buff.text}</small>${cardRel(id)}
        <span class="aff"><span class="bar"><i style="width:${a}%"></i>${CHAPTER_AFF.map((t) => `<u style="left:${t}%"></u>`).join('')}</span><span class="pips">📖 ${ch}/3</span></span>`}
      </span></button>`;
  };
  h = `<p class="dim sm bedline">🛏 침대 ${S.crew.length}/${capacity(S)}</p>` + h;
  h += row('me');
  for (const id of S.crew) h += row(id);
  const here = new Set([...S.crew, ...(S.visitor ? [S.visitor] : [])].map((id) => S.people[id]?.prof));
  const open = PROFS.filter((d) => !here.has(d.id) && d.unlock.type === 'start').length;
  if (open > 0) {
    h += `<div class="card crew lockd"><span class="ct"><b>아직 만나지 못한 사람들 ${open}종</b><small>언제든 문을 두드릴 수 있다. 누가 올지는 모른다.</small></span></div>`;
  }
  for (const d of PROFS) {
    if (here.has(d.id) || d.unlock.type === 'start') continue;
    h += `<div class="card crew lockd"><img class="pt" src="${profPortraitURL(d.id)}" alt=""><span class="ct"><b>???</b><small>${d.hint}</small></span></div>`;
  }
  if (S.dead.length) {
    h += `<section class="card grave"><h3>🪦 추모비 <b class="big">${S.dead.length}</b></h3><ul class="graves">`;
    for (const g of [...S.dead].reverse()) {
      const d = SURV_BY_ID[g.id];
      h += `<li>${pt(g.id, 'pt xs', true)}<span><b>${gm(g.id)}${d.name}</b> <small>${d.title} · ${g.day}일째 · ${graveWhere(g.zone)}</small><i>${g.last}</i></span></li>`;
    }
    h += `</ul></section>`;
  }
  return h;
}

// ---------- 모달 ----------

// ---------- 시작 화면: 출신 · 직업 · 외형 ----------

interface CC {
  trait: string;
  step: number;
  origin: string;
  job: string;
  name: string;
  gender: Gender;
  skin: string;
  hair: string;
  style: Look['style'];
  top: string;
  acc: string[];
  stats: Stats | null;
  rerolls: number;
}
let cc: CC;

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/** 직업마다 다른 작업복: 소매·바지·신발 색과 소품 (윗옷 색은 직접 고른다) */
const JOB_OUTFIT: Record<string, { top2: string; pants: string; shoes: string; acc: string[] }> = {
  medic: { top2: '#f4efe4', pants: '#5a7a8a', shoes: '#f4efe4', acc: ['cross'] },
  engineer: { top2: '#d8a838', pants: '#3a4a5a', shoes: '#3a2a22', acc: ['cap', 'toolbelt'] },
  soldier: { top2: '#5a6a3a', pants: '#4a5a2a', shoes: '#2a2a22', acc: ['camo'] },
  merchant: { top2: '#c8a050', pants: '#3a3a4a', shoes: '#4a3a2a', acc: ['glasses', 'tie'] },
  clerk: { top2: '#8a8a96', pants: '#4a4a54', shoes: '#2a2a2a', acc: ['badge'] },
};

function ccLook(): Look {
  const o = ORIGIN_BY_ID[cc.origin];
  const jo = JOB_OUTFIT[cc.job] ?? JOB_OUTFIT.clerk;
  const acc = [...new Set([...o.acc, ...jo.acc, ...cc.acc])].filter((a) => !(cc.gender === 'f' && a === 'beard'));
  return {
    skin: cc.skin,
    hair: cc.hair,
    style: cc.style,
    top: cc.top,
    top2: jo.top2,
    pants: jo.pants,
    shoes: jo.shoes,
    f: cc.gender === 'f',
    skirt: cc.gender === 'f',
    acc,
  };
}

function readName(): void {
  const el = document.getElementById('cc-name') as HTMLInputElement | null;
  if (el) cc.name = el.value;
}

function openIntro(): void {
  cc = {
    step: 0,
    origin: 'tenant',
    job: 'clerk',
    trait: pick(TRAITS).id,
    name: pick(NAME_POOL.m),
    gender: 'm',
    skin: pick(LOOK_OPTS.skins.slice(0, 4)),
    hair: pick(LOOK_OPTS.hairs.slice(0, 3)),
    style: 'short',
    top: LOOK_OPTS.tops[0],
    acc: [],
    stats: null,
    rerolls: 2,
  };
  renderCreate();
}

function statBars(st: Stats, o: string, j: string): string {
  const jr = JOB_BY_ID[j].range;
  const ob = ORIGIN_BY_ID[o].bonus;
  return (Object.keys(STAT_NAME) as (keyof Stats)[])
    .map((k) => {
      const lo = jr[k][0] + (ob[k] ?? 0);
      const hi = Math.min(10, jr[k][1] + (ob[k] ?? 0));
      return `<div class="sb"><span>${STAT_NAME[k]}</span><div class="bar"><i style="width:${st[k] * 10}%"></i></div><b>${st[k]}</b><small>(${lo}~${hi})</small></div>`;
    })
    .join('');
}

function renderCreate(): void {
  const dots = [0, 1, 2, 3].map((i) => `<i class="${i === cc.step ? 'on' : i < cc.step ? 'done' : ''}"></i>`).join('');
  let body = '';
  let next = '다음';
  if (cc.step === 0) {
    body = `<h2>지하 7층의 종말 편의점</h2>
      <p class="story">대형 복합단지의 가장 아래층, 주차장 옆에 불이 꺼지지 않은 작은 편의점이 있었다.<br>위에서 무슨 일이 벌어졌는지는 아무도 말하지 않는다. 문 두드리는 소리와 비명이 끊긴 뒤, 이 층에서 책임질 수 있는 사람은 당신뿐이다.<br>지금부터 당신이 이 대피소의 <b>관리자</b>다.</p>
      <h3>사태가 터졌을 때, 당신은…</h3>
      <div class="opts">${ORIGINS.map(
        (o) => `<button class="opt ${cc.origin === o.id ? 'on' : ''}" data-act="cc-origin" data-id="${o.id}"><i>${o.icon}</i><span><b>${o.name}</b><small>${o.blurb}</small><em>${o.perk}</em></span></button>`,
      ).join('')}</div>`;
  } else if (cc.step === 1) {
    body = `<h2>하던 일</h2>
      <p class="dim sm">${ORIGIN_BY_ID[cc.origin].icon} ${ORIGIN_BY_ID[cc.origin].name} 중에서 고를 수 있는 일이에요. 직업에 따라 능력치가 굴려지는 범위와 시작 물자가 달라지고, 출신 보정은 그 위에 더해집니다.</p>
      <div class="opts">${jobsOf(cc.origin)
        .map((j) => {
          const c = ORIGIN_BY_ID[cc.origin].jobs[j.id];
          return `<button class="opt ${cc.job === j.id ? 'on' : ''}" data-act="cc-job" data-id="${j.id}"><i>${j.icon}</i><span><b>${c.title}</b><small>${c.blurb}</small><em>${j.perk}</em></span></button>`;
        })
        .join('')}</div>`;
  } else if (cc.step === 2) {
    const sw = (act: string, list: string[], cur: string): string =>
      list.map((c) => `<button class="sw ${cur === c ? 'on' : ''}" style="background:${c}" data-act="${act}" data-id="${c}" aria-label="${c}"></button>`).join('');
    body = `<h2>당신은</h2>
      <div class="cc-prev"><img class="pt lg" src="${lookPortraitURL(ccLook())}" alt=""></div>
      <label class="nm">이름<input id="cc-name" maxlength="8" value="${cc.name}" autocomplete="off"></label>
      <button class="btn sm" data-act="cc-rname">🎲 이름 무작위</button>
      <div class="cc-row"><b>성별</b>${GENDERS.map((g) => `<button class="chip sm ${cc.gender === g.id ? 'on' : ''}" data-act="cc-gender" data-id="${g.id}">${g.name}</button>`).join('')}</div>
      <div class="cc-row"><b>피부</b>${sw('cc-skin', LOOK_OPTS.skins, cc.skin)}</div>
      <div class="cc-row"><b>머리색</b>${sw('cc-hair', LOOK_OPTS.hairs, cc.hair)}</div>
      <div class="cc-row"><b>머리</b>${LOOK_OPTS.styles.map((st) => `<button class="chip sm ${cc.style === st.id ? 'on' : ''}" data-act="cc-style" data-id="${st.id}">${st.name}</button>`).join('')}</div>
      <div class="cc-row"><b>옷</b>${sw('cc-top', LOOK_OPTS.tops, cc.top)}</div>
      <div class="cc-row"><b>특징</b>${LOOK_OPTS.accs.filter((a) => !(cc.gender === 'f' && a.id === 'beard')).map((a) => `<button class="chip sm ${cc.acc.includes(a.id) ? 'on' : ''}" data-act="cc-acc" data-id="${a.id}">${a.name}</button>`).join('')}</div>`;
  } else {
    if (!cc.stats) cc.stats = rollStats(cc.origin, cc.job);
    const o = ORIGIN_BY_ID[cc.origin];
    const j = JOB_BY_ID[cc.job];
    next = '이 사람으로 시작';
    body = `<h2>${cc.name || '관리자'}</h2>
      <div class="cc-prev"><img class="pt lg" src="${lookPortraitURL(ccLook())}" alt=""></div>
      <p class="story sm">${o.icon} ${o.name} · ${j.icon} ${jobTitle(cc.origin, cc.job)}</p>
      <p class="dim sm">${o.jobs[cc.job].blurb}</p>
      <div class="stats-roll">${statBars(cc.stats, cc.origin, cc.job)}</div>
      <p class="dim sm">능력치는 직업·출신 범위 안에서 무작위로 정해져요. 마음에 안 들면 다시 굴릴 수 있어요 (${cc.rerolls}번 남음).</p>
      <button class="btn wide" data-act="cc-roll" ${cc.rerolls > 0 ? '' : 'disabled'}>🎲 다시 굴리기</button>
      <p class="dim sm">출신 · ${o.perk}<br>직업 · ${j.perk}</p>
      <div class="cc-row"><b>지휘 특성</b>${TRAITS.map((x) => `<button class="chip sm ${cc.trait === x.id ? 'on' : ''}" data-act="cc-trait" data-id="${x.id}">${x.icon} ${x.name}</button>`).join('')}</div>
      <p class="dim sm">${TRAIT_BY_ID[cc.trait].icon} ${TRAIT_BY_ID[cc.trait].text}</p>`;
  }
  openModal(
    'intro',
    `<div class="cc-dots">${dots}</div>${body}
    <div class="row2">${cc.step > 0 ? '<button class="btn" data-act="cc-back">이전</button>' : '<span></span>'}<button class="btn primary" data-act="${cc.step === 3 ? 'intro-start' : 'cc-next'}">${next}</button></div>`,
  );
}

function openOffline(ms: number, food: number, water: number): void {
  const d = (n: number): string => (n >= 0 ? `+${fmt(n)}` : `−${fmt(-n)}`);
  openModal(
    'offline',
    `<h2>돌아왔군요, ${S.name}</h2>
    <p class="story">${timeText(ms)} 동안 자리를 비웠어요.<br>그동안 비축은 🍞 <b>${d(food)}</b> · 💧 <b>${d(water)}</b> 만큼 변했습니다.</p>
    <button class="btn primary wide" data-act="close">챙기기</button>`,
  );
}

function openSettings(): void {
  openModal(
    'settings',
    `<h2>설정</h2>
    <p class="dim">저장은 이 기기의 브라우저에만 됩니다. 접속하지 않아도 시간은 흘러 식량과 물이 줄고 탐사가 진행돼요.</p>
    <p class="dim sm">시험용: 주소 끝에 <b>?speed=30</b> 을 붙이면 시간이 30배 빨라져요.</p>
    <button class="btn danger wide" data-act="reset1">처음부터 다시 하기</button>
    <button class="btn wide" data-act="close">닫기</button>`,
  );
}

function openVisitor(): void {
  const id = S.visitor;
  if (!id) return;
  const d = SURV_BY_ID[id];
  openModal(
    'visitor',
    `<div class="vis">${pt(id, 'pt lg')}</div>
    <h2>${gm(id)}${d.name} <small>${gname(id)} · ${d.title}</small></h2>
    <p class="story">${d.intro}</p>
    ${TIER[tierOf(d.prof)].label ? `<p class="tier tier-${tierOf(d.prof)}">⭐ ${TIER[tierOf(d.prof)].label}</p>` : ''}
    <p class="statline">${(Object.keys(STAT_NAME) as (keyof typeof STAT_NAME)[]).map((k) => `<span>${STAT_NAME[k]} <b>${d.stats[k]}</b></span>`).join('')}</p>
    <p class="buffline">✨ ${d.buff.text}</p>
    <p class="dim sm">한 명 늘 때마다 분당 식량 ${fmt2(EAT.food)} · 식수 ${fmt2(EAT.water)}씩 더 먹어요. 지금 ${heads(S)}명이 지내고 있어요.</p>
    <p class="sm ${freeBeds(S) > 0 ? 'dim' : 'bad'}">🛏 침대 ${S.crew.length}/${capacity(S)}${freeBeds(S) > 0 ? '' : ' — 자리가 없어요. 거주 구역을 넓히기 전에는 받을 수 없어요.'}</p>
    <button class="btn primary wide" data-act="recruit" data-id="${id}" ${freeBeds(S) > 0 ? '' : 'disabled'}>들어오세요</button>
    <button class="btn wide" data-act="close">조금만 더 기다려 주세요</button>
    <button class="btn danger wide" data-act="reject">미안하지만 받아 줄 수 없어요</button>`,
  );
}

function openCrisis(): void {
  const wid = weakestId(S);
  const w = wid ? SURV_BY_ID[wid] : null;
  openModal(
    'crisis',
    `<h2>⚠ 식량이 바닥난 지 오래다</h2>
    <p class="story">밤새 배 고픈 소리가 벙커에 울린다. 누군가 조용히 말했다. "…입이 하나 줄면 다들 버티겠죠."</p>
    ${w ? `<div class="lost">${pt(w.id, 'pt sm')}<span><b>${w.name}</b> <small>${w.title}</small><i>가장 도움이 안 되는 입이라고, 모두가 생각한다.</i></span></div>` : ''}
    ${w ? `<button class="btn danger wide" data-act="crisis-exile">${josa(w.name, 'eulreul')} 내보낸다</button>` : ''}
    <button class="btn wide" data-act="crisis-endure">모두 굶고 버틴다 (전원 호감도 -10, 3시간 유예)</button>
    <p class="dim sm">식량과 물을 구해 오면 위기는 지나갑니다. 선택을 미룰 수는 없어요.</p>`,
  );
}

function openBag(expId?: string): void {
  const now = Date.now();
  const e = expId ? S.exps.find((x) => x.id === expId) : S.exps.find((x) => x.end <= now);
  if (!e) return;
  const rep = claimExpedition(S, e.id, now);
  if (!rep) return;
  saveState(S);
  openModal('report', reportHtml(rep));
  for (const c of rep.chapters) announce(c.id, [c.chapter], 0);
  if (rep.rewards) toast(`🎁 이야기를 끝까지 들었다! 뚜껑 +${rep.rewards}`, 'good');
  scene.burst(20, 150, 'spark', 8);
}

function reportHtml(r: Report): string {
  const z = ZONE_BY_ID[r.zone];
  const list = r.items
    .map((it, i) => {
      const d = ITEM_BY_ID[it.id];
      return `<li class="r-${d.rarity}" style="animation-delay:${0.25 + i * 0.22}s"><img src="${iconURL(it.id)}" alt=""><span>${d.name}</span><em>${RARITY[d.rarity].name}</em>${it.isNew ? '<b class="new">NEW</b>' : ''}</li>`;
    })
    .join('');
  const lost = r.deaths
    .map((d) => `<div class="lost">${pt(d.id, 'pt sm', true)}<span><b>${d.name}</b> <small>${d.title}</small><i>${d.last}</i></span></div>`)
    .join('');
  return `<h2>${r.deaths.length ? '🕯 돌아오지 못한 사람이 있다' : r.caught ? '😱 간신히 도망쳐 왔다' : '🎒 탐사대 귀환!'}</h2>
    <p class="story">${z.icon} ${z.name} — ${r.line}</p>
    ${lost}
    ${r.bonds.map((b) => `<p class="${b.kind === 'rival' ? 'warn' : 'ok'} sm">${b.kind === 'friend' ? '🤝' : b.kind === 'mended' ? '🕊' : '⚡'} ${SURV_BY_ID[b.a].name} · ${SURV_BY_ID[b.b].name} — ${b.kind === 'friend' ? '같이 다녀오면서 가까워졌다' : b.kind === 'mended' ? '같이 고생하며 서먹함이 풀렸다' : '서로 탓하다 사이가 틀어졌다'}</p>`).join('')}
    ${r.grief.length ? `<p class="dim sm">💔 친구를 잃은 ${r.grief.map((g) => SURV_BY_ID[g].name).join(', ')} — 한참 말이 없다. (호감도 -8, 잠시 쉼)</p>` : ''}
    <ul class="loot">${list}</ul>
    <p class="supplies">${(['food', 'water', 'med'] as ResKey[]).filter((k) => r.supplies[k] > 0).map((k) => `${RES[k].icon} ${RES[k].name} <b>+${r.supplies[k]}</b>`).join(' · ')}</p>
    <p class="gain">● +${fmt(r.caps)}${r.bonusCaps ? ` <small>(+${fmt(r.bonusCaps)} ${r.firstClear ? '첫 탐사·' : ''}새 발견 보너스)</small>` : ''}</p>
    <button class="btn primary wide" data-act="close">선반에 올리기</button>`;
}

function itemModal(id: string): void {
  const d = ITEM_BY_ID[id];
  const fnd = !!S.found[id];
  const n = S.items[id] ?? 0;
  const lovers = S.crew.map((c) => SURV_BY_ID[c]).filter((s) => s && s.likes.items.includes(id)).map((s) => s.name);
  const where = ZONES.filter((z) => z.cats[d.cat]).map((z) => z.icon + z.name);
  const body = fnd
    ? `<p class="story">${d.desc}</p>
       <ul class="lines"><li><span>분류</span><b>${CATS[d.cat].icon} ${CATS[d.cat].name}</b></li>
       <li><span>보유</span><b>${n}개</b></li>
       <li><span>팔면</span><b>● ${sellPrice(S, id, Date.now())}</b></li></ul>
       ${lovers.length ? `<p class="dim sm">💝 ${josa(lovers.join(', '), 'iga')} 아주 좋아해요.</p>` : ''}
       <button class="btn wide" data-act="sell" data-id="${id}" ${n > 0 ? '' : 'disabled'}>1개 팔기 (● +${sellPrice(S, id, Date.now())})</button>`
    : `<p class="story">아직 찾지 못한 물건이에요.</p>
       <p class="dim sm">이런 곳에서 나올지도 몰라요: ${where.join(', ')}</p>`;
  openModal(
    'item',
    `<div class="item-h"><img class="big-icon" src="${iconURL(id, !fnd)}" alt=""><div><h2>${fnd ? d.name : '???'}</h2><span class="tag r-${d.rarity}">${RARITY[d.rarity].name}</span></div></div>${body}
     <button class="btn wide" data-act="close">닫기</button>`,
  );
}

function survModal(id: string): void {
  const d = SURV_BY_ID[id];
  const a = affinity(S, id);
  const ch = chapterReached(S, id);
  const isMe = id === 'me';
  let h = `<div class="vis">${pt(id, 'pt lg')}</div><h2>${gm(id)}${d.name} <small>${gname(id)} · ${d.title}</small></h2>`;
  if (!isMe) {
    h += `<p class="statline">${(Object.keys(STAT_NAME) as (keyof typeof STAT_NAME)[]).map((k) => `<span>${STAT_NAME[k]} <b>${d.stats[k]}</b></span>`).join('')}</p>
      <p class="buffline">✨ ${d.buff.text}${buffScale(S, id) > 1 ? ' <b>(3장 완료: ×1.5)</b>' : ''}</p>
      ${relHtml(id)}
      <div class="aff big"><span class="bar"><i style="width:${a}%"></i>${CHAPTER_AFF.map((t) => `<u style="left:${t}%"></u>`).join('')}</span><span>호감도 ${a}/100</span></div>
      <div class="stories">`;
    d.chapters.forEach((text, i) => {
      h += ch > i
        ? `<div class="chap"><b>${i + 1}장</b><p>${text}</p></div>`
        : `<div class="chap lock"><b>${i + 1}장</b><p>🔒 호감도 ${CHAPTER_AFF[i]} 필요</p></div>`;
    });
    h += `</div>`;
    const rr = roleOf(S, id);
    h += `<div class="cc-row"><b>맡은 일</b>${(Object.keys(ROLES) as Role[]).map((k) => `<button class="chip sm ${rr === k ? 'on' : ''}" data-act="role" data-id="${id}" data-role="${k}">${ROLES[k].icon} ${ROLES[k].name}</button>`).join('')}</div>
      <p class="dim sm">${ROLES[rr].text}</p>`;
    if (isSick(S, id)) {
      const left = S.sick[id].deadline - Date.now();
      h += `<p class="bad sm">🤒 앓고 있어요. ${timeText(left)} 안에 치료하지 않으면 목숨이 위험해요.</p>
        <button class="btn primary wide" data-act="treat" data-id="${id}" ${S.res.med >= treatCost(S) ? '' : 'disabled'}>💊 치료한다 (의약품 ${treatCost(S)})</button>`;
    }
    if (say) h += `<p class="say">${say}</p>`;
    h += `<div class="row2"><button class="btn primary" data-act="talk" data-id="${id}">💬 대화하기</button>
      <button class="btn" data-act="gift-open" data-id="${id}">🎁 선물하기</button></div>`;
    const likes = d.likes.items.map((i) => ITEM_BY_ID[i].name);
    h += `<p class="dim sm">좋아하는 것: ${likes.join(', ')}${d.likes.cat ? ` · ${CATS[d.likes.cat].name}` : ''}</p>`;
  } else {
    const tr = TRAIT_BY_ID[S.player.trait];
    const nk = nickname(S);
    h += `<p class="statline">${(Object.keys(STAT_NAME) as (keyof typeof STAT_NAME)[]).map((k) => `<span>${STAT_NAME[k]} <b>${d.stats[k]}</b></span>`).join('')}</p>
      ${tr ? `<p class="buffline">${tr.icon} ${tr.name} — ${tr.text}</p>` : ''}
      ${nk ? `<p class="tier tier-skilled">🏷 별명: ${nk}</p>` : ''}
      <p class="story">"${d.chat[Math.floor(Math.random() * d.chat.length)]}"</p>`;
  }
  h += `<button class="btn wide" data-act="close">닫기</button>`;
  openModal('surv', h);
}

function cardRel(id: string): string {
  const f = relatives(S, id, 'friend').filter((x) => S.crew.includes(x));
  const r = relatives(S, id, 'rival').filter((x) => S.crew.includes(x));
  if (!f.length && !r.length) return '';
  const nm = (xs: string[]): string => xs.map((x) => SURV_BY_ID[x].name).join(', ');
  return `<small class="rel-line">${f.length ? `<span class="ok">🤝 ${nm(f)}</span>` : ''}${r.length ? `<span class="warn">⚡ ${nm(r)}</span>` : ''}</small>`;
}

function relHtml(id: string): string {
  const f = relatives(S, id, 'friend').filter((x) => S.crew.includes(x));
  const r = relatives(S, id, 'rival').filter((x) => S.crew.includes(x));
  if (!f.length && !r.length) return '<p class="dim sm">아직 특별히 가깝거나 껄끄러운 사람이 없어요.</p>';
  const chip = (x: string, cls: string): string => `<span class="rel ${cls}">${pt(x, 'pt xs')}${SURV_BY_ID[x].name}</span>`;
  return `<div class="rels">${f.length ? `<div><b>🤝 친한 사이</b>${f.map((x) => chip(x, 'friend')).join('')}</div>` : ''}${r.length ? `<div><b>⚡ 사이 나쁨</b>${r.map((x) => chip(x, 'rival')).join('')}</div>` : ''}</div>`;
}

function giftModal(id: string): void {
  const d = SURV_BY_ID[id];
  const owned = ITEMS.filter((i) => (S.items[i.id] ?? 0) > 0);
  const tiles = owned
    .map((i) => {
      const love = d.likes.items.includes(i.id) ? 'love' : d.likes.cat === i.cat ? 'like' : '';
      return `<button class="tile r-${i.rarity} ${love}" data-act="gift" data-id="${id}" data-item="${i.id}"><img src="${iconURL(i.id)}" alt=""><span class="nm">${i.name}</span><b class="cnt">×${S.items[i.id]}</b>${love ? `<i class="heart">${love === 'love' ? '💝' : '💛'}</i>` : ''}</button>`;
    })
    .join('');
  openModal(
    'gift',
    `<h2>${d.name}에게 선물하기</h2>
    <p class="dim sm">💝 아주 좋아함 · 💛 좋아하는 종류 · 나머지는 조금</p>
    ${owned.length ? `<div class="grid">${tiles}</div>` : '<p class="dim">줄 물건이 없어요.</p>'}
    <button class="btn wide" data-act="back-surv" data-id="${id}">돌아가기</button>`,
  );
}

// ---------- 동작 ----------

function onTapSurvivor(id: string, lx: number, ly: number): void {
  const now = Date.now();
  const r = tapSurvivor(S, id, now);
  const d = SURV_BY_ID[id];
  const b = $('#bubble');
  const pos = scene.cssPos(lx, ly);
  b.textContent = `${d.name}: ${r.line}`;
  b.style.left = `${Math.min(Math.max(pos.left, 70), $('#stage').clientWidth - 70)}px`;
  b.style.top = `${Math.max(pos.top - 6, 28)}px`;
  b.classList.remove('hide');
  clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => b.classList.add('hide'), 2600);
  if (r.gained) {
    scene.burst(lx, ly, 'heart', 3);
    announce(id, r.chapters, r.reward);
  }
}

function onClick(e: Event): void {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el) return;
  const act = el.dataset.act as string;
  const id = el.dataset.id ?? '';
  const now = Date.now();
  switch (act) {
    case 'close':
      closeModal();
      break;
    case 'settings':
      openSettings();
      break;
    case 'reset1':
      openModal(
        'settings',
        `<h2>정말 처음부터?</h2><p class="dim">저장된 모든 진행이 사라져요. 되돌릴 수 없어요.</p>
        <button class="btn danger wide" data-act="reset2">네, 전부 지울게요</button><button class="btn wide" data-act="close">아니요</button>`,
      );
      break;
    case 'reset2':
      clearState();
      location.href = location.pathname;
      break;
    case 'cc-origin':
      cc.origin = id;
      if (!jobsOf(id).some((j) => j.id === cc.job)) cc.job = jobsOf(id)[0].id;
      cc.stats = null;
      cc.rerolls = 2;
      renderCreate();
      break;
    case 'cc-job':
      cc.job = id;
      cc.stats = null;
      cc.rerolls = 2;
      renderCreate();
      break;
    case 'cc-next':
      readName();
      cc.step = Math.min(3, cc.step + 1);
      renderCreate();
      break;
    case 'cc-back':
      readName();
      cc.step = Math.max(0, cc.step - 1);
      renderCreate();
      break;
    case 'cc-gender':
      readName();
      cc.gender = id as Gender;
      if (id === 'f') {
        cc.style = 'long';
        cc.acc = cc.acc.filter((a) => a !== 'beard');
      }
      else if (id === 'm') cc.style = 'short';
      if (NAME_POOL.m.concat(NAME_POOL.f).includes(cc.name)) cc.name = pick(NAME_POOL[cc.gender]);
      renderCreate();
      break;
    case 'cc-rname':
      cc.name = pick(NAME_POOL[cc.gender]);
      renderCreate();
      break;
    case 'cc-skin':
      readName();
      cc.skin = id;
      renderCreate();
      break;
    case 'cc-hair':
      readName();
      cc.hair = id;
      renderCreate();
      break;
    case 'cc-style':
      readName();
      cc.style = id as Look['style'];
      renderCreate();
      break;
    case 'cc-top':
      readName();
      cc.top = id;
      renderCreate();
      break;
    case 'cc-acc':
      readName();
      cc.acc = cc.acc.includes(id) ? cc.acc.filter((a) => a !== id) : [...cc.acc, id];
      renderCreate();
      break;
    case 'cc-trait':
      cc.trait = id;
      renderCreate();
      break;
    case 'cc-roll':
      if (cc.rerolls > 0) {
        cc.rerolls -= 1;
        cc.stats = rollStats(cc.origin, cc.job);
        renderCreate();
      }
      break;
    case 'intro-start': {
      S = newState(cc.name, Date.now(), { trait: cc.trait, gender: cc.gender, origin: cc.origin, job: cc.job, look: ccLook(), stats: cc.stats ?? rollStats(cc.origin, cc.job) });
      saveState(S);
      modalKind = null;
      $('#modal').classList.add('hide');
      renderAll();
      toast('곧 누군가 문을 두드릴 거예요…', 'warm');
      break;
    }
    case 'visitor':
      openVisitor();
      break;
    case 'ration':
      setRation(S, id as keyof typeof RATIONS);
      saveState(S);
      renderPanel();
      break;
    case 'crisis-exile': {
      const r = resolveCrisis(S, 'exile', now);
      saveState(S);
      closeModal();
      if (r.ok && r.exiled) {
        const d = SURV_BY_ID[r.exiled.id];
        toast(`${josa(d.name, 'eulreul')} 내보냈다…`, 'bad');
        for (const g of r.grief) toast(`💔 ${SURV_BY_ID[g].name}의 눈빛이 달라졌다`, 'bad');
      }
      break;
    }
    case 'crisis-endure':
      resolveCrisis(S, 'endure', now);
      saveState(S);
      closeModal();
      toast('모두 굶고 버티기로 했다. 눈치가 싸늘하다.', 'bad');
      break;
    case 'reject': {
      const vid = S.visitor;
      const nm = vid ? SURV_BY_ID[vid]?.name : '';
      if (rejectVisitor(S, now)) {
        saveState(S);
        closeModal();
        renderAll();
        toast(`${nm ? josa(nm, 'eulreul') + ' ' : ''}돌려보냈다. 문이 닫혔다…`, 'bad');
      }
      break;
    }
    case 'recruit':
      if (recruit(S, id, now)) {
        saveState(S);
        toast(`${josa(SURV_BY_ID[id].name, 'iga')} 벙커에 합류했어요!`, 'good');
        scene.burst(22, 130, 'spark', 8);
        closeModal();
      }
      break;
    case 'bag':
    case 'open-bag':
      openBag(id || undefined);
      break;
    case 'breach-open':
      openBreach();
      break;
    case 'breach-go': {
      const r = breachFloor(S, now);
      saveState(S);
      if (!r.ok) {
        toast(r.error, 'bad');
        break;
      }
      openBreachResult(r);
      break;
    }
    case 'raid':
      openRaid();
      break;
    case 'raid-act': {
      const r = resolveRaid(S, id as RaidChoice, now);
      saveState(S);
      if (r) openRaidResult(r);
      break;
    }
    case 'merchant':
      openMerchant();
      break;
    case 'buy-offer':
      if (buyOffer(S, id, now)) {
        saveState(S);
        toast('거래 성사!', 'good');
        openMerchant();
        updateHud();
      } else toast('병마개가 모자라요.', 'bad');
      break;
    case 'sell-res':
      if (sellRes(S, id as 'food' | 'water', now) > 0) {
        saveState(S);
        openMerchant();
        updateHud();
      } else toast('팔고 남길 만큼 없어요.', 'bad');
      break;
    case 'rescue':
      openRescue();
      break;
    case 'rescue-tab':
      if (S.rescue) sel = { zone: S.rescue.zone, members: [] };
      tab = 'explore';
      closeModal();
      break;
    case 'rescue-go': {
      if (!sel.zone) break;
      const r = startRescue(S, sel.members, now);
      if (r.ok) {
        saveState(S);
        toast('구조대 출발!', 'good');
        sel = { zone: null, members: [] };
        tab = 'home';
        renderAll();
      } else toast(r.error, 'bad');
      break;
    }
    case 'role': {
      const role = el.dataset.role as Role;
      if (setRole(S, id, role, now)) {
        saveState(S);
        survModal(id);
        renderPanel();
      } else toast('탐사 중에는 바꿀 수 없어요.', 'bad');
      break;
    }
    case 'treat':
      if (treat(S, id)) {
        saveState(S);
        toast('치료했어요. 한시름 놓았다.', 'good');
        survModal(id);
        renderAll();
      } else toast('의약품이 모자라요.', 'bad');
      break;
    case 'tab-crew':
      tab = 'crew';
      renderAll();
      break;
    case 'hall':
      openHall();
      break;
    case 'new-game':
      clearState();
      location.href = location.pathname;
      break;
    case 'buy':
      if (buyUpgrade(S, el.dataset.key as UpgKey)) {
        saveState(S);
        toast(`${UPGRADES[el.dataset.key as UpgKey].name} 완료!`, 'good');
        renderAll();
      }
      break;
    case 'zone':
      sel = sel.zone === id ? { zone: null, members: [] } : { zone: id, members: [] };
      renderPanel();
      break;
    case 'member': {
      const i = sel.members.indexOf(id);
      if (i >= 0) sel.members.splice(i, 1);
      else if (sel.members.length < 3) sel.members.push(id);
      else toast('탐사대는 최대 3명이에요.');
      renderPanel();
      break;
    }
    case 'go': {
      if (!sel.zone) break;
      const r = startExpedition(S, sel.zone, sel.members, now);
      if (r.ok) {
        saveState(S);
        toast(`${josa(ZONE_BY_ID[sel.zone].name, 'euro')} 출발!`, 'good');
        sel = { zone: null, members: [] };
        tab = 'home';
        renderAll();
      } else toast(r.error, 'bad');
      break;
    }
    case 'cat':
      shelfCat = (el.dataset.c as Cat | 'all') ?? 'all';
      renderPanel();
      break;
    case 'item':
      itemModal(id);
      break;
    case 'sell': {
      const got = sellItem(S, id, now);
      if (got) {
        saveState(S);
        toast(`● +${got}`, 'warm');
        itemModal(id);
      }
      break;
    }
    case 'surv':
      say = '';
      survModal(id);
      break;
    case 'back-surv':
      survModal(id);
      break;
    case 'talk': {
      const r = talk(S, id, now);
      if (r.ok) {
        say = `"${r.line}" <small>(호감도 +6)</small>`;
        announce(id, r.chapters, r.reward);
        scene.burst(60, 140, 'heart', 3);
      } else say = r.wait > 0 ? `<small>조금 있다가 다시 이야기해요. (${timeText(r.wait)})</small>` : '';
      saveState(S);
      survModal(id);
      break;
    }
    case 'gift-open':
      giftModal(id);
      break;
    case 'gift': {
      const r = gift(S, id, el.dataset.item as string);
      if (r.ok) {
        const d = SURV_BY_ID[id];
        say =
          r.mood === 'love'
            ? `"${d.name}: 이거 정말 좋아하는 건데! 고마워요!" <small>(호감도 +${r.delta})</small>`
            : r.mood === 'like'
              ? `"${d.name}: 고마워요, 잘 쓸게요." <small>(호감도 +${r.delta})</small>`
              : `"${d.name}: 음… 마음은 고마워요." <small>(호감도 +${r.delta})</small>`;
        announce(id, r.chapters, r.reward);
        saveState(S);
        survModal(id);
      }
      break;
    }
  }
}



// ---------- 사건: 습격 · 상인 · 구조 · 돌파 · 게임 오버 ----------

const DEAD_WHERE: Record<string, string> = { exile: '추방', raid: '습격', sick: '병', breach: '층 돌파' };
function graveWhere(z: string): string {
  return DEAD_WHERE[z] ?? ZONE_BY_ID[z]?.name ?? '';
}

const queued: { kind: string; html: string }[] = [];
let raidShown = 0;

/** 지금 다른 창이 열려 있으면 줄을 세운다 */
function showOrQueue(kind: string, html: string): void {
  if (modalKind === null) openModal(kind, html);
  else queued.push({ kind, html });
}

function handleNotices(notes: Notice[]): void {
  for (const n of notes) {
    if (n.type === 'raid') toast(S.raid?.kind === 'horde' ? '🧟 좀비 떼가 몰려온다!' : '⚔ 약탈자가 문을 부수려 한다!', 'bad');
    if (n.type === 'raid_auto') showOrQueue('raidres', raidResultHtml(n.result));
    if (n.type === 'merchant') toast('🛒 떠돌이 상인이 문 앞에 왔다', 'warm');
    if (n.type === 'merchant_left') toast('🛒 상인이 떠났다', '');
    if (n.type === 'sick') toast(`🤒 ${SURV_BY_ID[n.id].name}이(가) 앓기 시작했다`, 'bad');
    if (n.type === 'sick_death') showOrQueue('sickdead', `<h2>🕯 병을 이기지 못했다</h2><div class="lost">${pt(n.gone.id, 'pt sm', true)}<span><b>${n.gone.name}</b> <small>${n.gone.title}</small><i>${n.gone.last}</i></span></div><button class="btn primary wide" data-act="close">…</button>`);
    if (n.type === 'rescue') toast('📡 구조 신호가 잡혔다', 'warm');
    if (n.type === 'rescue_lost') toast('📡 신호가 끊겼다…', 'bad');
  }
  if (notes.length) {
    saveState(S);
    if (modalKind === null) renderAll();
    else updateHud();
  }
}

/** 열려 있는 창이 없을 때 꼭 봐야 할 것을 차례로 연다 */
function autoOpen(): void {
  if (modalKind !== null) return;
  if (S.over) {
    openOver();
    return;
  }
  if (queued.length) {
    const q = queued.shift()!;
    openModal(q.kind, q.html);
    return;
  }
  if (S.crisis) {
    openCrisis();
    return;
  }
  if (S.raid && raidShown !== S.raid.deadline) {
    raidShown = S.raid.deadline;
    openRaid();
  }
}

const goneHtml = (g: Gone[]): string => g.map((d) => `<div class="lost">${pt(d.id, 'pt sm', true)}<span><b>${d.name}</b> <small>${d.title}</small><i>${d.last}</i></span></div>`).join('');
const resLine = (r: Record<ResKey, number>): string =>
  (['food', 'water', 'med'] as ResKey[]).filter((k) => r[k] > 0).map((k) => `${RES[k].icon} ${RES[k].name} <b>−${r[k]}</b>`).join(' · ');

function openRaid(): void {
  const r = S.raid;
  if (!r) return;
  const now = Date.now();
  const def = defense(S, now);
  const raider = r.kind === 'raider';
  const guards = S.crew.filter((id) => roleOf(S, id) === 'guard').length;
  const opts: Record<RaidChoice, string> = {
    fight: `<button class="btn danger wide" data-act="raid-act" data-id="fight">⚔ 맞서 싸운다 <small>(우리 방어력 ${def} · 상대 ${r.power})</small></button>`,
    talk: `<button class="btn wide" data-act="raid-act" data-id="talk">🗣 협상한다 <small>(성공 ${Math.round(talkChance(S) * 100)}% · 성공하면 절반만 / 실패하면 더 뺏긴다)</small></button>`,
    pay: `<button class="btn wide" data-act="raid-act" data-id="pay">🎁 달라는 걸 준다 <small>(싸움은 피하지만 다음에도 온다)</small></button>`,
    hide: `<button class="btn wide" data-act="raid-act" data-id="hide">🚪 문을 닫고 숨는다 <small>(물자 절반을 잃고, 누군가 물릴 수도)</small></button>`,
  };
  openModal(
    'raid',
    `<h2>${raider ? '⚔ 약탈자가 찾아왔다' : '🧟 좀비 떼가 몰려온다'}</h2>
    <p class="story">${raider ? '문 너머에서 낯선 목소리가 외친다. "먹을 걸 내놓고 가만히 있으면 아무도 안 다쳐."' : '벽 너머로 끌리는 소리가 가득하다. 이번 무리는 평소보다 크다.'}</p>
    <p class="sm">${raider ? '요구' : '뚫리면 잃는 것'}: ${resLine(r.demand).replace(/−/g, '')}</p>
    <p class="sm ${def >= r.power ? 'ok' : 'warn'}">🛡 우리 방어력 <b>${def}</b> / 상대 <b>${r.power}</b> — 방어조 ${guards}명${guards ? '' : ' (방어조가 없다! 생존자 탭에서 방어조를 정해 두세요)'}</p>
    ${raidChoices(S).map((c) => opts[c]).join('')}
    <p class="dim sm">${timeText(r.deadline - now)} 안에 정하지 않으면 ${raider ? '요구를 들어줍니다' : '맞서 싸웁니다'}.</p>
    <button class="btn wide" data-act="close">잠시 생각한다</button>`,
  );
}

function raidResultHtml(r: RaidResult): string {
  const raider = r.kind === 'raider';
  const head =
    r.outcome === 'win' ? '🛡 막아냈다!' : r.outcome === 'deal' ? (r.choice === 'hide' ? '🚪 숨죽여 지나갔다' : '🤝 거래로 끝났다') : raider ? '💥 뚫렸다' : '💥 문이 부서졌다';
  const story =
    r.outcome === 'win'
      ? `방어조가 문 앞에서 버텼다. ${raider ? '약탈자들은 흩어졌고, 두고 간 물건이 있다.' : '좀비 떼는 물러갔다.'}`
      : r.outcome === 'deal'
        ? r.choice === 'talk'
          ? '말이 통했다. 절반만 내주고 돌려보냈다.'
          : r.choice === 'pay'
            ? '달라는 만큼 내주자 조용히 돌아갔다. 다음에도 올 것이다.'
            : '불을 끄고 숨을 죽였다. 한참 뒤에야 소리가 멀어졌다.'
        : r.choice === 'talk'
          ? '말이 먹히지 않았다. 더 많이 빼앗겼다.'
          : '지키는 힘이 모자랐다. 비축이 털리고 사람이 다쳤다.';
  return `<h2>${head}${r.auto ? ' <small>(정하지 않아 자동 처리)</small>' : ''}</h2>
    <p class="story">${story}</p>
    ${r.roll ? `<p class="dim sm">방어력 ${r.roll} / 상대 ${r.power}</p>` : ''}
    ${goneHtml(r.dead)}
    ${r.hurt.length ? `<p class="warn sm">🩹 다친 사람: ${r.hurt.map((id) => SURV_BY_ID[id].name).join(', ')}</p>` : ''}
    ${r.sick.length ? `<p class="bad sm">🤒 물린 사람이 있다: ${r.sick.map((id) => SURV_BY_ID[id].name).join(', ')} (치료하지 않으면 위험해요)</p>` : ''}
    ${resLine(r.lost) ? `<p class="supplies">${resLine(r.lost)}</p>` : ''}
    ${r.caps ? `<p class="gain">● +${fmt(r.caps)}</p>` : ''}
    <button class="btn primary wide" data-act="close">알겠다</button>`;
}

function openRaidResult(r: RaidResult): void {
  openModal('raidres', raidResultHtml(r));
  renderStageActions();
}

function openMerchant(): void {
  const m = S.merchant;
  const now = Date.now();
  if (!m || m.until <= now) {
    toast('상인은 이미 떠났어요.', '');
    closeModal();
    return;
  }
  const mm = marketMult(S);
  const rows = m.offers
    .map(
      (o) => `<div class="upg"><div class="ui">${RES[o.res].icon}</div><div class="ut"><b>${RES[o.res].name} ${o.amount}</b><span>${o.sold ? '팔렸어요' : '떠돌이 상인의 물건'}</span></div>
      ${o.sold ? '<span class="max">SOLD</span>' : `<button class="btn sm ${S.caps >= o.price ? 'primary' : ''}" data-act="buy-offer" data-id="${o.id}" ${S.caps >= o.price ? '' : 'disabled'}>● ${o.price}</button>`}</div>`,
    )
    .join('');
  openModal(
    'merchant',
    `<h2>🛒 떠돌이 상인</h2>
    <p class="story">짐을 가득 진 사내가 문틈으로 물건을 내민다. "오래 못 있어요. 필요한 것만 골라요."</p>
    <p class="dim sm">${timeText(m.until - now)} 뒤에 떠나요 · 시세 ${mm < 1 ? `${Math.round((1 - mm) * 100)}% 할인` : '정가'}${S.rep.market > 0 ? ' (단골이라 값을 깎아 줘요)' : ''}</p>
    ${rows}
    <div class="row2"><button class="btn" data-act="sell-res" data-id="food" ${S.res.food >= 20 ? '' : 'disabled'}>🍞 10 팔기</button><button class="btn" data-act="sell-res" data-id="water" ${S.res.water >= 20 ? '' : 'disabled'}>💧 10 팔기</button></div>
    <button class="btn wide" data-act="close">닫기</button>`,
  );
}

function openRescue(): void {
  const r = S.rescue;
  if (!r) return;
  const z = ZONE_BY_ID[r.zone];
  const pd = PROF_BY_ID[r.prof];
  openModal(
    'rescue',
    `<h2>📡 구조 신호</h2>
    <div class="vis"><img class="pt lg" src="${profPortraitURL(r.prof)}" alt=""></div>
    <p class="story">낡은 무전기에서 가느다란 목소리가 반복된다. "${z.name}… 누구 없어요… 저는 <b>${pd.title}</b>입니다… 도와주세요…"</p>
    <p class="sm">${z.icon} ${z.name} · ⏱ ${timeText(r.deadline - Date.now())} 안에 도착해야 해요.</p>
    <p class="dim sm">탐사 탭에서 그 구역으로 탐사대를 꾸려 <b>구조 신호를 따라 나가기</b>를 누르세요. 들키면 구하지 못합니다. 자리(침대)가 있어야 데려올 수 있어요.</p>
    <button class="btn primary wide" data-act="rescue-tab">구조대 꾸리러 가기</button>
    <button class="btn wide" data-act="close">닫기</button>`,
  );
}

function openBreach(): void {
  const now = Date.now();
  const pv = previewBreach(S, now);
  if (!pv) return;
  const nx = nextFloor(S)!;
  const guards = S.crew.filter((id) => roleOf(S, id) === 'guard').length;
  const ratio = pv.defense / pv.power;
  openModal(
    'breach',
    `<h2>⛏ 아래로 파고 내려간다 <small>${pv.name}</small></h2>
    <p class="story">새 층으로 통하는 문을 여는 순간, 어둠 속에 있던 것들이 한꺼번에 깨어난다.</p>
    <p class="sm">수용 ${capacity(S)}명 → <b>${nx.cap}명</b> · 공사비 ● ${fmt(pv.cost)}</p>
    <p class="sm ${ratio >= 1 ? 'ok' : ratio >= 0.7 ? 'warn' : 'bad'}">🛡 우리 방어력 <b>${pv.defense}</b> / 몰려오는 무리 <b>${pv.power}</b> — 방어조 ${guards}명${ratio >= 1.15 ? ' · 넉넉해요' : ratio >= 0.85 ? ' · 아슬아슬해요' : ' · 많이 모자라요'}</p>
    <p class="dim sm">실패하면 공사비의 60%를 날리고, 막던 사람이 다치거나 목숨을 잃을 수 있어요. 방어조를 늘려 보세요.</p>
    <button class="btn primary wide" data-act="breach-go" ${S.caps >= pv.cost ? '' : 'disabled'}>돌파한다</button>
    <button class="btn wide" data-act="close">더 준비한다</button>`,
  );
}

function openBreachResult(r: Extract<ReturnType<typeof breachFloor>, { ok: true }>): void {
  openModal(
    'breachres',
    `<h2>${r.win ? `🎉 ${FLOORS[S.floor].name} 개방!` : '💥 돌파에 실패했다'}</h2>
    <p class="story">${r.win ? `방어조가 문 앞을 지켜냈다. 새 층에 침대를 놓을 수 있다. 수용 ${capacity(S)}명.` : '무리를 막지 못하고 문을 다시 닫았다. 공사비가 날아갔다.'}</p>
    <p class="dim sm">방어력 ${r.roll} / 무리 ${r.power}</p>
    ${goneHtml(r.dead)}
    ${r.hurt.length ? `<p class="warn sm">🩹 다친 사람: ${r.hurt.map((id) => SURV_BY_ID[id].name).join(', ')}</p>` : ''}
    <p class="supplies">● ${r.win ? '' : '−'}${fmt(r.lostCaps)}${r.win ? ' 사용' : ' 손실'}</p>
    <button class="btn primary wide" data-act="close">알겠다</button>`,
  );
  renderAll();
}

function hallHtml(): string {
  const h = loadHall();
  if (!h.length) return '<p class="dim sm">아직 기록이 없어요. 이야기가 끝나면 이곳에 이름이 남아요.</p>';
  return `<ul class="graves">${h
    .map(
      (e, i) =>
        `<li><span><b>${i + 1}. ${e.name}${e.nick ? ` <small>『${e.nick}』</small>` : ''}</b> <small>${e.origin} · ${e.job}${e.trait ? ` · ${e.trait}` : ''}</small><i>${e.days}일 생존 · ${e.floor}층 · 최대 ${e.maxCrew}명 · 떠나보낸 사람 ${e.dead}명 — ${e.cause}</i></span></li>`,
    )
    .join('')}</ul>`;
}

function openHall(): void {
  openModal('hall', `<h2>🏆 명예의 전당</h2>${hallHtml()}<button class="btn wide" data-act="close">닫기</button>`);
}

function openOver(): void {
  if (!S.over) return;
  recordHall(S);
  saveState(S);
  const nk = nickname(S);
  const l = S.log;
  openModal(
    'over',
    `<h2>🕯 ${S.name}의 이야기가 끝났다</h2>
    <div class="vis">${pt('me', 'pt lg', true)}</div>
    <p class="story">${S.over.cause}.<br><i>${S.over.last}</i></p>
    ${nk ? `<p class="tier tier-skilled">🏷 사람들은 ${S.name}을(를) 『${nk}』(이)라고 불렀다</p>` : ''}
    <p class="dim sm">${S.over.day}일 생존 · ${FLOORS[S.floor].name} · 가장 많이 모였을 때 ${l.maxCrew}명 · 떠나보낸 사람 ${S.dead.length}명${l.exiled ? ` (추방 ${l.exiled})` : ''}${l.healed ? ` · 치료 ${l.healed}` : ''}${l.rescued ? ` · 구조 ${l.rescued}` : ''}</p>
    ${hallHtml()}
    <button class="btn primary wide" data-act="new-game">새 이야기를 시작한다</button>`,
  );
}
