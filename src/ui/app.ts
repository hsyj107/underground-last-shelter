import {
  AREAS, BACKGROUNDS, FACILITY_DEFS, JOB_LABEL, MAX_FACILITY_LEVEL, POLICIES, TITLES, upgradeCost, xpToNext,
} from '../sim/data';
import {
  alive, assign, atBunker, byId, capacity, dangerLabel, endDay, facilityState, forecast, newGame, resLabel,
  resolveSerum, setException, setPolicy, startExpedition, unlockConditions, unlockFacility, upgradeFacility,
  workersOf, type ActionResult,
} from '../sim/engine';
import { clearGame, loadGame, loadHistory, pushHistory, saveGame } from '../sim/save';
import { RES_KEYS, type Exception, type FacilityId, type Game, type LogEntry, type Survivor } from '../sim/types';

/**
 * 단말기 화면. 상태는 sim/ 의 game 하나뿐이고, 화면은 그 상태를 그릴 뿐이다.
 * 모든 버튼은 data-act / data-arg 로 이 파일의 act() 에 연결된다.
 */

type Tab = 'status' | 'crew' | 'fac' | 'ops' | 'policy' | 'rec';
const TABS: { id: Tab; label: string }[] = [
  { id: 'status', label: '상황' }, { id: 'crew', label: '인원' }, { id: 'fac', label: '시설' },
  { id: 'ops', label: '원정' }, { id: 'policy', label: '정책' }, { id: 'rec', label: '기록' },
];

interface UiState {
  tab: Tab;
  crew: string | null;
  fac: FacilityId | null;
  area: string | null;
  team: string[];
  /** 신규 접속 화면에서 고른 값 */
  nick: string;
  bg: number;
  toast: string;
}

const ui: UiState = { tab: 'status', crew: null, fac: null, area: null, team: [], nick: '', bg: 0, toast: '' };
let game: Game | null = null;
let root: HTMLElement;
let modal: string | null = null;
let modalHtml = '';
let toastTimer = 0;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STATUS_LABEL: Record<string, [string, string]> = {
  ok: ['정상', 'good'], sick: ['질병', 'warn'], injured: ['부상', 'warn'], critical: ['위독', 'bad'], away: ['원정 중', ''], dead: ['사망', 'bad'],
};

// ───────── 작은 조각들 ─────────

function bar(label: string, value: number, danger: 'high' | 'low'): string {
  const n = Math.round(value / 10);
  const bad = danger === 'high' ? value >= 70 : value <= 30;
  const cls = bad ? 'bad' : '';
  return `<div class="bars ${cls}"><span>${label}</span>${'▮'.repeat(n)}${'▯'.repeat(10 - n)} ${Math.round(value)}</div>`;
}

function portrait(s: Survivor, size = 2): string {
  return `<img class="pix" src="assets/characters/${esc(s.sprite)}.png" alt="" style="height:${36 * size}px">`;
}

function statusTag(s: Survivor): string {
  const [text, cls] = STATUS_LABEL[s.status];
  return `<span class="tag ${cls}">${text}</span>`;
}

const facName = (id: FacilityId | null): string => (id ? (FACILITY_DEFS.find((f) => f.id === id)?.name ?? id) : '대기');
const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

// ───────── 화면 그리기 ─────────

function header(g: Game): string {
  const f = forecast(g);
  const cells = RES_KEYS.map((k) => {
    const net = f.net[k];
    const days = net < 0 ? Math.floor(g.stock[k] / -net) : null;
    const cls = net < 0 ? (days !== null && days <= 3 ? 'bad' : 'warn') : 'good';
    return `<div><small>${resLabel(k)}</small><b>${Math.round(g.stock[k])}</b><small class="${cls}">${signed(net)}/일</small></div>`;
  }).join('');
  const need = xpToNext(g.commander.level);
  return `<header class="hdr">
    <div class="hdr-top"><span>UNDERGROUND OS</span><span class="day">DAY ${String(g.day).padStart(3, '0')}</span></div>
    <div class="hdr-sub"><span>사령관 ${esc(g.commander.nickname)} · ${esc(g.title)}</span><span>지휘 Lv.${g.commander.level}</span></div>
    <div class="xpbar"><i style="width:${Math.min(100, (g.commander.xp / need) * 100)}%"></i></div>
    <div class="res">${cells}</div>
  </header>`;
}

