// 계정 로그인(이메일 링크)과 클라우드 세이브. 라이브러리 없이 Supabase REST를 직접 부른다.
// 규칙(state.ts)과는 무관: 저장된 문자열(localStorage)을 서버와 맞추기만 한다.

const URL_BASE = 'https://usjhdljzkncbnqyduupu.supabase.co';
const API_KEY = 'sb_publishable_MmTYdOk41l0xmLLdRp7Ikw_DsFxZZCH';
const SAVE_KEY = 'last-shelter-b7-v1'; // state.ts의 저장 키와 같아야 한다
const AUTH_KEY = 'last-shelter-b7-auth';
const META_KEY = 'last-shelter-b7-cloud';

interface Session {
  access: string;
  refresh: string;
  exp: number; // 초
  uid: string;
  email: string;
}

interface Meta {
  uid: string;
  /** 이 기기가 마지막으로 서버와 맞춘 시각(서버에 적힌 saved_at) */
  syncedAt: number;
}

interface CloudRow {
  data: Record<string, unknown>;
  saved_at: number;
}

let session: Session | null = null;
let lastError = '';
let blocked = false; // 다른 기기가 더 새 저장을 올려서 자동 저장을 멈춘 상태
let onNotice: (msg: string) => void = () => {};

function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = ls()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, v: unknown): void {
  try {
    ls()?.setItem(key, JSON.stringify(v));
  } catch {
    /* 무시 */
  }
}

function b64json(part: string): Record<string, unknown> {
  const s = part.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

function toSession(access: string, refresh: string): Session | null {
  try {
    const p = b64json(access.split('.')[1]);
    return { access, refresh, exp: Number(p.exp), uid: String(p.sub), email: String(p.email ?? '') };
  } catch {
    return null;
  }
}

async function api(path: string, init: RequestInit & { auth?: boolean; ms?: number } = {}): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init.ms ?? 6000);
  try {
    const headers: Record<string, string> = { apikey: API_KEY, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) };
    if (init.auth && session) headers.Authorization = `Bearer ${session.access}`;
    return await fetch(`${URL_BASE}${path}`, { ...init, headers, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 로그인 ----------

/** 주소 뒤 #access_token=... 을 읽어 로그인 상태로 만든다 (이메일 링크를 눌러 돌아온 경우) */
function takeHashSession(): string | null {
  const h = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!h) return null;
  const q = new URLSearchParams(h);
  if (q.get('error_description')) {
    history.replaceState(null, '', location.pathname + location.search);
    return (q.get('error_description') ?? '').replace(/\+/g, ' ');
  }
  const at = q.get('access_token');
  const rt = q.get('refresh_token');
  if (!at || !rt) return null;
  const s = toSession(at, rt);
  history.replaceState(null, '', location.pathname + location.search);
  if (!s) return '로그인 정보를 읽지 못했어요.';
  session = s;
  writeJson(AUTH_KEY, s);
  return null;
}

async function ensureFresh(): Promise<void> {
  if (!session) return;
  if (session.exp - 60 > Date.now() / 1000) return;
  try {
    const r = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh }) });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { access_token: string; refresh_token: string };
    const s = toSession(j.access_token, j.refresh_token);
    if (!s) throw new Error('token');
    session = s;
    writeJson(AUTH_KEY, s);
  } catch (e) {
    // 네트워크 문제면 로그인은 유지하고, 서버가 거절했을 때만 로그아웃
    if (e instanceof Error && /^(400|401|403)$/.test(e.message)) signOut();
    else lastError = '서버에 연결하지 못했어요.';
  }
}

/** 이메일로 로그인 링크를 보낸다. 처음 쓰는 이메일이면 계정이 만들어진다. */
export async function sendLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim();
  if (!/^\S+@\S+\.\S+$/.test(e)) return { ok: false, error: '이메일 주소를 확인해 주세요.' };
  try {
    const redirect = encodeURIComponent(location.origin + location.pathname);
    const r = await api(`/auth/v1/otp?redirect_to=${redirect}`, { method: 'POST', body: JSON.stringify({ email: e, create_user: true }) });
    if (r.ok) return { ok: true };
    if (r.status === 429) return { ok: false, error: '메일을 너무 자주 보냈어요. 잠시 뒤에 다시 해 주세요.' };
    return { ok: false, error: '메일을 보내지 못했어요. (오류 ' + r.status + ')' };
  } catch {
    return { ok: false, error: '서버에 연결하지 못했어요.' };
  }
}

