// 화면(탭, 모달, 알림). 규칙은 state.ts, 장면은 scene.ts.
import {
  CATS,
  CAT_ORDER,
  CHAPTER_AFF,
  ITEMS,
  ITEM_BY_ID,
  RARITY,
  PROFS,
  STAT_NAME,
  SURV_BY_ID,
  UPGRADES,
  ZONES,
  ZONE_BY_ID,
} from './data.ts';
import type { Cat, UpgKey } from './data.ts';
import { Scene } from './scene.ts';
import {
  affinity,
  allComplete,
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
  config,
  dayNumber,
  foundCount,
  gift,
  homeCrew,
  incomeBreakdown,
  isTired,
  isZoneOpen,
  itemIncome,
  loadState,
  newState,
  offlineCapMs,
  previewExpedition,
  recruit,
  saveState,
  sellItem,
  startExpedition,
  talk,
  tapSurvivor,
  tick,
  upgradeCost,
} from './state.ts';
import type { GameEvent, Report, State } from './state.ts';
import { iconURL, portraitURL, profPortraitURL } from './sprites.ts';

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
const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toLocaleString('en-US');

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
  let offline: { ms: number; caps: number } | null = null;
  let events: GameEvent[] = [];
  if (loaded) {
    S = loaded;
    const before = S.caps;
    const gap = now - S.last;
    events = tick(S, now);
    if (gap > 120000) offline = { ms: gap, caps: S.caps - before };
  } else {
    S = newState('점장', now);
  }

  scene = new Scene(
    $<HTMLCanvasElement>('#scene'),
    () => ({
      items: S.items,
      present: homeCrew(S, Date.now()),
      visitor: S.visitor,
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
    if (e.target === e.currentTarget && modalKind !== 'intro') closeModal();
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
    if (offline) openOffline(offline.ms, offline.caps);
    handleEvents(events);
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
  updateHud();
  updateLive();
}

function handleEvents(events: GameEvent[]): void {
  for (const e of events) {
    if (e.type === 'visitor') toast('🚪 누군가 문을 두드린다…', 'warm');
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
  $('#hud-name').textContent = `B7 · ${S.name === '점장' ? '점장' : `${S.name} 점장`}`;
  $('#hud-caps').textContent = fmt(S.caps);
  $('#hud-rate').textContent = `+${fmt1(incomeBreakdown(S, now).perMin)}/분`;
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
  $('#stage-actions').innerHTML = parts.join('');
}

function updateDots(): void {
  const now = Date.now();
  const dots: Record<Tab, boolean> = {
    home: readyExps(now) > 0 || !!S.visitor,
    explore: S.exps.length === 0 && availableCrew(S, now).length > 0 && S.stats.expeditions > 0,
    shelf: false,
    crew: !!S.visitor,
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
  const inc = incomeBreakdown(S, now);
  let h = '';

  if (S.stats.expeditions === 0 && S.exps.length === 0) {
    h += `<section class="card tip"><h3>💡 처음이라면</h3>
      <p>1. <b>탐사</b> 탭에서 '동네 슈퍼마트'로 점장을 보내 보세요.<br>
      2. 돌아온 배낭을 열면 물건이 <b>선반</b>에 진열되고, 뚜껑(●)이 계속 쌓입니다.<br>
      3. 물건이 늘면 새 생존자들이 문을 두드려요.</p></section>`;
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

  h += `<section class="card"><h3>● 분당 수입 <b class="big">+${fmt1(inc.perMin)}</b></h3><ul class="lines">`;
  h += `<li><span>🏪 단골 손님</span><b>+${inc.base}</b></li>`;
  for (const c of CAT_ORDER) {
    const row = inc.byCat[c];
    if (row.sum <= 0) continue;
    const notes: string[] = [];
    if (row.buff > 0) notes.push(`생존자 +${Math.round(row.buff * 100)}%`);
    if (row.complete) notes.push('완성 +25%');
    h += `<li><span>${CATS[c].icon} ${CATS[c].name}${notes.length ? ` <em>${notes.join(' · ')}</em>` : ''}</span><b>+${fmt1(row.sum * row.mult)}</b></li>`;
  }
  const mults: string[] = [];
  if (inc.shelfMult > 1) mults.push(`개조 ×${fmt1(inc.shelfMult)}`);
  if (inc.allMult > 1) mults.push(`분위기 ×${fmt1(inc.allMult)}`);
  if (allComplete(S)) mults.push('도감 완성 ×1.5');
  if (mults.length) h += `<li class="mult"><span>${mults.join(' · ')}</span><b></b></li>`;
  h += `</ul><p class="dim sm">자리를 비워도 최대 ${Math.round(offlineCapMs(S) / 3600000)}시간 치 수입이 쌓여요.</p></section>`;

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

function memberChip(id: string, now: number): string {
  const d = SURV_BY_ID[id];
  const away = awaySet(S, now).has(id);
  const tired = isTired(S, id, now);
  const on = sel.members.includes(id);
  const ok = !away && !tired;
  const note = away ? '탐사 중' : tired ? '부상' : id === 'me' ? '점장' : `전투 ${d.stats.str}`;
  return `<button class="chip ${on ? 'on' : ''}" data-act="member" data-id="${id}" ${ok ? '' : 'disabled'}>
    ${pt(id, 'pt sm')}<b>${d.name}</b><small>${note}</small></button>`;
}

function exploreHtml(): string {
  const now = Date.now();
  const found = foundCount(S);
  let h = `<p class="lead">탐사대는 1~3명. 같이 가면 전리품이 늘어요. 들키면 <b>죽는 사람이 나올 수 있고, 죽은 사람은 돌아오지 않아요.</b> 전투가 센 사람과 의료가 높은 사람이 함께 가면 덜 위험해요.</p>`;
  for (const z of ZONES) {
    const open = isZoneOpen(S, z);
    const cur = sel.zone === z.id;
    const skulls = '☠'.repeat(z.D) + `<span class="dim">${'☠'.repeat(5 - z.D)}</span>`;
    h += `<section class="card zone ${open ? '' : 'locked'} ${cur ? 'cur' : ''}">
      <button class="zone-h" data-act="zone" data-id="${z.id}" ${open ? '' : 'disabled'}>
        <span class="zi">${open ? z.icon : '🔒'}</span>
        <span class="zt"><b>${z.name}</b><small>${open ? z.blurb : `도감 ${z.unlock}종 발견 시 열려요 (${found}/${z.unlock})`}</small></span>
        <span class="zm"><i class="sk">${skulls}</i><small>${z.minutes}분~</small></span>
      </button>`;
    if (cur && open) {
      const crew = ['me', ...S.crew];
      const pv = sel.members.length ? previewExpedition(S, z.id, sel.members) : null;
      const riskPct = pv ? Math.round(pv.risk * 100) : 0;
      const deathPct = pv ? Math.round(pv.anyDeath * 100) : 0;
      const deathList = pv
        ? sel.members.filter((m) => pv.deathIf[m] > 0).map((m) => `${SURV_BY_ID[m].name} ${Math.round(pv.deathIf[m] * 100)}%`).join(' · ')
        : '';
      h += `<div class="team"><div class="chips">${crew.map((id) => memberChip(id, now)).join('')}</div>
        ${
          pv
            ? `<div class="pv"><span>⏱ ${timeText(pv.ms)}</span><span>🎒 전리품 ${pv.loot}개</span>
               <span class="${riskPct > 25 ? 'bad' : riskPct > 0 ? 'warn' : 'ok'}">⚠ 들킬 확률 ${riskPct}%</span>
               <span class="${deathPct >= 10 ? 'bad' : deathPct > 0 ? 'warn' : 'ok'}">☠ 누군가 죽을 확률 ${deathPct}%</span></div>
               ${deathList ? `<p class="dim sm">들키면 죽을 확률: ${deathList}</p>` : ''}`
            : '<div class="pv dim">함께 갈 사람을 골라 주세요.</div>'
        }
        <button class="btn primary wide" data-act="go" ${pv ? '' : 'disabled'}>출발하기</button></div>`;
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
  h += `</div><p class="dim sm">분류를 모두 채우면 그 분류 수입 +25%, 전부 채우면 전체 ×1.5! 같은 물건을 여러 개 모으면 수입이 조금씩(+10%) 늘어요(최대 5개).</p></section>`;
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
    const status = away.has(id) ? '<em class="st away">탐사 중</em>' : isTired(S, id, now) ? '<em class="st tired">지침</em>' : '<em class="st home">매장</em>';
    return `<button class="card crew" data-act="surv" data-id="${id}">
      ${pt(id)}
      <span class="ct"><b>${d.name} ${status}</b><small>${d.title}</small>
        ${id === 'me' ? '' : `<small class="buff">${d.buff.text}</small>
        <span class="aff"><span class="bar"><i style="width:${a}%"></i>${CHAPTER_AFF.map((t) => `<u style="left:${t}%"></u>`).join('')}</span><span class="pips">📖 ${ch}/3</span></span>`}
      </span></button>`;
  };
  h += row('me');
  for (const id of S.crew) h += row(id);
  const here = new Set([...S.crew, ...(S.visitor ? [S.visitor] : [])].map((id) => S.people[id]?.prof));
  for (const d of PROFS) {
    if (here.has(d.id)) continue;
    h += `<div class="card crew lockd"><img class="pt" src="${profPortraitURL(d.id)}" alt=""><span class="ct"><b>???</b><small>${d.hint}</small></span></div>`;
  }
  if (S.dead.length) {
    h += `<section class="card grave"><h3>🪦 추모비 <b class="big">${S.dead.length}</b></h3><ul class="graves">`;
    for (const g of [...S.dead].reverse()) {
      const d = SURV_BY_ID[g.id];
      h += `<li>${pt(g.id, 'pt xs', true)}<span><b>${d.name}</b> <small>${d.title} · ${g.day}일째 · ${ZONE_BY_ID[g.zone].name}</small><i>${g.last}</i></span></li>`;
    }
    h += `</ul></section>`;
  }
  return h;
}

// ---------- 모달 ----------

function openIntro(): void {
  openModal(
    'intro',
    `<h2>지하 7층의 종말 편의점</h2>
    <p class="story">그날 이후 세상은 조용해졌다.<br>지상은 좀비들의 차지가 됐지만, 지하 7층 이 편의점의 형광등은 아직 켜져 있다.<br><br>선반은 텅 비었다. 하나씩, 채워 보자.</p>
    <label class="nm">점장 이름<input id="nm" maxlength="8" value="" placeholder="점장" autocomplete="off"></label>
    <button class="btn primary wide" data-act="intro-start">셔터 올리기</button>`,
  );
}

function openOffline(ms: number, caps: number): void {
  openModal(
    'offline',
    `<h2>어서 오세요, 점장님</h2>
    <p class="story">${timeText(ms)} 동안 가게를 비웠어요.<br>그동안 계산대에 뚜껑이 <b class="gold">● ${fmt(caps)}</b>개 쌓였습니다.</p>
    <button class="btn primary wide" data-act="close">챙기기</button>`,
  );
}

function openSettings(): void {
  openModal(
    'settings',
    `<h2>설정</h2>
    <p class="dim">저장은 이 기기의 브라우저에만 됩니다. 접속하지 않아도 시간은 흘러 수입이 쌓이고 탐사가 진행돼요.</p>
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
    <h2>${d.name} <small>${d.title}</small></h2>
    <p class="story">${d.intro}</p>
    <p class="buffline">✨ ${d.buff.text}</p>
    <button class="btn primary wide" data-act="recruit" data-id="${id}">들어오세요</button>
    <button class="btn wide" data-act="close">조금만 더 기다려 주세요</button>`,
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
    <ul class="loot">${list}</ul>
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
       <li><span>진열 수입</span><b>+${fmt1(itemIncome(d.rarity, n))}/분</b></li>
       <li><span>팔면</span><b>● ${RARITY[d.rarity].sell}</b></li></ul>
       ${lovers.length ? `<p class="dim sm">💝 ${josa(lovers.join(', '), 'iga')} 아주 좋아해요.</p>` : ''}
       <button class="btn wide" data-act="sell" data-id="${id}" ${n > 0 ? '' : 'disabled'}>1개 팔기 (● +${RARITY[d.rarity].sell})</button>`
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
  let h = `<div class="vis">${pt(id, 'pt lg')}</div><h2>${d.name} <small>${d.title}</small></h2>`;
  if (!isMe) {
    h += `<p class="statline">${(Object.keys(STAT_NAME) as (keyof typeof STAT_NAME)[]).map((k) => `<span>${STAT_NAME[k]} <b>${d.stats[k]}</b></span>`).join('')}</p>
      <p class="buffline">✨ ${d.buff.text}${buffScale(S, id) > 1 ? ' <b>(3장 완료: ×1.5)</b>' : ''}</p>
      <div class="aff big"><span class="bar"><i style="width:${a}%"></i>${CHAPTER_AFF.map((t) => `<u style="left:${t}%"></u>`).join('')}</span><span>호감도 ${a}/100</span></div>
      <div class="stories">`;
    d.chapters.forEach((text, i) => {
      h += ch > i
        ? `<div class="chap"><b>${i + 1}장</b><p>${text}</p></div>`
        : `<div class="chap lock"><b>${i + 1}장</b><p>🔒 호감도 ${CHAPTER_AFF[i]} 필요</p></div>`;
    });
    h += `</div>`;
    if (say) h += `<p class="say">${say}</p>`;
    h += `<div class="row2"><button class="btn primary" data-act="talk" data-id="${id}">💬 대화하기</button>
      <button class="btn" data-act="gift-open" data-id="${id}">🎁 선물하기</button></div>`;
    const likes = d.likes.items.map((i) => ITEM_BY_ID[i].name);
    h += `<p class="dim sm">좋아하는 것: ${likes.join(', ')}${d.likes.cat ? ` · ${CATS[d.likes.cat].name}` : ''}</p>`;
  } else {
    h += `<p class="story">"${d.chat[Math.floor(Math.random() * d.chat.length)]}"</p>`;
  }
  h += `<button class="btn wide" data-act="close">닫기</button>`;
  openModal('surv', h);
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
    case 'intro-start': {
      const name = ($('#nm') as HTMLInputElement).value;
      S = newState(name, Date.now());
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
    case 'recruit':
      if (recruit(S, id, now)) {
        saveState(S);
        toast(`${josa(SURV_BY_ID[id].name, 'iga')} 편의점에 합류했어요!`, 'good');
        scene.burst(22, 130, 'spark', 8);
        closeModal();
      }
      break;
    case 'bag':
    case 'open-bag':
      openBag(id || undefined);
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
      const got = sellItem(S, id);
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

