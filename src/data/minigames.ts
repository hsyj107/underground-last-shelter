import type { FacilityType } from '../types';

/** 미니게임 방식 */
export type MinigameKind = 'timing' | 'sequence' | 'targets' | 'pairs';

export interface MinigameDef {
  kind: MinigameKind;
  title: string;
  /** 하는 방법 안내 */
  help: string;
  /** 난이도 숫자 (방식마다 쓰는 값이 다르다. game/minigames/mechanics.ts 참고) */
  params: Record<string, number>;
  /** 화면에 쓰는 낱말 (과녁 이름, 카드 이름 등) */
  labels: string[];
}

/**
 * 시설별 미니게임. 그 층의 생존자가 부탁하는 일이고, 성공해야 동료가 되어 층이 확보된다.
 * ⚠ 난이도 숫자는 시험용 값이다. 해 보고 조절한다.
 */
export const MINIGAMES: Record<FacilityType, MinigameDef> = {
  power_plant: {
    kind: 'timing',
    title: '발전기 시동',
    help: '바늘이 초록 칸에 왔을 때 화면을 누르세요.\n3번 맞히면 발전기가 돌아갑니다. 기회는 3번.',
    params: { hits: 3, lives: 3, speed: 240, zone: 90 },
    labels: [],
  },
  water_purifier: {
    kind: 'sequence',
    title: '밸브 열기',
    help: '밸브에 불이 들어오는 순서를 잘 보고,\n같은 순서로 누르세요. 2단계를 통과하면 성공.',
    params: { start: 3, rounds: 2 },
    labels: ['밸브 1', '밸브 2', '밸브 3', '밸브 4'],
  },
  farm: {
    kind: 'targets',
    title: '해충 잡기',
    help: '작물에 나타나는 해충을 눌러 잡으세요.\n20초 안에 10마리를 잡으면 성공.',
    params: { goal: 10, seconds: 20, stay: 950 },
    labels: ['해충'],
  },
  dormitory: {
    kind: 'pairs',
    title: '물자 정리',
    help: '카드를 뒤집어 같은 물자끼리 짝을 맞추세요.\n45초 안에 모두 맞추면 성공.',
    params: { pairs: 4, seconds: 45 },
    labels: ['담요', '통조림', '물통', '손전등'],
  },
  medical: {
    kind: 'pairs',
    title: '약품 분류',
    help: '카드를 뒤집어 같은 약품끼리 짝을 맞추세요.\n60초 안에 모두 맞추면 성공.',
    params: { pairs: 6, seconds: 60 },
    labels: ['붕대', '소독약', '진통제', '주사기', '항생제', '거즈'],
  },
  workshop: {
    kind: 'targets',
    title: '철판 용접',
    help: '달궈진 자리가 식기 전에 눌러 두드리세요.\n20초 안에 14번 두드리면 성공.',
    params: { goal: 14, seconds: 20, stay: 750 },
    labels: ['달궈짐'],
  },
  laboratory: {
    kind: 'sequence',
    title: '시료 기록',
    help: '시료가 반응하는 순서를 잘 보고,\n같은 순서로 누르세요. 3단계를 통과하면 성공.',
    params: { start: 3, rounds: 3 },
    labels: ['시료 가', '시료 나', '시료 다', '시료 라'],
  },
  armory: {
    kind: 'timing',
    title: '사격 시험',
    help: '조준선이 초록 표적에 들어왔을 때 화면을 누르세요.\n4발 맞히면 합격. 기회는 3번.',
    params: { hits: 4, lives: 3, speed: 330, zone: 70 },
    labels: [],
  },
};