export function signOut(): void {
  session = null;
  blocked = false;
  try {
    ls()?.removeItem(AUTH_KEY);
    ls()?.removeItem(META_KEY);
  } catch {
    /* 무시 */
  }
}

export function account(): { email: string; blocked: boolean; error: string } | null {
  return session ? { email: session.email, blocked, error: lastError } : null;
}

export function lastSyncedAt(): number | null {
  const m = readJson<Meta>(META_KEY);
  return m && session && m.uid === session.uid ? m.syncedAt : null;
}

// ---------- 서버 세이브 ----------

async function fetchRow(): Promise<CloudRow | null | 'error'> {
  if (!session) return null;
  try {
    const r = await api(`/rest/v1/underground_saves?select=data,saved_at&user_id=eq.${session.uid}`, { auth: true });
    if (!r.ok) return 'error';
    const rows = (await r.json()) as CloudRow[];
    return rows[0] ?? null;
  } catch {
    return 'error';
  }
}

async function fetchStamp(): Promise<number | null | 'error'> {
  if (!session) return null;
  try {
    const r = await api(`/rest/v1/underground_saves?select=saved_at&user_id=eq.${session.uid}`, { auth: true });
    if (!r.ok) return 'error';
    const rows = (await r.json()) as { saved_at: number }[];
    return rows[0] ? Number(rows[0].saved_at) : null;
  } catch {
    return 'error';
  }
}

/** 이 기기의 저장을 서버에 올린다. force가 아니면 다른 기기가 더 새로 올린 경우 멈춘다. */
export async function push(force = false): Promise<boolean> {
  if (!session) return false;
  await ensureFresh();
  if (!session) return false;
  const raw = ls()?.getItem(SAVE_KEY);
  if (!raw) return false;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return false;
  }
  if (!force) {
    if (blocked) return false;
    const stamp = await fetchStamp();
    if (stamp === 'error') {
      lastError = '서버에 연결하지 못했어요.';
      return false;
    }
    const mine = lastSyncedAt() ?? 0;
    if (stamp !== null && stamp > mine) {
      blocked = true;
      onNotice('다른 기기에서 더 새로 저장했어요. 이 기기 저장은 멈췄어요. 설정에서 이 기기를 덮어쓸지 정해 주세요.');
      return false;
    }
  }
  const savedAt = Date.now();
  try {
    const r = await api('/rest/v1/underground_saves?on_conflict=user_id', {
      method: 'POST',
      auth: true,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: session.uid, data, saved_at: savedAt }),
    });
    if (!r.ok) {
      lastError = '저장하지 못했어요. (오류 ' + r.status + ')';
      return false;
    }
  } catch {
    lastError = '서버에 연결하지 못했어요.';
    return false;
  }
  lastError = '';
  blocked = false;
  writeJson(META_KEY, { uid: session.uid, syncedAt: savedAt } satisfies Meta);
  return true;
}

/** 서버에 있는 저장으로 이 기기를 덮어쓰고 새로고침한다 */
export async function pullAndReload(): Promise<void> {
  await ensureFresh();
  const row = await fetchRow();
  if (!row || row === 'error' || !session) {
    onNotice('서버 저장을 불러오지 못했어요.');
    return;
  }
  ls()?.setItem(SAVE_KEY, JSON.stringify(row.data));
  writeJson(META_KEY, { uid: session.uid, syncedAt: Number(row.saved_at) } satisfies Meta);
  location.reload();
}

/** 새로 시작할 때 서버 저장도 지운다 */
export async function deleteRemote(): Promise<void> {
  if (!session) return;
  try {
    await ensureFresh();
    if (session) await api(`/rest/v1/underground_saves?user_id=eq.${session.uid}`, { method: 'DELETE', auth: true });
  } catch {
    /* 무시 */
  }
  try {
    ls()?.removeItem(META_KEY);
  } catch {
    /* 무시 */
  }
}

