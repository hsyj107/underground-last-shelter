import {
  AREAS, BACKGROUNDS, FACILITY_DEFS, JOB_LABEL, MAX_FACILITY_LEVEL, POLICIES, TITLES, upgradeCost, xpToNext, type FacilityDef,
} from '../sim/data';
import {
  assign, atBunker, byId, capacity, craftProsthetic, dangerLabel, endDay, facilityState, forecast, newGame, resLabel,
  resolveDecision, resolveSerum, setAuto, setException, setMemorial, setPolicy, setPrio, startExpedition, unlockConditions,
  unlockFacility, upgradeFacility, workersOf, type ActionResult,
} from '../sim/engine';
import { inBreak } from '../sim/core';
import { activeThoughts, BREAK_LABEL, bondLabel, bondOf } from '../sim/mind';
import { KIND_LABEL, PART_LABEL, PROSTHETIC, bodyFactor } from '../sim/body';
import { eventView } from '../sim/story';
import { DAY_MS, msToNextDay, tick } from '../sim/clock';
import { loadGame, saveGame } from '../sim/save';
import { layoutActors, syncActors, tickActors, SHAFT_X } from './actors';
import { figureHtml, loadParts } from './figures';
import { RES_KEYS, type BodyPart, type Exception, type FacilityId, type Game, type LogEntry, type Survivor } from '../sim/types';

/**
 * 단말기 화면. 상태는 sim/ 의 game 하나뿐이고, 화면은 그 상태를 그릴 뿐이다.
 * 모든 버튼은 data-act / data-arg 로 이 파일의 act() 에 연결된다.
 */

type Tab = 'ops' | 'shelter' | 'crew' | 'policy' | 'rec';
const TABS: { id: Tab; label: string }[] = [
  { id: 'ops', label: '탐험' }, { id: 'shelter', label: '쉘터' }, { id: 'crew', label: '생존자' },
  { id: 'policy', label: '정책' }, { id: 'rec', label: '기록' },
];

interface UiState {
  tab: Tab;
  /** 쉘터에서 방이나 생존자를 눌렀을 때 아래에서 올라오는 창 */
  sheet: { kind: 'room' | 'crew'; id: string } | null;
  crew: string | null;
  /** 생존자 탭: 명단 / 작업표 */
  crewView: 'list' | 'grid';
  area: string | null;
  team: string[];
  /** 신규 접속 화면에서 고른 값 */
  nick: string;
  bg: number;
  toast: string;
}

