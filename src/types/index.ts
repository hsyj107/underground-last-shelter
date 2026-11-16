export type ResourceType = 'food' | 'water' | 'power' | 'iron' | 'parts' | 'fuel';

export type ResourceStock = Record<ResourceType, number>;

export type MenuId = 'bunker' | 'expedition' | 'survivors' | 'world' | 'shop';

export type FacilityType =
  | 'power_plant'
  | 'water_purifier'
  | 'farm'
  | 'dormitory'
  | 'medical'
  | 'workshop'
  | 'laboratory'
  | 'armory';

/** 벙커 화면 상단에 표시되는 요약 정보 */
export interface BunkerSummary {
  /** 왼쪽 정보칸에 표시할 글 (예: "민수 Lv.3"). 없으면 "벙커 Lv.N" */
  title?: string;
  level: number;
  survivors: number;
  survivorCapacity: number;
  /** 0~100 */
  stability: number;
  resources: ResourceStock;
}

export interface ResourceDef {
  type: ResourceType;
  label: string;
  /** 초기 UI에 표시할지 여부 (부품/연료는 관련 기능이 열릴 때 표시) */
  visible: boolean;
  iconKey: string;
}

export interface MenuItem {
  id: MenuId;
  label: string;
  iconKey: string;
  /** 실제 기능이 구현될 개발 단계 (준비 중 화면에 표시) */
  plannedStage?: number;
}

export interface FacilityDef {
  type: FacilityType;
  name: string;
  /** 1부터 시작하는 지하 층 번호 */
  floor: number;
  /** 같은 층 안에서의 왼쪽→오른쪽 순서 */
  slot: number;
  /** 임시 표시 색상 (픽셀 아트로 교체되면 사용하지 않음) */
  color: number;
}

export type JobType =
  | 'engineer'
  | 'medic'
  | 'farmer'
  | 'scout'
  | 'guard'
  | 'caretaker'
  | 'mechanic'
  | 'researcher';

/** 생존자 한 명의 정보 */
export interface SurvivorProfile {
  id: string;
  name: string;
  job: JobType;
  /** 배치된 시설. 아직 배치하지 않았으면 null (대기 중) */
  facility: FacilityType | null;
  /** 캐릭터 그림 키 (assetManifest 의 CHARACTER_KEYS) */
  sprite: string;
  /** 한 줄 성격 소개 */
  trait: string;
  /** 이름과 사연이 있는 특별한 생존자인지 (아니면 일반 생존자) */
  named: boolean;
  /** 잘 맞는 시설 (네임드 생존자). 효과는 이후 단계에서 연결한다. */
  best?: FacilityType;
  /** 대장이 들렀을 때 건네는 말 */
  lines?: string[];
}

/** 내 메인 캐릭터 설정 */
export interface PlayerProfile {
  nickname: string;
  gender: 'male' | 'female';
  age: 'young' | 'middle' | 'senior';
}