function tabs(g: Game): string {
  const crewAlert = atBunker(g).some((s) => s.status === 'critical' || s.stress >= 85);
  return `<nav class="tabs">${TABS.map((t) =>
    `<button data-act="tab" data-arg="${t.id}" class="${ui.tab === t.id ? 'on' : ''}">${t.label}${t.id === 'crew' && crewAlert ? '<span class="dot">●</span>' : ''}${t.id === 'status' && g.pending ? '<span class="dot">●</span>' : ''}</button>`).join('')}</nav>`;
}

function viewStatus(g: Game): string {
  const f = forecast(g);
  const alerts: string[] = [];
  if (g.pending) alerts.push(`<div class="alert">⚠ 결정이 필요합니다. <button class="btn sm" data-act="decision">열기</button></div>`);
  for (const k of RES_KEYS) {
    if (f.net[k] < 0) {
      const days = Math.floor(g.stock[k] / -f.net[k]);
      if (days <= 5 && (k === 'food' || k === 'water' || k === 'power')) alerts.push(`<div class="alert ${days <= 2 ? '' : 'warn'}">⚠ ${resLabel(k)} ${days}일분 남음 (일일 ${signed(f.net[k])})</div>`);
    }
  }
  for (const s of atBunker(g)) {
    if (s.status === 'critical') alerts.push(`<div class="alert">⚠ ${esc(s.name)}: 위독 — 치료 기한 ${(g.critical[s.id] ?? 0) - g.day}일</div>`);
    else if (s.stress >= 85 || s.loyalty <= 25) alerts.push(`<div class="alert warn">⚠ ${esc(s.name)}: 정신력 위험 (스트레스 ${Math.round(s.stress)} · 충성 ${Math.round(s.loyalty)})</div>`);
  }
  const idle = FACILITY_DEFS.filter((d) => facilityState(g, d.id) === 'idle');
  if (idle.length > 0) alerts.push(`<div class="alert warn">담당자 없음: ${idle.map((d) => d.name).join(', ')}</div>`);

  const here = atBunker(g);
  const rows = RES_KEYS.map((k) => `<tr><td>${resLabel(k)}</td><td>${Math.round(g.stock[k])}</td><td class="${f.net[k] < 0 ? 'bad' : 'good'}">${signed(f.net[k])}</td></tr>`).join('');
  const log = [...g.log].slice(-8).reverse().map(logLine).join('');
  return `${alerts.join('') || '<p class="note">이상 징후 없음.</p>'}
    <h2>상황 요약</h2>
    <p class="note">생존자 ${alive(g).length}/${capacity(g)} (벙커 ${here.length} · 원정 ${alive(g).length - here.length}) · 배급 정책: ${esc(POLICIES.find((p) => p.id === g.policy)?.name ?? '')}</p>
    <table><tr><th>자원</th><th>보유</th><th>오늘 예상 수지</th></tr>${rows}</table>
    <p class="note" style="margin-top:6px">예상 수지 = 시설 생산 − 가동 비용 − 배급. 원정 전리품은 포함되지 않습니다.</p>
    <h2>최근 기록</h2><div class="log">${log}</div>`;
}

function logLine(e: LogEntry): string {
  const cls = e.kind === 'bad' || e.kind === 'death' ? 'bad' : e.kind === 'good' ? 'good' : e.kind === 'warn' ? 'warn' : '';
  return `<div class="${cls}"><span class="d">D${e.day}</span> ${esc(e.text)}</div>`;
}