const ui: UiState = { tab: 'shelter', sheet: null, crew: null, crewView: 'list', area: null, team: [], nick: '', bg: 0, toast: '' };
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
  return figureHtml(s, `${36 * size}px`);
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
    `<button data-act="tab" data-arg="${t.id}" class="${ui.tab === t.id ? 'on' : ''}">${t.label}${t.id === 'crew' && crewAlert ? '<span class="dot">●</span>' : ''}${t.id === 'shelter' && g.pending ? '<span class="dot">●</span>' : ''}</button>`).join('')}</nav>`;
}

function alertsHtml(g: Game): string {
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
  return alerts.slice(0, 4).join('');
}

// ───────── 쉘터 단면 ─────────

function surfaceHtml(g: Game): string {
  const away = g.survivors.filter((s) => s.status === 'away');
  const zombies = [12, 34, 58, 81].map((x, i) => `<i class="zb" style="left:${x}%;animation-delay:${-i * 1.7}s"></i>`).join('');
  const team = away.map((s, i) => `<span class="awaysv" style="left:${30 + i * 9}%">${figureHtml(s)}</span>`).join('');
  return `<div class="surface"><div class="skyline"></div>${zombies}${team}
    <span class="surf-tag">지상${away.length ? ` · 원정 ${away.length}명` : ''}</span></div>`;
}

function roomHtml(g: Game, d: FacilityDef): string {
  const level = g.facilities[d.id];
  if (level <= 0) {
    const need = unlockConditions(g, d.id).filter((c) => !c.met).map((c) => c.text).join(' · ');
    return `<div class="room locked" data-act="room" data-arg="${d.id}">B${d.floor} ${d.name} <span class="tag">잠김</span><div class="sub">${esc(need || '복구 가능')}</div></div>`;
  }
  const st = facilityState(g, d.id);
  return `<div class="room ${st === 'idle' ? 'idle' : st === 'active' ? 'live' : ''}" data-act="room" data-arg="${d.id}">
    <img class="roomimg" src="assets/rooms/room-${d.id}.png" alt="">
    <div class="plate">B${d.floor} ${d.name} Lv.${level} ${st === 'active' ? '' : '· 운영 중지'}</div></div>`;
}

/** 방 위를 덮는 층에서 돌아다니는 생존자들. 위치는 actors.ts 가 정한다 */
function peopleHtml(g: Game): string {
  const svs = atBunker(g).map((s) => {
    const cls = [s.status === 'sick' || s.status === 'injured' ? 'sick' : '', s.status === 'critical' ? 'crit' : '', s.stress >= 85 ? 'mad' : '', inBreak(g, s) ? 'brk' : ''].join(' ');
    return `<div class="sv ${cls}" data-act="crewsheet" data-arg="${s.id}" data-d="1">
      <span class="nm">${s.named ? '★' : ''}${esc(s.name)}</span>${s.status === 'critical' || s.stress >= 85 ? '<span class="bang">!</span>' : ''}
      <span class="fx"></span>${figureHtml(s)}</div>`;
  }).join('');
  return `<div class="sv-layer"><i class="shaft" style="left:${SHAFT_X}%"></i>${svs}</div>`;
}

/** 하루 중 뒤쪽 1/4은 밤 (숙소에서 쉬는 사람들은 잔다) */
function isNight(g: Game): boolean {
  return 1 - msToNextDay(g, Date.now()) / g.clock.dayMs > 0.75;
}

function viewShelter(g: Game): string {
  syncActors(g);
  const last = [...g.log].slice(-2).reverse().map(logLine).join('');
  return `${alertsHtml(g)}${surfaceHtml(g)}<div class="stack">${FACILITY_DEFS.map((d) => roomHtml(g, d)).join('')}${peopleHtml(g)}</div>
    <div class="log ticker">${last}</div>`;
}

function logLine(e: LogEntry): string {
  const cls = e.kind === 'bad' || e.kind === 'death' ? 'bad' : e.kind === 'good' ? 'good' : e.kind === 'warn' ? 'warn' : '';
  return `<div class="${cls}"><span class="d">D${e.day}</span> ${esc(e.text)}</div>`;
}

const ABBR: Record<string, string> = {
  power_plant: '발전', water_purifier: '정수', farm: '농장', dormitory: '숙소', medical: '의료', workshop: '공방', laboratory: '연구', armory: '무기',
};

function viewCrew(g: Game): string {
  const list = g.survivors.filter((s) => s.status !== 'dead');
  if (list.length === 0) return '<p class="note">생존자 없음.</p>';
  const sw = `<div class="row" style="margin-bottom:8px">
    <button class="btn sm ${ui.crewView === 'list' ? '' : 'ghost'}" data-act="crewview" data-arg="list">명단</button>
    <button class="btn sm ${ui.crewView === 'grid' ? '' : 'ghost'}" data-act="crewview" data-arg="grid">작업 우선순위표</button></div>`;
  if (ui.crewView === 'grid') return sw + gridHtml(g, list);
  return sw + `<p class="note">생존자 ${list.length}/${capacity(g)}. 인원을 눌러 상태·관계·몸·배치를 봅니다.</p>` + list.map((s) => crewCard(g, s)).join('');
}

/** 생존자 × 시설 우선순위표. 칸을 누르면 1→2→3→4→안 함 순으로 바뀝니다 */
function gridHtml(g: Game, list: Survivor[]): string {
  const open = FACILITY_DEFS.filter((d) => g.facilities[d.id] > 0);
  const head = open.map((d) => `<th>${ABBR[d.id]}</th>`).join('');
  const rows = list.map((s) => {
    const cells = open.map((d) => {
      const v = s.prio[d.id] ?? 3;
      return `<td><button class="pc p${v} ${s.post === d.id ? 'at' : ''}" data-act="prio" data-arg="${s.id}|${d.id}">${v === 0 ? '–' : v}</button></td>`;
    }).join('');
    return `<tr><td class="gn" data-act="crewsheet" data-arg="${s.id}">${s.named ? '★' : ''}${esc(s.name)}</td>${cells}
      <td><button class="pc ${s.auto ? 'on' : ''}" data-act="auto" data-arg="${s.id}">${s.auto ? '자동' : '수동'}</button></td></tr>`;
  }).join('');
  return `<p class="note">숫자가 작을수록 하고 싶은 일(1=가장 원함, –=맡기지 않음). 밝게 표시된 칸이 지금 맡은 시설입니다. [자동]이면 이 표대로 배치되고, 직접 배치하면 [수동]이 됩니다.</p>
    <div class="gridwrap"><table class="grid"><tr><th></th>${head}<th>배치</th></tr>${rows}</table></div>`;
}

function moodLabel(stress: number): string {
  return stress < 30 ? '평온' : stress < 50 ? '안정' : stress < 70 ? '불안' : stress < 85 ? '위태' : '붕괴 직전';
}

function crewCard(g: Game, s: Survivor, forceOpen = false): string {
  const open = forceOpen || ui.crew === s.id;
  const ex = s.exception === 'special' ? '<span class="tag good">특식</span>' : s.exception === 'withhold' ? '<span class="tag bad">배급 제외</span>' : '';
  const brk = inBreak(g, s) ? `<span class="tag bad">${BREAK_LABEL[s.breakKind ?? ''] ?? '붕괴'}</span>` : '';
  let detail = '';
  if (open) {
    const slots = FACILITY_DEFS.filter((d) => g.facilities[d.id] > 0);
    const canMove = s.status !== 'away' && s.status !== 'critical';

    const thoughts = [...activeThoughts(g, s)].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 8)
      .map((t) => `<div class="${t.value < 0 ? 'bad' : 'good'}">${t.value > 0 ? '+' : ''}${Math.round(t.value)} ${esc(t.text)}</div>`).join('') || '<div class="dim">특별한 생각 없음</div>';

    const bonds = g.survivors.filter((o) => o.id !== s.id && o.status !== 'dead')
      .map((o) => ({ o, v: bondOf(s, o) })).filter((x) => Math.abs(x.v) >= 15)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 5)
      .map((x) => `<div class="${x.v < 0 ? 'bad' : 'good'}">${esc(x.o.name)} — ${bondLabel(x.v)} (${x.v > 0 ? '+' : ''}${x.v})</div>`).join('') || '<div class="dim">아직 이렇다 할 관계가 없습니다.</div>';

    const body = s.wounds.map((w) => {
      const label = `${PART_LABEL[w.part]} ${KIND_LABEL[w.kind]}${w.kind === 'wound' && w.until ? ` (${Math.max(0, w.until - g.day)}일 후 아묾)` : ''}`;
      const craft = w.kind === 'lost'
        ? ` <button class="btn sm ghost" data-act="prosthetic" data-arg="${s.id}|${w.part}">의수·의족 (고철 ${PROSTHETIC.scrap}·의약품 ${PROSTHETIC.medicine})</button>` : '';
      return `<div class="${w.kind === 'lost' ? 'bad' : w.kind === 'prosthetic' ? 'warn' : ''}">${label}${craft}</div>`;
    }).join('') || '<div class="dim">온전한 몸</div>';

    detail = `<div style="margin-top:8px" data-stop="1">
      <p class="note">${esc(s.story ?? '이름 없는 생존자. 폐허에서 살아남았다는 것 외에는 알려진 게 없다.')}</p>
      <p class="note">숙련도 ${'★'.repeat(s.skill)}${'☆'.repeat(5 - s.skill)} · 몸 상태 능률 ${Math.round(bodyFactor(s) * 100)}%</p>
      <div class="sub">기분 — ${moodLabel(s.stress)}</div><div class="log">${thoughts}</div>
      <div class="sub" style="margin-top:8px">관계</div><div class="log">${bonds}</div>
      <div class="sub" style="margin-top:8px">몸</div><div class="log">${body}</div>
      <div class="sub" style="margin-top:8px">작업 우선순위 (1=가장 원함, –=안 함) · 눌러서 바꿉니다</div><div class="row">
        ${slots.map((d) => { const v = s.prio[d.id] ?? 3; return `<button class="pc p${v} ${s.post === d.id ? 'at' : ''}" style="width:auto;padding:2px 7px" data-act="prio" data-arg="${s.id}|${d.id}">${ABBR[d.id]} ${v === 0 ? '–' : v}</button>`; }).join('')}
        <button class="pc ${s.auto ? 'on' : ''}" style="width:auto;padding:2px 7px" data-act="auto" data-arg="${s.id}">${s.auto ? '자동 배치 중' : '직접 배치 중'}</button></div>
      ${canMove ? `<div class="sub" style="margin-top:8px">직접 배치</div><div class="row">
        <button class="btn sm ${s.post === null && !s.auto ? '' : 'ghost'}" data-act="assign" data-arg="${s.id}|">대기</button>
        ${slots.map((d) => `<button class="btn sm ${s.post === d.id ? '' : 'ghost'}" data-act="assign" data-arg="${s.id}|${d.id}">${d.name}</button>`).join('')}</div>` : '<p class="note">지금은 배치를 바꿀 수 없습니다.</p>'}
      <div class="sub" style="margin-top:8px">배급 예외 (개인 수동 처리)</div><div class="row">
        <button class="btn sm ${s.exception === null ? '' : 'ghost'}" data-act="ex" data-arg="${s.id}|">정책 따름</button>
        <button class="btn sm ${s.exception === 'special' ? '' : 'ghost'}" data-act="ex" data-arg="${s.id}|special">특식</button>
        <button class="btn sm ${s.exception === 'withhold' ? 'red' : 'ghost'}" data-act="ex" data-arg="${s.id}|withhold">배급 제외</button></div>
    </div>`;
  }
  return `<div class="card ${forceOpen ? '' : 'tap'} ${open ? 'on' : ''}" ${forceOpen ? '' : `data-act="crew" data-arg="${s.id}"`}>
    <div class="card-head">${portrait(s)}<div class="card-main">
      <div class="title">${esc(s.name)}<span class="tag ${s.named ? 'named' : ''}">${s.named ? '네임드' : '일반'}</span>${statusTag(s)}${brk}${ex}</div>
      <div class="sub">${JOB_LABEL[s.job]} · ${Math.floor(s.age)}세 · ${esc(s.trait)} · ${s.status === 'away' ? '원정 중' : facName(s.post)}${s.auto ? ' (자동)' : ''}</div>
      ${bar('체력', s.hp, 'low')}${bar('스트레스', s.stress, 'high')}${bar('충성도', s.loyalty, 'low')}
    </div></div>${detail}</div>`;
}

function facDetail(g: Game, id: FacilityId): string {
  const d = FACILITY_DEFS.find((x) => x.id === id)!;
  const level = g.facilities[id];
  const fmt = (o: Partial<Record<string, number>>): string => RES_KEYS.filter((k) => o[k]).map((k) => `${resLabel(k)} ${o[k]}`).join(', ') || '없음';
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
  return `<div style="margin-top:8px" data-stop="1"><p class="note">${d.desc}</p>
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