// ---------- 시작할 때 맞추기 ----------

function summary(d: Record<string, unknown>): string {
  const created = Number(d.created);
  const day = Number.isFinite(created) ? Math.max(1, Math.floor((Date.now() - created) / 86400000) + 1) : '?';
  const crew = Array.isArray(d.crew) ? d.crew.length + 1 : '?';
  const name = typeof d.name === 'string' ? d.name : '이름 없음';
  return `${name} · 접속 ${day}일째 · ${crew}명 · 뚜껑 ${Number(d.caps ?? 0)}`;
}

function choose(local: Record<string, unknown>, cloud: CloudRow): Promise<'local' | 'cloud'> {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,6,4,0.92);font-family:inherit;color:#f0e6c8;';
    const btn = 'display:block;width:100%;margin:8px 0 0;padding:12px;border:3px solid #000;background:#3a2e22;color:#f0e6c8;font:inherit;text-align:left;';
    box.innerHTML = `<div style="max-width:420px;width:100%;padding:16px;background:#2a2118;border:3px solid #000;box-shadow:inset 0 0 0 2px #5a4630">
      <h2 style="margin:0 0 8px;font-size:17px;text-align:center">☁ 어느 저장으로 이어서 할까요?</h2>
      <p style="margin:0 0 6px;font-size:13px;opacity:.8">이 기기와 서버에 서로 다른 저장이 있어요. 고르지 않은 쪽은 덮어써집니다.</p>
      <button id="pick-cloud" style="${btn}">☁ <b>서버 저장</b><br><small>${summary(cloud.data)}<br>${new Date(Number(cloud.saved_at)).toLocaleString('ko-KR')}</small></button>
      <button id="pick-local" style="${btn}">📱 <b>이 기기 저장</b><br><small>${summary(local)}</small></button>
    </div>`;
    document.body.appendChild(box);
    const done = (v: 'local' | 'cloud'): void => {
      box.remove();
      resolve(v);
    };
    box.querySelector('#pick-cloud')?.addEventListener('click', () => done('cloud'));
    box.querySelector('#pick-local')?.addEventListener('click', () => done('local'));
  });
}

/** 게임을 시작하기 전에 부른다. 로그인 복귀 처리, 서버 저장 내려받기, 충돌 선택까지 끝낸다. */
export async function boot(notice: (msg: string) => void): Promise<void> {
  onNotice = notice;
  const err = takeHashSession();
  if (err) notice(`로그인에 실패했어요: ${err}`);
  if (!session) session = readJson<Session>(AUTH_KEY);
  if (!session) return;
  await ensureFresh();
  if (!session) return;
  const row = await fetchRow();
  if (row === 'error') {
    lastError = '서버에 연결하지 못했어요. 이 기기 저장으로 시작해요.';
    return;
  }
  const raw = ls()?.getItem(SAVE_KEY) ?? null;
  let local: Record<string, unknown> | null = null;
  try {
    local = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    local = null;
  }
  if (!row) return; // 서버가 비었으면 시작 후 올린다
  if (!local) {
    ls()?.setItem(SAVE_KEY, JSON.stringify(row.data));
    writeJson(META_KEY, { uid: session.uid, syncedAt: Number(row.saved_at) } satisfies Meta);
    notice('서버 저장을 불러왔어요.');
    return;
  }
  const mine = lastSyncedAt();
  if (mine !== null && mine >= Number(row.saved_at)) return; // 이 기기가 더 새롭다
  const pick = await choose(local, row);
  if (pick === 'cloud') {
    ls()?.setItem(SAVE_KEY, JSON.stringify(row.data));
    writeJson(META_KEY, { uid: session.uid, syncedAt: Number(row.saved_at) } satisfies Meta);
  } else {
    // 이 기기 저장을 쓰기로 했으니, 서버 쪽 최신 시각까지 따라잡은 것으로 하고 덮어쓴다
    writeJson(META_KEY, { uid: session.uid, syncedAt: Number(row.saved_at) } satisfies Meta);
    await push(true);
  }
}

/** 게임이 도는 동안 주기적으로 올린다 */
export function startSync(): void {
  if (!session) return;
  void push();
  setInterval(() => void push(), 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void push();
  });
}
