export type ResKey = 'food' | 'water' | 'power' | 'medicine' | 'scrap';
export const RES_KEYS: ResKey[] = ['food', 'water', 'power', 'medicine', 'scrap'];
export type Stock = Record<ResKey, number>;

export type FacilityId =
  | 'power_plant' | 'water_purifier' | 'farm' | 'dormitory' | 'medical' | 'workshop' | 'laboratory' | 'armory';

export type Job =
  | 'engineer' | 'medic' | 'farmer' | 'scout' | 'guard' | 'caretaker' | 'mechanic' | 'researcher' | 'laborer';

/** 배급 정책 (벙커 전체에 일괄 적용) */
export type RationPolicy = 'equal' | 'merit' | 'emergency';
/** 개인별 예외 처리: 특식 / 배급 제외 */
export type Exception = 'special' | 'withhold' | null;

export type SurvStatus = 'ok' | 'sick' | 'injured' | 'critical' | 'away' | 'dead';

export interface Survivor {
  id: string;
  name: string;
  /** 인사 기록 사진 (public/assets/characters/<sprite>.png) */
  sprite: string;
  /** 이름과 사연이 있는 생존자인지 (아니면 일반 생존자) */
  named: boolean;
  job: Job;
  trait: string;
  /** 숙련도 1~5 */
  skill: number;
  /** 0~100 */
  hp: number;
  stress: number;
  loyalty: number;
  status: SurvStatus;
  /** 배치된 시설 */
  post: FacilityId | null;
  exception: Exception;
  /** 나이(년). 게임 안의 365일마다 1살 */
  age: number;
  /** 정착지에 합류한 날 */
  joined: number;
  /** 네임드: 사연과 유언 */
  story?: string;
  last?: string;
}

export interface Expedition {
  areaId: string;
  members: string[];
  /** 이 날이 되면 돌아온다 */
  returnDay: number;
}

export interface Obituary {
  day: number;
  name: string;
  job: Job;
  named: boolean;
  cause: string;
  last: string;
  age: number;
  /** 정착지에서 보낸 일수 */
  served: number;
  /** 플레이어가 기억하기로 지정한 사람 */
  memorial: boolean;
}

export type LogKind = 'info' | 'good' | 'warn' | 'bad' | 'death';
export interface LogEntry {
  day: number;
  kind: LogKind;
  text: string;
}

/** 사령관 성향 누적 점수 */
export interface Tally {
  ruthless: number;
  mercy: number;
  efficient: number;
  /** 아무 개입 없이 하루를 넘긴 횟수 */
  idleDays: number;
}

export interface Commander {
  nickname: string;
  background: string;
  /** 지휘 통제력 / 자원 배분 효율 / 정보 분석력 */
  command: number;
  logistics: number;
  analysis: number;
  level: number;
  xp: number;
}

/** 플레이어가 결정해야 일이 진행되는 사건 */
export interface Pending {
  kind: 'serum';
  aceId: string;
}

export interface Game {
  version: 4;
  day: number;
  /** 실제 시간 → 게임 시간 (⚠ 임시 값: dayMs) */
  clock: { last: number; carry: number; dayMs: number };
  /** 정착지 연대기: 붕괴와 재건의 기록 */
  chronicle: { day: number; text: string }[];
  collapses: number;
  commander: Commander;
  tally: Tally;
  title: string;
  stock: Stock;
  /** 시설 레벨 (0 = 잠김) */
  facilities: Record<FacilityId, number>;
  survivors: Survivor[];
  policy: RationPolicy;
  expeditions: Expedition[];
  cleared: Record<string, number>;
  pending: Pending | null;
  /** 특수 세럼을 구하러 간 생존자 */
  serum: { survivorId: string; aceId: string; dueDay: number } | null;
  /** 치명적 질병에 걸린 생존자 id → 이 날까지 치료 못 하면 사망 */
  critical: Record<string, number>;
  obituaries: Obituary[];
  log: LogEntry[];
  nextId: number;
  /** 오늘 플레이어가 무언가 조작했는지 (방관자 판정용) */
  touched: boolean;
}

export type Rng = () => number;

export interface RunRecord {
  nickname: string;
  title: string;
  days: number;
  cause: string;
  deaths: number;
  date: string;
}
