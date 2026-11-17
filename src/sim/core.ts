import { bedCapacity } from './data';
import type { FacilityId, Game, LogEntry, LogKind, Survivor } from './types';

/** 어디서나 쓰는 기본 조회와 도우미 (다른 sim 파일들이 서로 얽히지 않게 따로 둔다) */

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const alive = (g: Game): Survivor[] => g.survivors.filter((s) => s.status !== 'dead');
export const atBunker = (g: Game): Survivor[] => g.survivors.filter((s) => s.status !== 'dead' && s.status !== 'away');
export const byId = (g: Game, id: string): Survivor | undefined => g.survivors.find((s) => s.id === id);
export const capacity = (g: Game): number => bedCapacity(g.facilities.dormitory);

/** 정신 붕괴 중이면 일을 못 한다 */
export const inBreak = (g: Game, s: Survivor): boolean => s.breakUntil !== undefined && s.breakUntil >= g.day;
export const canWork = (g: Game, s: Survivor): boolean =>
  (s.status === 'ok' || s.status === 'sick' || s.status === 'injured') && !inBreak(g, s);
export const workersOf = (g: Game, id: FacilityId): Survivor[] => g.survivors.filter((s) => s.post === id && canWork(g, s));

export interface ActionResult {
  ok: boolean;
  message: string;
}

export type Say = (kind: LogKind, text: string) => void;

/** 로그를 남기는 함수를 만든다. entries 를 주면 거기에도 쌓는다 */
export function makeSay(g: Game, entries?: LogEntry[]): Say {
  return (kind, text) => {
    const e: LogEntry = { day: g.day, kind, text };
    entries?.push(e);
    g.log.push(e);
  };
}

export const hash = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** 지금 이 사람이 머무는 방: 맡은 시설이 열려 있으면 거기, 아니면 숙소 */
export const roomOf = (g: Game, s: Survivor): FacilityId => (s.post && g.facilities[s.post] > 0 ? s.post : 'dormitory');
