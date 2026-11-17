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

/** 기분에 영향을 주는 생각. value > 0 이면 좋은 일, < 0 이면 나쁜 일. until 일까지 유지된다 */
export interface Thought {
  id: string;
  text: string;
  value: number;
  until: number;
  /** 그날의 상황에서 매일 새로 만들어지는 생각 (조건이 사라지면 바로 없어진다) */
  sit?: boolean;
}

export type BodyPart = 'head' | 'torso' | 'arm_l' | 'arm_r' | 'leg_l' | 'leg_r';
/** wound: 아직 낫는 중 / scar: 흉터(후유증) / lost: 결손 / prosthetic: 의수·의족 */
export type WoundKind = 'wound' | 'scar' | 'lost' | 'prosthetic';
export interface Wound {
  part: BodyPart;
  kind: WoundKind;
  /** wound 가 낫는 날 */
  until?: number;
}

/**
 * 얼굴·몸 파츠 조합용 난수 값. 숫자는 그냥 큰 정수이고, 화면에서 가진 파츠 개수로 나눈 나머지를 쓴다.
 * 그림이 늘어도 기존 생존자의 모습이 크게 바뀌지 않고, 시뮬은 그림 파일을 몰라도 된다.
 */
export interface Look {
  body: number;
  hair: number;
  outfit: number;
  acc: number;
  /** 피부 / 머리색 팔레트 번호 */
  skin: number;
  hairColor: number;
  /** 키 보정 (0~99 → 화면에서 0.94~1.06배) */
  height: number;
}

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
  /** 지금 기분에 작용하는 생각들 */
  thoughts: Thought[];
  /** 다른 생존자와의 호감도 (-100~100) */
  bonds: Record<string, number>;
  /** 시설별 일 선호도: 1(가장 하고 싶음) ~ 4, 0 = 맡기지 않음 */
  prio: Partial<Record<FacilityId, number>>;
  /** true 이면 우선순위 표대로 자동 배치 */
  auto: boolean;
  /** 부위별 부상과 후유증 */
  wounds: Wound[];
  /** 정신 붕괴 중이면 그 종류와 끝나는 날 */
  breakKind?: string;
  breakUntil?: number;
  /** 일반 생존자의 외형 값 (네임드는 고정 그림을 쓰므로 없다) */
  look?: Look;
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
export type EventKind = 'raid' | 'trader' | 'wanderer' | 'quarrel';
export type Pending =
  | { kind: 'serum'; aceId: string }
  | { kind: 'event'; event: EventKind; data: Record<string, number | string> };

/** 이야기꾼의 상태: 다음 사건 시점과 최근 사건 */
export interface StoryState {
  next: number;
  recent: { day: number; kind: string }[];
}

export interface Game {
  version: 5;
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
  /** 유물 도감: 붕괴해도 남는다. id → 처음 찾은 날, 찾은 횟수 */
  codex: Record<string, { first: number; count: number }>;
  pending: Pending | null;
  story: StoryState;
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