function viewCrew(g: Game): string {
  const list = g.survivors.filter((s) => s.status !== 'dead');
  if (list.length === 0) return '<p class="note">생존자 없음.</p>';
  return `<p class="note">생존자 ${list.length}/${capacity(g)}. 인원을 눌러 배치와 배급 예외를 지정합니다.</p>` + list.map((s) => crewCard(g, s)).join('');
}

function crewCard(g: Game, s: Survivor): string {
  const open = ui.crew === s.id;
  const ex = s.exception === 'special' ? '<span class="tag good">특식</span>' : s.exception === 'withhold' ? '<span class="tag bad">배급 제외</span>' : '';
  let detail = '';
  if (open) {
    const slots = FACILITY_DEFS.filter((d) => g.facilities[d.id] > 0);
    const canMove = s.status !== 'away' && s.status !== 'critical';
    detail = `<div style="margin-top:8px" data-stop="1">
      <p class="note">${esc(s.story ?? '이름 없는 생존자. 폐허에서 살아남았다는 것 외에는 알려진 게 없다.')}</p>
      <p class="note">숙련도 ${'★'.repeat(s.skill)}${'☆'.repeat(5 - s.skill)}</p>
      ${canMove ? `<div class="sub">배치</div><div class="row">
        <button class="btn sm ${s.post === null ? '' : 'ghost'}" data-act="assign" data-arg="${s.id}|">대기</button>
        ${slots.map((d) => `<button class="btn sm ${s.post === d.id ? '' : 'ghost'}" data-act="assign" data-arg="${s.id}|${d.id}">${d.name}</button>`).join('')}</div>` : '<p class="note">지금은 배치를 바꿀 수 없습니다.</p>'}
      <div class="sub" style="margin-top:8px">배급 예외 (개인 수동 처리)</div><div class="row">
        <button class="btn sm ${s.exception === null ? '' : 'ghost'}" data-act="ex" data-arg="${s.id}|">정책 따름</button>
        <button class="btn sm ${s.exception === 'special' ? '' : 'ghost'}" data-act="ex" data-arg="${s.id}|special">특식</button>
        <button class="btn sm ${s.exception === 'withhold' ? 'red' : 'ghost'}" data-act="ex" data-arg="${s.id}|withhold">배급 제외</button></div>
    </div>`;
  }
  return `<div class="card tap ${open ? 'on' : ''}" data-act="crew" data-arg="${s.id}">
    <div class="card-head">${portrait(s)}<div class="card-main">
      <div class="title">${esc(s.name)}<span class="tag ${s.named ? 'named' : ''}">${s.named ? '네임드' : '일반'}</span>${statusTag(s)}${ex}</div>
      <div class="sub">${JOB_LABEL[s.job]} · ${esc(s.trait)} · ${s.status === 'away' ? '원정 중' : facName(s.post)}</div>
      ${bar('체력', s.hp, 'low')}${bar('스트레스', s.stress, 'high')}${bar('충성도', s.loyalty, 'low')}
    </div></div>${detail}</div>`;
}

function viewFac(g: Game): string {
  const rows = FACILITY_DEFS.map((d) => {
    const st = facilityState(g, d.id);
    const w = workersOf(g, d.id)[0];
    const tag = st === 'locked' ? '<span class="tag">잠김</span>' : st === 'active' ? '<span class="tag good">가동</span>' : '<span class="tag bad">운영 중지</span>';
    const open = ui.fac === d.id;
    return `<div class="card tap ${open ? 'on' : ''}" data-act="fac" data-arg="${d.id}">
      <div class="title">B${d.floor} ${d.name} ${g.facilities[d.id] > 0 ? `Lv.${g.facilities[d.id]}` : ''} ${tag}</div>
      <div class="sub">${st === 'locked' ? '개방 조건을 충족해 복구하세요' : w ? `담당: ${esc(w.name)}` : '담당자 없음 — 가동되지 않습니다'}</div>
      ${open ? facDetail(g, d.id) : ''}</div>`;
  }).join('');
  return `<p class="note">시설은 담당자가 있어야 가동되며, 가동 중에는 전력 등을 소모합니다.</p>${rows}`;
}

