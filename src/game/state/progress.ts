/**
 * 진행 상황 저장 (확보한 층 수).
 * ⚠ 임시: 지금은 이 기기의 브라우저에만 저장한다. 6단계(Supabase)에서 서버 저장으로 교체한다.
 * 처음부터 다시 보려면 주소 끝에 ?reset 을 붙여서 연다.
 */
const KEY = 'uls.progress.v1';

export function loadSecuredFloors(maxFloors: number): number {
  try {
    if (new URLSearchParams(window.location.search).has('reset')) {
      window.localStorage.removeItem(KEY);
      return 0;
    }
    const value = Number.parseInt(window.localStorage.getItem(KEY) ?? '0', 10);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), maxFloors) : 0;
  } catch {
    // 저장소를 쓸 수 없는 환경이면 매번 처음부터 시작한다.
    return 0;
  }
}

export function saveSecuredFloors(count: number): void {
  try {
    window.localStorage.setItem(KEY, String(count));
  } catch {
    // 저장 실패는 무시한다 (게임 진행은 계속).
  }
}
