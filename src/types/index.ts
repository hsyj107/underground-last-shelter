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