function facDetail(g: Game, id: FacilityId): string {
  const d = FACILITY_DEFS.find((x) => x.id === id)!;
  const st = facilityState(g, id);
  const level = g.facilities[id];
  const fmt = (o: Partial<Record<string, number>>): string => RES_KEYS.filter((k) => o[k]).map((k) => `${resLabel(k)} ${o[k]}`).join(', ') || '없음';
  const cam = `<div class="cctv ${st === 'active' ? '' : 'off'}"><img src="assets/rooms/room-${id}.png" alt="">
    <span class="cam">CAM B${d.floor}</span><span class="rec">${st === 'active' ? '● REC' : ''}</span>
    ${st === 'locked' ? '<div class="nosig">NO SIGNAL</div>' : st === 'idle' ? '<div class="nosig">운영 중지</div>' : ''}</div>`;
  let action = '';
  if (level <= 0) {
    const conds = unlockConditions(g, id);
    action = `<div class="sub">개방 조건</div>${conds.map((c) => `<div class="${c.met ? 'good' : 'bad'}">${c.met ? '✔' : '✘'} ${c.text}</div>`).join('')}
      <button class="btn" style="margin-top:8px" data-act="unlock" data-arg="${id}" ${conds.every((c) => c.met) ? '' : 'disabled'}>복구 (고철 ${d.unlock?.scrap})</button>`;
  } else {
    const staff = atBunker(g).filter((s) => s.status === 'ok' || s.status === 'sick' || s.status === 'injured');
    action = `<div class="sub">담당자 배치</div><div class="row">
      <button class="btn sm ${workersOf(g, id).length === 0 ? '' : 'ghost'}" data-act="assign" data-arg="|${id}">비우기</button>
      ${staff.map((s) => `<button class="btn sm ${s.post === id ? '' : 'ghost'}" data-act="assign" data-arg="${s.id}|${id}">${esc(s.name)}</button>`).join('')}</div>
      <button class="btn" style="margin-top:8px" data-act="upgrade" data-arg="${id}" ${level >= MAX_FACILITY_LEVEL || g.stock.scrap < upgradeCost(level) ? 'disabled' : ''}>${level >= MAX_FACILITY_LEVEL ? '최고 레벨' : `확장 Lv.${level + 1} (고철 ${upgradeCost(level)})`}</button>`;
  }
  return `<div style="margin-top:8px" data-stop="1">${cam}<p class="note">${d.desc}</p>
    <p class="note">생산: ${fmt(d.produce)} · 가동 비용: ${fmt(d.upkeep)}<br>효과: ${d.effect}</p>${action}</div>`;
}

