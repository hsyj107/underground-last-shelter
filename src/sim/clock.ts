import { DAY_MS } from './data';
import { endDay } from './engine';
import type { Game, LogEntry, Rng } from './types';

export { DAY_MS };
/** 접속하지 않은 동안 한 번에 계산해 주는 최대 일수 */
export const MAX_CATCHUP_DAYS = 6;
/** 이 시간 이상 화면이 멈춰 있었으면 '자리를 비운 것'으로 본다 */
const AWAY_GAP_MS = 60_000;

export interface TickResult {
  days: number;
  entries: LogEntry[];
  /** 상한에 걸려 일부 시간이 버려졌는지 */
  capped: boolean;
  /** 자리를 비운 동안 흐른 시간인지 */
  away: boolean;
}

/** 다음 날까지 남은 시간(ms) */
export function msToNextDay(g: Game, now: number): number {
  return Math.max(0, g.clock.dayMs - (now - g.clock.last + g.clock.carry));
}

/**
 * 시간이 흐른 만큼 하루 정산을 자동으로 돌린다.
 * - 결정이 필요한 사안(pending)이 있으면 시계가 멈춘다.
 * - 자리를 비운 동안의 날은 '방관'으로 치지 않는다.
 */
export function tick(g: Game, now: number, rng: Rng = Math.random): TickResult {
  const out: TickResult = { days: 0, entries: [], capped: false, away: false };
  if (g.pending) {
    g.clock.last = now;
    g.clock.carry = 0;
    return out;
  }
  const gap = now - g.clock.last;
  if (gap < 0) {
    g.clock.last = now;
    return out;
  }
  out.away = gap > AWAY_GAP_MS;
  const elapsed = gap + g.clock.carry;
  let n = Math.floor(elapsed / g.clock.dayMs);
  if (n > MAX_CATCHUP_DAYS) {
    n = MAX_CATCHUP_DAYS;
    out.capped = true;
    g.clock.carry = 0;
  } else {
    g.clock.carry = elapsed - n * g.clock.dayMs;
  }
  g.clock.last = now;
  for (let i = 0; i < n; i++) {
    if (g.pending) {
      g.clock.carry = 0;
      break;
    }
    if (out.away) g.touched = true;
    out.entries.push(...endDay(g, rng).entries);
    out.days += 1;
  }
  return out;
}
