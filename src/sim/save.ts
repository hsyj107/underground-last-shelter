import type { Game, RunRecord } from './types';

/**
 * 저장·불러오기.
 * ⚠ 임시: 이 기기의 브라우저에만 저장한다. 서버(Supabase) 저장과 검증은 이후 단계에서 붙인다.
 * 처음부터 다시 하려면 주소 끝에 ?reset 을 붙여서 연다.
 */
const SAVE_KEY = 'uls.save.v5';
const HISTORY_KEY = 'uls.history.v1';

export function loadGame(): Game | null {
  try {
    if (new URLSearchParams(window.location.search).has('reset')) {
      window.localStorage.removeItem(SAVE_KEY);
      return null;
    }
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Game;
    return g.version === 5 ? g : null;
  } catch {
    return null;
  }
}

export function saveGame(g: Game): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(g));
  } catch {
    // 저장 실패는 무시한다 (게임 진행은 계속).
  }
}

export function clearGame(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // 무시
  }
}

export function loadHistory(): RunRecord[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch {
    return [];
  }
}

export function pushHistory(record: RunRecord): void {
  try {
    const list = loadHistory();
    list.unshift(record);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // 무시
  }
}