function viewOps(g: Game): string {
  const away = g.expeditions.map((e) => {
    const a = AREAS.find((x) => x.id === e.areaId)!;
    return `<div class="card"><div class="title">${a.name}</div><div class="sub">${e.members.map((id) => esc(byId(g, id)?.name ?? '?')).join(', ')} · ${Math.max(1, e.returnDay - g.day)}일 후 귀환</div></div>`;
  }).join('');
  const areas = AREAS.map((a) => {
    const locked = g.commander.level < a.command;
    const busy = g.expeditions.some((e) => e.areaId === a.id);
    const open = ui.area === a.id;
    const loot = Object.entries(a.loot).map(([k, v]) => `${resLabel(k as never)} ${v?.[0]}~${v?.[1]}`).join(' · ');
    const team = ui.team.map((id) => byId(g, id)).filter((s): s is Survivor => !!s);
    let detail = '';
    if (open && !locked && !busy) {
      const ready = atBunker(g).filter((s) => s.status === 'ok');
      detail = `<div style="margin-top:8px" data-stop="1"><div class="sub">파견 인원 (최대 3명)</div>
        ${ready.map((s) => `<div class="pick ${ui.team.includes(s.id) ? 'on' : ''}" data-act="team" data-arg="${s.id}">${portrait(s, 1)}<div><b>${esc(s.name)}</b> ${s.named ? '<span class="tag named">네임드</span>' : ''}<div class="sub">${JOB_LABEL[s.job]} · ${'★'.repeat(s.skill)} · 체력 ${Math.round(s.hp)} · ${facName(s.post)}</div></div></div>`).join('') || '<p class="note">파견 가능한 인원이 없습니다.</p>'}
        <p class="${team.length ? 'warn' : 'note'}">${esc(dangerLabel(g, a, team))}</p>
        <p class="note">파견 중에는 그 인원이 맡던 시설이 멈춥니다. 돌아오지 못할 수도 있습니다.</p>
        <button class="btn" data-act="dispatch" data-arg="${a.id}" ${team.length === 0 ? 'disabled' : ''}>파견 (${team.length}명)</button></div>`;
    }
    return `<div class="card tap ${open ? 'on' : ''} ${locked ? 'dead' : ''}" data-act="area" data-arg="${a.id}">
      <div class="title">${a.name} ${locked ? `<span class="tag">지휘 Lv.${a.command} 필요</span>` : busy ? '<span class="tag warn">파견 중</span>' : ''}</div>
      <div class="sub">${a.desc}</div>
      <div class="sub">${a.days}일 · 위험도 ${a.danger >= 60 ? '높음' : a.danger >= 35 ? '보통' : '낮음'} · ${loot}</div>${detail}</div>`;
  }).join('');
  return `${away ? `<h2>파견 중</h2>${away}` : ''}<h2>지역</h2>
    <p class="note">원정으로 자원을 얻고 생존자를 찾습니다. 지역마다 이름 있는 생존자가 숨어 있습니다. 사령관은 단말기를 떠날 수 없으므로 인원을 대신 보냅니다.</p>${areas}`;
}

function viewPolicy(g: Game): string {
  const t = TITLES[g.title];
  const c = g.commander;
  const pol = POLICIES.map((p) => `<div class="card tap ${g.policy === p.id ? 'on' : ''}" data-act="policy" data-arg="${p.id}">
    <div class="title">${g.policy === p.id ? '◉' : '○'} ${p.name} <span class="sub">${p.brief}</span></div><div class="sub">${p.detail}</div></div>`).join('');
  const ex = g.survivors.filter((s) => s.status !== 'dead' && s.exception).map((s) => `<div>${esc(s.name)}: ${s.exception === 'special' ? '특식' : '배급 제외'}</div>`).join('') || '<div class="dim">없음</div>';
  const m = (v: number): string => `${'▮'.repeat(Math.min(10, Math.round(v / 3)))}${'▯'.repeat(Math.max(0, 10 - Math.round(v / 3)))}`;
  return `<h2>배급 정책 (벙커 전체 일괄 적용)</h2>${pol}
    <h2>개인 예외</h2><div class="card">${ex}<p class="note" style="margin:6px 0 0">[인원] 탭에서 개인별로 지정합니다.</p></div>
    <h2>사령관 판독</h2><div class="card">
      <div class="title">${esc(c.nickname)} — ${esc(g.title)}</div>
      <div class="sub">${esc(t.desc)}<br>패시브: ${esc(t.passive)}</div>
      <div class="stats" style="margin-top:6px">지휘 통제력 ${c.command} · 자원 배분 효율 ${c.logistics} · 정보 분석력 ${c.analysis}</div>
      <div class="stats" style="margin-top:6px">냉혹 ${m(g.tally.ruthless)}<br>온정 ${m(g.tally.mercy)}<br>효율 ${m(g.tally.efficient)}</div>
      <p class="note" style="margin:6px 0 0">별명은 누적된 선택으로 판독됩니다. (7일차부터)</p></div>`;
}

