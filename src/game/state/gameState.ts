import { EXPEDITION_AREAS, type ExpeditionArea } from '../../data/expeditions';
import { FACILITIES } from '../../data/facilities';
import {
  FACILITY_SLOTS, MAX_FACILITY_LEVEL, UNLOCK_RULES, survivorCapacity, upgradeCost, xpToNext,
} from '../../data/progression';
import { NAMED_SURVIVORS, makeNormalSurvivor } from '../../data/survivorPool';
import type { FacilityType, PlayerProfile, ResourceStock, SurvivorProfile } from '../../types';

/**
 * 게임 진행 상태와 규칙.
 * ⚠ 임시: 지금은 이 기기의 브라우저에만 저장하고, 계산도 브라우저에서 한다.
 * 6단계(Supabase)에서 서버 저장 + 서버 검증으로 교체한다. (지금은 조작을 막지 못한다)
 * 처음부터 다시 하려면 주소 끝에 ?reset 을 붙여서 연다.
 */
export interface GameState {
  version: 2;
  profile: PlayerProfile | null;
  level: number;
  xp: number;
  resources: ResourceStock;
  /** 시설 레벨. 0 이면 아직 개방하지 않은 것 */
  facilityLevels: Record<FacilityType, number>;
  survivors: SurvivorProfile[];
  /** 진행 중인 탐험 (없으면 null). endsAt 은 끝나는 시각(ms) */
  expedition: { areaId: string; endsAt: number } | null;
  /** 지역별 탐험 완료 횟수 */
  cleared: Record<string, number>;
  /** 일반 생존자 id 를 만들 때 쓰는 번호 */
  nextId: number;
}

const KEY = 'uls.save.v2';

function freshState(): GameState {
  const facilityLevels = {} as Record<FacilityType, number>;
  for (const f of FACILITIES) facilityLevels[f.type] = 0;
  return {
    version: 2,
    profile: null,
    level: 1,
    xp: 0,
    // 시작 자원 (시험용 값)
    resources: { food: 100, water: 100, power: 0, iron: 60, parts: 0, fuel: 0 },
    facilityLevels,
    survivors: [],
    expedition: null,
    cleared: {},
    nextId: 1,
  };
}

function load(): GameState {
  try {
    if (new URLSearchParams(window.location.search).has('reset')) {
      window.localStorage.removeItem(KEY);
      return freshState();
    }
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return freshState();
    const saved = JSON.parse(raw) as Partial<GameState>;
    if (saved.version !== 2) return freshState();
    // 나중에 항목이 늘어도 예전 저장이 깨지지 않게 기본값 위에 덮어쓴다.
    const base = freshState();
    return {
      ...base,
      ...saved,
      resources: { ...base.resources, ...saved.resources },
      facilityLevels: { ...base.facilityLevels, ...saved.facilityLevels },
    } as GameState;
  } catch {
    return freshState();
  }
}

/** 현재 게임 상태 (하나뿐) */
export const game: GameState = load();

export function saveGame(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    // 저장 실패는 무시한다 (게임 진행은 계속).
  }
}

// ───────── 조회 ─────────

export const capacity = (): number => survivorCapacity(game.facilityLevels.dormitory);

export const workersIn = (type: FacilityType): SurvivorProfile[] => game.survivors.filter((s) => s.facility === type);

/** 시설 상태: 잠김 / 개방했지만 맡은 사람 없음 / 가동 중 */
export function facilityStatus(type: FacilityType): 'locked' | 'idle' | 'active' {
  if (game.facilityLevels[type] <= 0) return 'locked';
  return workersIn(type).length > 0 ? 'active' : 'idle';
}

export interface Condition {
  text: string;
  met: boolean;
}

export const facilityName = (type: FacilityType): string => FACILITIES.find((f) => f.type === type)?.name ?? type;

/** 시설 개방 조건 목록 (충족 여부 포함) */
export function unlockConditions(type: FacilityType): Condition[] {
  const rule = UNLOCK_RULES[type];
  const list: Condition[] = [{ text: `대장 Lv.${rule.playerLevel}`, met: game.level >= rule.playerLevel }];
  if (rule.prev) {
    list.push({
      text: `${facilityName(rule.prev.type)} Lv.${rule.prev.level}`,
      met: game.facilityLevels[rule.prev.type] >= rule.prev.level,
    });
  }
  if (rule.iron > 0) list.push({ text: `철 ${rule.iron}`, met: game.resources.iron >= rule.iron });
  return list;
}

export const canUnlock = (type: FacilityType): boolean =>
  game.facilityLevels[type] === 0 && unlockConditions(type).every((c) => c.met);

export function canUpgrade(type: FacilityType): boolean {
  const level = game.facilityLevels[type];
  return level > 0 && level < MAX_FACILITY_LEVEL && game.resources.iron >= upgradeCost(level);
}