function obitCard(o: Game['obituaries'][number], i: number): string {
  const star = o.memorial ? '★ ' : '';
  return `<div class="obit"><b>${star}D${o.day} ${esc(o.name)}</b> (${JOB_LABEL[o.job]}${o.named ? ' · 네임드' : ''} · ${o.age}세 · ${o.served}일 함께함) — ${esc(o.cause)}
    <div class="quote">마지막 기록: "${esc(o.last)}"</div>
    <button class="btn sm ghost" data-act="memorial" data-arg="${i}">${o.memorial ? '기억 해제' : '기억하기'}</button></div>`;
}

function viewRec(g: Game): string {
  const idx = g.obituaries.map((o, i) => ({ o, i })).reverse();
  const kept = idx.filter((x) => x.o.memorial).map((x) => obitCard(x.o, x.i)).join('');
  const rest = idx.filter((x) => !x.o.memorial).map((x) => obitCard(x.o, x.i)).join('');
  const chron = [...g.chronicle].reverse().map((c) => `<div><span class="d">D${c.day}</span> ${esc(c.text)}</div>`).join('');
  const log = [...g.log].slice(-60).reverse().map(logLine).join('');
  return `<h2>전몰자 기록 (${g.obituaries.length}명)</h2>${kept}${rest || (kept ? '' : '<p class="note">아직 사망자가 없습니다.</p>')}
    <h2>정착지 연대기</h2><div class="log">${chron}</div><h2>전체 로그</h2><div class="log">${log}</div>`;
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

function reportModal(title: string, entries: LogEntry[], note = ''): string {
  const rows = entries.map((e, i) => `<div class="fade-in ${e.kind === 'bad' || e.kind === 'death' ? 'bad' : e.kind === 'good' ? 'good' : e.kind === 'warn' ? 'warn' : ''}" style="--i:${i}">&gt; ${esc(e.text)}</div>`).join('') || '<div class="dim">특이 사항 없음.</div>';
  return `<div class="modal"><div class="modal-box"><h1>${esc(title)}</h1>${note ? `<p class="note">${esc(note)}</p>` : ''}<div class="log">${rows}</div>
    <button class="btn" style="margin-top:14px" data-act="closeModal">확인</button></div></div>`;
}

function decisionModal(g: Game): string {
  if (g.pending?.kind === 'event') {
    const v = eventView(g);
    if (!v) return '';
    const choices = v.choices.map((c) => `<div class="pick ${c.disabled ? 'dead' : ''}" ${c.disabled ? '' : `data-act="event" data-arg="${c.id}"`} style="display:block">
      <b>${esc(c.label)}</b><div class="sub">${esc(c.hint)}</div></div>`).join('');
    return `<div class="modal"><div class="modal-box"><h1 class="warn">⚠ ${esc(v.title)}</h1>
      <p>${esc(v.text)}</p><h2>어떻게 하겠습니까</h2>${choices}</div></div>`;
  }
  const ace = g.pending?.kind === 'serum' ? byId(g, g.pending.aceId) : null;
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
    case 'shelter': body = viewShelter(g); break;
    case 'crew': body = viewCrew(g); break;
    case 'ops': body = viewOps(g); break;
    case 'policy': body = viewPolicy(g); break;
    case 'rec': body = viewRec(g); break;
  }
  root.innerHTML = `<div class="crt">${header(g)}<main class="view ${ui.tab}">${body}</main>
    <footer class="foot"><div class="clock" id="clock">${clockText(g)}</div>
      <button class="btn sm ghost" data-act="endday" title="시험용">⏩ 시험용: 하루 즉시 진행</button></footer>${tabs(g)}
    ${sheetHtml(g)}${modal === 'report' || modal === 'decision' ? modalHtml : ''}
    ${ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : ''}</div>`;
  const view = root.querySelector('.view');
  if (view) view.scrollTop = keep;
  if (ui.tab === 'shelter') layoutActors(root, g, isNight(g));
}