function viewRec(g: Game): string {
  const ob = [...g.obituaries].reverse().map((o) => `<div class="obit"><b>D${o.day} ${esc(o.name)}</b> (${JOB_LABEL[o.job]}${o.named ? ' · 네임드' : ''}) — ${esc(o.cause)}<div class="quote">마지막 기록: "${esc(o.last)}"</div></div>`).join('') || '<p class="note">아직 사망자가 없습니다.</p>';
  const hist = loadHistory().map((r) => `<div class="card"><b>${esc(r.nickname)}</b> — ${esc(r.title)}<div class="sub">${r.days}일 생존 · 사망 ${r.deaths}명 · ${esc(r.cause)} · ${esc(r.date)}</div></div>`).join('') || '<p class="note">지난 기록이 없습니다.</p>';
  const log = [...g.log].slice(-60).reverse().map(logLine).join('');
  return `<h2>사망 일지</h2>${ob}<h2>역사 기록</h2>${hist}<h2>전체 로그</h2><div class="log">${log}</div>`;
}

// ───────── 창 ─────────

function bootModal(): string {
  const lines = [
    'UNDERGROUND OS v0.9 — 벙커 관리 단말기', '전원 복구 중 ........ 완료', '생체 신호 스캔 ........ 4건 확인',
    '외부 통신 ........ 두절', '지휘 권한 승계자 대기 중 ........',
  ];
  const bgs = BACKGROUNDS.map((b, i) => `<div class="bgopt ${ui.bg === i ? 'on' : ''}" data-act="bg" data-arg="${i}"><b>${b.name}</b><div class="sub">${b.desc}</div><div class="stats">지휘 ${b.command} · 배분 ${b.logistics} · 분석 ${b.analysis}</div></div>`).join('');
  return `<div class="modal"><div class="modal-box"><h1>단말기 접속</h1>
    <div class="boot">${lines.map((l, i) => `<div class="fade-in" style="--i:${i}">&gt; ${l}</div>`).join('')}</div>
    <p style="margin-top:12px">당신은 벙커 최심부의 단말기 앞에 있습니다. 직접 싸우거나 일하지 않습니다. 당신의 일은 한정된 자원과 사람을 통제하는 것입니다. 모든 선택에는 대가가 따릅니다.</p>
    <h2>호출명</h2><input type="text" id="nick" maxlength="8" placeholder="2~8자" value="${esc(ui.nick)}" autocomplete="off">
    <h2>전직</h2>${bgs}
    <button class="btn" style="margin-top:12px" data-act="start">접속</button></div></div>`;
}

function reportModal(day: number, entries: LogEntry[]): string {
  const rows = entries.map((e, i) => `<div class="fade-in ${e.kind === 'bad' || e.kind === 'death' ? 'bad' : e.kind === 'good' ? 'good' : e.kind === 'warn' ? 'warn' : ''}" style="--i:${i}">&gt; ${esc(e.text)}</div>`).join('') || '<div class="dim">특이 사항 없음.</div>';
  return `<div class="modal"><div class="modal-box"><h1>DAY ${day} 정산 보고</h1><div class="log">${rows}</div>
    <button class="btn" style="margin-top:14px" data-act="closeModal">확인</button></div></div>`;
}