export const currentArea = (): ExpeditionArea | undefined =>
  EXPEDITION_AREAS.find((a) => a.id === game.expedition?.areaId);

/** 탐험이 끝나기까지 남은 시간(초). 진행 중이 아니면 0 */
export const expeditionSecondsLeft = (now: number = Date.now()): number =>
  game.expedition ? Math.max(0, Math.ceil((game.expedition.endsAt - now) / 1000)) : 0;

// ───────── 행동 ─────────

export function createProfile(profile: PlayerProfile): void {
  game.profile = profile;
  saveGame();
}

/** 조건을 확인하고 시설을 개방한다. 성공하면 true */
export function unlockFacility(type: FacilityType): boolean {
  if (!canUnlock(type)) return false;
  game.resources.iron -= UNLOCK_RULES[type].iron;
  game.facilityLevels[type] = 1;
  saveGame();
  return true;
}

export function upgradeFacility(type: FacilityType): boolean {
  if (!canUpgrade(type)) return false;
  game.resources.iron -= upgradeCost(game.facilityLevels[type]);
  game.facilityLevels[type] += 1;
  saveGame();
  return true;
}

/** 생존자를 시설에 배치한다 (type 이 null 이면 대기로 돌린다). 자리가 차 있으면 기존 인원은 대기로 간다. */
export function assignSurvivor(survivorId: string, type: FacilityType | null): boolean {
  const survivor = game.survivors.find((s) => s.id === survivorId);
  if (!survivor) return false;
  if (type) {
    if (game.facilityLevels[type] <= 0) return false;
    const others = workersIn(type).filter((s) => s.id !== survivorId);
    while (others.length >= FACILITY_SLOTS) {
      const out = others.shift();
      if (out) out.facility = null;
    }
  }
  survivor.facility = type;
  saveGame();
  return true;
}

export function startExpedition(areaId: string, now: number = Date.now()): boolean {
  const area = EXPEDITION_AREAS.find((a) => a.id === areaId);
  if (!area || game.expedition || game.level < area.playerLevel) return false;
  game.expedition = { areaId, endsAt: now + area.seconds * 1000 };
  saveGame();
  return true;
}

export interface ExpeditionResult {
  area: ExpeditionArea;
  iron: number;
  food: number;
  water: number;
  xp: number;
  /** 이번에 오른 레벨 수 */
  levelUps: number;
  /** 구해 온 생존자 (없으면 null) */
  survivor: SurvivorProfile | null;
  /** 네임드 생존자의 사연 */
  rescue: string | null;
  /** 생존자를 만났지만 자리가 없어 데려오지 못했는지 */
  full: boolean;
}

/** 끝난 탐험의 결과를 받는다. 아직 안 끝났거나 탐험 중이 아니면 null */
export function claimExpedition(now: number = Date.now(), rng: () => number = Math.random): ExpeditionResult | null {
  const area = currentArea();
  if (!area || !game.expedition || now < game.expedition.endsAt) return null;

  const roll = ([min, max]: [number, number]): number => min + Math.floor(rng() * (max - min + 1));
  const result: ExpeditionResult = {
    area, iron: roll(area.iron), food: roll(area.food), water: roll(area.water), xp: area.xp,
    levelUps: 0, survivor: null, rescue: null, full: false,
  };
  game.resources.iron += result.iron;
  game.resources.food += result.food;
  game.resources.water += result.water;

  game.xp += result.xp;
  while (game.xp >= xpToNext(game.level)) {
    game.xp -= xpToNext(game.level);
    game.level += 1;
    result.levelUps += 1;
  }

  // 생존자: 이 지역의 아직 못 만난 네임드를 먼저 (첫 탐험은 반드시, 이후 35%), 아니면 확률로 일반 생존자
  const firstClear = (game.cleared[area.id] ?? 0) === 0;
  const waiting = NAMED_SURVIVORS.filter(
    (n) => n.area === area.id && !game.survivors.some((s) => s.id === n.profile.id),
  );
  let found: SurvivorProfile | null = null;
  let rescue: string | null = null;
  if (waiting.length > 0 && (firstClear || rng() < 0.35)) {
    found = { ...waiting[0].profile };
    rescue = waiting[0].rescue;
  } else if (rng() < area.survivorChance) {
    found = makeNormalSurvivor(`s${game.nextId}`, rng);
  }
  if (found) {
    if (game.survivors.length >= capacity()) {
      result.full = true;
    } else {
      if (!found.named) game.nextId += 1;
      game.survivors.push(found);
      result.survivor = found;
      result.rescue = rescue;
    }
  }

  game.cleared[area.id] = (game.cleared[area.id] ?? 0) + 1;
  game.expedition = null;
  saveGame();
  return result;
}