function sheetHtml(g: Game): string {
  if (!ui.sheet) return '';
  let body = '';
  if (ui.sheet.kind === 'crew') {
    const s = byId(g, ui.sheet.id);
    if (!s || s.status === 'dead') return '';
    body = crewCard(g, s, true);
  } else {
    const d = FACILITY_DEFS.find((x) => x.id === ui.sheet?.id);
    if (!d) return '';
    const level = g.facilities[d.id];
    const st = facilityState(g, d.id);
    const tag = st === 'locked' ? '<span class="tag">잠김</span>' : st === 'active' ? '<span class="tag good">가동</span>' : '<span class="tag bad">운영 중지</span>';
    body = `<div class="card on"><div class="title">B${d.floor} ${d.name} ${level > 0 ? `Lv.${level}` : ''} ${tag}</div>${facDetail(g, d.id)}</div>`;
  }
  return `<div class="sheet-bg" data-act="closeSheet"></div><div class="sheet">${body}<button class="btn ghost" style="margin-top:8px" data-act="closeSheet">닫기</button></div>`;
}

function clockText(g: Game): string {
  if (g.pending) return '⚠ 결정 필요 — 시간 정지 중';
  const sec = Math.ceil(msToNextDay(g, Date.now()) / 1000);
  const m = Math.floor(sec / 60);
  return `DAY ${g.day} → ${g.day + 1} · ${m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분 ${sec % 60}초`} 후`;
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
  if (game.pending) {
    modal = 'decision';
    modalHtml = decisionModal(game);
  } else if (modal !== 'report') {
    modal = null;
    modalHtml = '';
  }
}

/** 시간이 흐른 만큼 정산하고, 자리를 비운 동안의 일이나 붕괴는 보고 창으로 알린다 */
function advance(): void {
  if (!game) return;
  const before = game.collapses;
  const r = tick(game, Date.now());
  if (r.days === 0) return;
  saveGame(game);
  const collapsed = game.collapses > before;
  if (r.away || collapsed) {
    const title = collapsed ? '정착지 붕괴 보고' : `복귀 보고 (${r.days}일 경과)`;
    const note = r.capped ? '접속하지 않은 시간이 길어 일부는 계산하지 않았습니다.' : '';
    modal = 'report';
    modalHtml = reportModal(title, r.entries, note);
  } else {
    showToast(`DAY ${game.day} 정산 완료`);
  }
  refreshModal();
  render();
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
    game = newGame({ nickname: nick, background: b.name, command: b.command, logistics: b.logistics, analysis: b.analysis }, Math.random, Date.now(), dayMsSetting());
    ui.toast = '';
    modal = null;
    ui.tab = 'shelter';
    saveGame(game);
    render();
    return;
  }
  if (!game) return;
  const g = game;

  switch (name) {
    case 'tab': ui.tab = arg as Tab; ui.sheet = null; break;
    case 'room': ui.sheet = { kind: 'room', id: arg }; break;
    case 'crewsheet': ui.sheet = { kind: 'crew', id: arg }; break;
    case 'closeSheet': ui.sheet = null; break;
    case 'crew': ui.crew = ui.crew === arg ? null : arg; break;
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
    case 'event': {
      const r = resolveDecision(g, arg);
      if (r.ok) modal = null;
      refreshModal();
      return result(r);
    }
    case 'crewview': ui.crewView = arg as 'list' | 'grid'; break;
    case 'prio': {
      const [id, fac] = arg.split('|');
      const cur = byId(g, id)?.prio[fac as FacilityId] ?? 3;
      return result(setPrio(g, id, fac as FacilityId, cur === 0 ? 1 : cur === 4 ? 0 : cur + 1));
    }
    case 'auto': return result(setAuto(g, arg, !(byId(g, arg)?.auto ?? false)));
    case 'prosthetic': {
      const [id, part] = arg.split('|');
      return result(craftProsthetic(g, id, part as BodyPart));
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
      const before = g.collapses;
      const day = g.day;
      const r = endDay(g);
      g.clock.last = Date.now();
      g.clock.carry = 0;
      saveGame(g);
      modal = 'report';
      modalHtml = reportModal(g.collapses > before ? '정착지 붕괴 보고' : `DAY ${day} 정산 보고`, r.entries);
      refreshModal();
      break;
    }
    case 'memorial': return result(setMemorial(g, Number(arg)));
  }
  render();
}

/** ⚠ 시험용: 주소에 ?dayms=30000 을 붙이면 게임 하루가 30초가 된다 */
function dayMsSetting(): number {
  const q = Number(new URLSearchParams(window.location.search).get('dayms'));
  return Number.isFinite(q) && q >= 1000 ? q : DAY_MS;
}

export function startApp(el: HTMLElement): void {
  root = el;
  game = loadGame();
  if (!game) modal = 'boot';
  else {
    game.clock.dayMs = dayMsSetting();
    refreshModal();
  }
  root.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!target) return;
    // 카드 안의 세부 영역(data-stop)에서 버튼이 아닌 곳을 누를 때 카드가 접히지 않게 한다.
    if (target.classList.contains('tap') && (ev.target as HTMLElement).closest('[data-stop]')) return;
    ev.stopPropagation();
    act(target.dataset.act ?? '', target.dataset.arg ?? '');
  });
  render();
  advance();
  window.setInterval(() => {
    if (!game) return;
    advance();
    const c = root.querySelector('#clock');
    if (c) c.textContent = clockText(game);
  }, 1000);
  window.setInterval(() => {
    if (game && ui.tab === 'shelter' && !document.hidden) tickActors(root, game, isNight(game));
  }, 2800);
  window.addEventListener('resize', () => {
    if (game && ui.tab === 'shelter') layoutActors(root, game, isNight(game));
  });
  void loadParts().then(() => render());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) advance();
  });
}