function decisionModal(g: Game): string {
  const ace = g.pending ? byId(g, g.pending.aceId) : null;
  if (!ace) return '';
  const cands = atBunker(g).filter((s) => s.status === 'ok' && s.id !== ace.id);
  const list = cands.map((s) => `<div class="pick" data-act="serum" data-arg="${s.id}">${portrait(s, 1)}<div><b>${esc(s.name)}</b> ${s.named ? '<span class="tag named">네임드</span>' : ''}<div class="sub">${JOB_LABEL[s.job]} · ${'★'.repeat(s.skill)} · 체력 ${Math.round(s.hp)}</div></div></div>`).join('') || '<p class="note">파견할 수 있는 인원이 없습니다.</p>';
  return `<div class="modal"><div class="modal-box"><h1 class="bad">⚠ 결정 필요</h1>
    <div class="card dead" style="opacity:1">${portrait(ace)}<div class="title" style="margin-top:6px">${esc(ace.name)} (${JOB_LABEL[ace.job]})</div>
    <div class="sub">${esc(ace.trait)}</div></div>
    <p><b>${esc(ace.name)}</b>이(가) 치명적인 질병에 걸렸습니다. 일반 약품으로는 치료할 수 없습니다. 위험 구역의 특수 세럼만이 유일한 치료법입니다. 기한은 ${(g.critical[ace.id] ?? 0) - g.day}일입니다.</p>
    <p class="note">누군가를 사지로 보내야 합니다. 성공 확률은 약 50% 안팎이며, 실패하면 파견된 사람과 ${esc(ace.name)} 모두 잃게 됩니다.</p>
    <h2>누구를 보내겠습니까</h2>${list}
    <button class="btn ghost red" style="margin-top:10px" data-act="serum" data-arg="">${esc(ace.name)}을(를) 포기한다</button></div></div>`;
}

function overModal(g: Game): string {
  const o = g.over!;
  return `<div class="modal"><div class="modal-box"><h1 class="bad">[ 신호 두절 ]</h1>
    <div class="card"><div class="title">${esc(g.commander.nickname)} — ${esc(g.title)}</div>
    <div class="sub">${g.day}일 생존 · 사망 ${g.obituaries.length}명</div>
    <p style="margin-top:8px" class="bad">${esc(o.cause)}: ${esc(o.summary)}</p></div>
    <p class="note">이 기록은 역사 기록에 남았습니다.</p>
    <h2>마지막 사망 일지</h2>${[...g.obituaries].slice(-3).reverse().map((x) => `<div class="obit"><b>D${x.day} ${esc(x.name)}</b> — ${esc(x.cause)}<div class="quote">"${esc(x.last)}"</div></div>`).join('') || '<p class="note">기록 없음.</p>'}
    <button class="btn" style="margin-top:12px" data-act="newrun">새 회차 시작</button></div></div>`;
}

// ───────── 그리기 ─────────

function render(): void {
  const keep = root.querySelector('.view')?.scrollTop ?? 0;
  if (!game) {
    root.innerHTML = `<div class="crt">${modal === 'boot' ? bootModal() : ''}${ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : ''}</div>`;
    return;
  }
  const g = game;
  let body = '';
  switch (ui.tab) {
    case 'status': body = viewStatus(g); break;
    case 'crew': body = viewCrew(g); break;
    case 'fac': body = viewFac(g); break;
    case 'ops': body = viewOps(g); break;
    case 'policy': body = viewPolicy(g); break;
    case 'rec': body = viewRec(g); break;
  }
  const lock = g.pending !== null;
  root.innerHTML = `<div class="crt">${header(g)}${tabs(g)}<main class="view">${body}</main>
    <footer class="foot"><button class="btn" data-act="endday" ${g.over ? 'disabled' : ''}>${lock ? '⚠ 결정 필요' : `하루 진행 ▶ (DAY ${g.day} → ${g.day + 1})`}</button></footer>
    ${modal === 'report' || modal === 'decision' || modal === 'over' ? modalHtml : ''}
    ${ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : ''}</div>`;
  const view = root.querySelector('.view');
  if (view) view.scrollTop = keep;
}

function showToast(msg: string): void {
  ui.toast = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast = '';
    root.querySelector('.toast')?.remove();
  }, 1800);
}

function result(r: ActionResult): void {
  if (game) saveGame(game);
  showToast(r.message);
  render();
}

function refreshModal(): void {
  if (!game) return;
  if (game.over) {
    if (!game.over.recorded) {
      game.over.recorded = true;
      pushHistory({
        nickname: game.commander.nickname, title: game.title, days: game.day, cause: game.over.cause,
        deaths: game.obituaries.length, date: new Date().toISOString().slice(0, 10),
      });
      saveGame(game);
    }
    modal = 'over';
    modalHtml = overModal(game);
  } else if (game.pending) {
    modal = 'decision';
    modalHtml = decisionModal(game);
  } else if (modal !== 'report') {
    modal = null;
    modalHtml = '';
  }
}

// ───────── 조작 ─────────

function act(name: string, arg: string): void {
  if (name === 'bg') {
    ui.bg = Number(arg);
    ui.nick = (root.querySelector('#nick') as HTMLInputElement | null)?.value ?? ui.nick;
    render();
    return;
  }
  if (name === 'start') {
    const nick = ((root.querySelector('#nick') as HTMLInputElement | null)?.value ?? '').trim();
    ui.nick = nick;
    if (nick.length < 2) {
      showToast('호출명을 2자 이상 입력하세요.');
      render();
      return;
    }
    const b = BACKGROUNDS[ui.bg];
    game = newGame({ nickname: nick, background: b.name, command: b.command, logistics: b.logistics, analysis: b.analysis });
    ui.toast = '';
    modal = null;
    ui.tab = 'status';
    saveGame(game);
    render();
    return;
  }
  if (!game) return;
  const g = game;

  switch (name) {
    case 'tab': ui.tab = arg as Tab; break;
    case 'crew': ui.crew = ui.crew === arg ? null : arg; break;
    case 'fac': ui.fac = ui.fac === arg ? null : (arg as FacilityId); break;
    case 'area': ui.area = ui.area === arg ? null : arg; ui.team = []; break;
    case 'team':
      ui.team = ui.team.includes(arg) ? ui.team.filter((x) => x !== arg) : ui.team.length < 3 ? [...ui.team, arg] : ui.team;
      break;
    case 'policy': return result(setPolicy(g, arg as never));
    case 'assign': {
      const [id, post] = arg.split('|');
      if (id === '') {
        for (const s of workersOf(g, post as FacilityId)) assign(g, s.id, null);
        return result({ ok: true, message: '담당자를 비웠습니다.' });
      }
      return result(assign(g, id, (post || null) as FacilityId | null));
    }
    case 'ex': {
      const [id, ex] = arg.split('|');
      return result(setException(g, id, (ex || null) as Exception));
    }
    case 'unlock': return result(unlockFacility(g, arg as FacilityId));
    case 'upgrade': return result(upgradeFacility(g, arg as FacilityId));
    case 'dispatch': {
      const r = startExpedition(g, arg, ui.team);
      if (r.ok) {
        ui.team = [];
        ui.area = null;
      }
      return result(r);
    }
    case 'decision':
      refreshModal();
      break;
    case 'serum': {
      const r = resolveSerum(g, arg || null);
      modal = null;
      refreshModal();
      return result(r);
    }
    case 'closeModal':
      modal = null;
      refreshModal();
      break;
    case 'endday': {
      if (g.pending) {
        refreshModal();
        break;
      }
      const day = g.day;
      const r = endDay(g);
      saveGame(g);
      if (g.over) {
        modal = null;
        refreshModal();
      } else {
        modal = 'report';
        modalHtml = reportModal(day, r.entries);
      }
      break;
    }
    case 'newrun':
      clearGame();
      game = null;
      ui.nick = '';
      modal = 'boot';
      break;
  }
  render();
}

export function startApp(el: HTMLElement): void {
  root = el;
  game = loadGame();
  if (!game) modal = 'boot';
  else refreshModal();
  root.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!target) return;
    // 카드 안의 세부 영역(data-stop)에서 버튼이 아닌 곳을 누를 때 카드가 접히지 않게 한다.
    if (target.classList.contains('tap') && (ev.target as HTMLElement).closest('[data-stop]')) return;
    ev.stopPropagation();
    act(target.dataset.act ?? '', target.dataset.arg ?? '');
  });
  render();
}
