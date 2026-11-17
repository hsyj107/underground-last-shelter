import type { FacilityId, Job, Stock, Survivor } from './types';

/**
 * 게임 규칙 데이터.
 * ⚠ 모든 숫자는 시험용 값이다. 직접 해 보면서 조절한다.
 */

export const JOB_LABEL: Record<Job, string> = {
  engineer: '기술자', medic: '의무병', farmer: '농업 전문가', scout: '정찰병', guard: '경비병',
  caretaker: '살림꾼', mechanic: '기계공', researcher: '연구원', laborer: '일용직',
};

export interface FacilityDef {
  id: FacilityId;
  name: string;
  floor: number;
  desc: string;
  /** 하루 생산량 (맡은 사람이 있을 때, Lv.1 기준) */
  produce: Partial<Stock>;
  /** 하루 가동 비용 */
  upkeep: Partial<Stock>;
  /** 시설 고유 효과 설명 */
  effect: string;
  /** 개방 조건 (null 이면 처음부터 열려 있다) */
  unlock: { command: number; prev?: { id: FacilityId; level: number }; scrap: number } | null;
}

export const FACILITY_DEFS: FacilityDef[] = [
  {
    id: 'power_plant', name: '발전실', floor: 1, desc: '벙커 전체에 전력을 공급하는 낡은 발전기.',
    produce: { power: 32 }, upkeep: {}, effect: '전력 생산', unlock: null,
  },
  {
    id: 'water_purifier', name: '정수실', floor: 2, desc: '오염된 물을 걸러 식수로 만드는 정수 시설.',
    produce: { water: 20 }, upkeep: { power: 10 }, effect: '식수 생산', unlock: null,
  },
  {
    id: 'farm', name: '식량 재배실', floor: 3, desc: '인공 조명 아래 수경 재배로 식량을 얻는 방.',
    produce: { food: 18 }, upkeep: { power: 8, water: 4 }, effect: '식량 생산', unlock: null,
  },
  {
    id: 'dormitory', name: '숙소', floor: 4, desc: '생존자들이 잠드는 공간. 수용 인원과 스트레스 회복을 결정한다.',
    produce: {}, upkeep: {}, effect: '수용 인원 +2/Lv · 담당자가 있으면 전원 스트레스 회복', unlock: null,
  },
  {
    id: 'medical', name: '의무실', floor: 5, desc: '부상자와 환자를 치료한다. 약품을 소모한다.',
    produce: {}, upkeep: { power: 6 }, effect: '치료 (환자 하루 Lv×2명, 의약품 1개씩 소모)',
    unlock: { command: 2, prev: { id: 'dormitory', level: 2 }, scrap: 80 },
  },
  {
    id: 'workshop', name: '작업실', floor: 6, desc: '고철을 재활용하고 장비를 고치는 작업 공간.',
    produce: { scrap: 8 }, upkeep: { power: 8 }, effect: '고철 생산 · 원정 전리품 +15%/Lv',
    unlock: { command: 3, prev: { id: 'power_plant', level: 2 }, scrap: 150 },
  },
  {
    id: 'laboratory', name: '연구실', floor: 7, desc: '시료를 분석하고 약품을 합성한다.',
    produce: { medicine: 3 }, upkeep: { power: 10 }, effect: '의약품 생산 · 원정 위험도 정밀 분석 · 세럼 확보 성공률 증가',
    unlock: { command: 4, prev: { id: 'medical', level: 2 }, scrap: 250 },
  },
  {
    id: 'armory', name: '무기고', floor: 8, desc: '무기와 탄약을 보관·정비한다. 벙커의 방어선.',
    produce: {}, upkeep: { power: 6 }, effect: '원정 사망 확률 -8%/Lv',
    unlock: { command: 5, prev: { id: 'workshop', level: 2 }, scrap: 300 },
  },
];

export const MAX_FACILITY_LEVEL = 5;
export const upgradeCost = (level: number): number => 60 * level;
export const xpToNext = (level: number): number => 50 * level;
export const bedCapacity = (dormLevel: number): number => 4 + 2 * dormLevel;

/** 하루 1인 기본 배급량 */
export const RATION_BASE = 2;

export interface PolicyDef {
  id: 'equal' | 'merit' | 'emergency';
  name: string;
  brief: string;
  detail: string;
}

export const POLICIES: PolicyDef[] = [
  { id: 'equal', name: '평등 분배', brief: '안정적 / 소모 빠름', detail: '모두 같은 양을 받습니다. 불만은 적지만 식량과 물이 가장 빨리 줄어듭니다.' },
  {
    id: 'merit', name: '실적 우선주의', brief: '에이스 우선 / 하위 불만 폭증',
    detail: '네임드와 숙련자는 25% 더, 숙련도 낮은 인원은 40% 덜 받습니다. 부족할 땐 에이스부터 먹습니다. 하위 인원의 스트레스와 이탈 위험이 커집니다.',
  },
  {
    id: 'emergency', name: '전시 비상 배급', brief: '소모 최소 / 면역·충성도 낙하',
    detail: '전원 절반만 배급합니다. 자원은 아끼지만 체력이 서서히 깎이고, 병에 걸릴 확률과 스트레스가 오르고 충성도가 떨어집니다.',
  },
];

export interface AreaDef {
  id: string;
  name: string;
  desc: string;
  /** 필요한 지휘 레벨 */
  command: number;
  days: number;
  /** 위험도 0~100 */
  danger: number;
  loot: Partial<Record<keyof Stock, [number, number]>>;
  /** 생존자를 만날 확률 */
  recruit: number;
  /** 이 지역에서 만날 수 있는 네임드 id */
  named: string[];
}

export const AREAS: AreaDef[] = [
  {
    id: 'outskirts', name: '폐허가 된 주택가', desc: '벙커 입구 주변. 비교적 조용하다.', command: 1, days: 1, danger: 20,
    loot: { food: [8, 18], water: [8, 18], scrap: [20, 40] }, recruit: 0.3, named: ['n_park'],
  },
  {
    id: 'market', name: '버려진 시장', desc: '먹을 것이 남아 있지만 놈들도 많다.', command: 2, days: 2, danger: 35,
    loot: { food: [20, 40], water: [10, 25], scrap: [20, 45] }, recruit: 0.35, named: ['n_kang', 'n_ma'],
  },
  {
    id: 'hospital', name: '시립 병원', desc: '약품과 사람을 찾을 수 있지만, 안쪽은 장담할 수 없다.', command: 4, days: 2, danger: 50,
    loot: { medicine: [6, 14], water: [10, 20], scrap: [20, 40] }, recruit: 0.35, named: ['n_yun'],
  },
  {
    id: 'factory', name: '공단 지대', desc: '고철과 부품이 널려 있다. 길이 좁고 시야가 나쁘다.', command: 6, days: 3, danger: 55,
    loot: { scrap: [90, 160], food: [10, 25] }, recruit: 0.3, named: ['n_go'],
  },
  {
    id: 'checkpoint', name: '군 검문소', desc: '무너진 방어선. 가장 위험하지만 쓸 만한 장비와 생존자가 남아 있다.', command: 8, days: 3, danger: 75,
    loot: { scrap: [100, 180], medicine: [8, 18], food: [20, 40] }, recruit: 0.4, named: ['n_lee'],
  },
];

type NamedSeed = Omit<Survivor, 'hp' | 'stress' | 'loyalty' | 'status' | 'post' | 'exception' | 'age' | 'joined'>;

/**
 * 실제 시간 → 게임 시간.
 * ⚠ 임시 값: 현실 1시간 = 게임 1일. 주소에 ?dayms=30000 처럼 붙이면 시험용으로 바꿀 수 있다.
 */
export const DAY_MS = 3_600_000;
/** 게임 안의 1년 (일) */
export const YEAR_DAYS = 365;

/** 네임드 생존자의 나이 (⚠ 임시) */
const NAMED_AGE: Record<string, number> = {
  n_han: 52, n_choi: 41, n_park: 29, n_kang: 38, n_ma: 45, n_yun: 68, n_go: 57, n_lee: 31,
};

/** 처음부터 함께하는 네임드 2명 */
export const STARTING_NAMED: NamedSeed[] = [
  {
    id: 'n_han', name: '한도윤', sprite: 'c_beard', named: true, job: 'engineer', skill: 4,
    trait: '기계하고만 말이 통하는 정비공',
    story: '발전소에서 이십 년 정비만 했다. 사태 이후 이 벙커의 발전기를 혼자 살려 놓았다. 사람보다 기계를 믿는다.',
    last: '발전기 소리가 멎으면 그때가 끝입니다. 연료 게이지는 늘 확인하세요.',
  },
  {
    id: 'n_choi', name: '최하은', sprite: 'c_woman1', named: true, job: 'medic', skill: 5,
    trait: '차갑게 말하고 따뜻하게 돌보는 응급실 간호사',
    story: '응급실에서 일하던 간호사. 그날 밤 이후로 이 벙커의 유일한 의료 인력이다. 살릴 사람과 못 살릴 사람을 구분하는 일에 지쳐 있다.',
    last: '약품 목록은 두 번째 서랍입니다. 마지막 한 알은 제일 어린 사람에게 주세요.',
  },
];

/** 원정에서 만날 수 있는 네임드 */
export const RECRUIT_NAMED: Record<string, NamedSeed & { rescue: string }> = {
  n_park: {
    id: 'n_park', name: '박민재', sprite: 'c_glasses', named: true, job: 'farmer', skill: 4,
    trait: '작물마다 이름을 붙이는 농대 연구원',
    story: '농대에서 수경재배를 연구했다. 옥상 텃밭의 상추를 끝까지 지키던 중에 발견됐다.',
    rescue: '옥상 텃밭의 상추를 지키고 있던 청년. "얘는 초록이, 쟤는 버티기예요. 같이 데려가도 되죠?"',
    last: '버티기한테 물 주는 거, 잊지 말아 주세요.',
  },
  n_kang: {
    id: 'n_kang', name: '강태식', sprite: 'c_strong', named: true, job: 'engineer', skill: 4,
    trait: '말보다 몸이 먼저 나가는 배관공',
    story: '배관 일만 십오 년. 터진 수도관을 맨손으로 막고 있다가 발견됐다.',
    rescue: '터진 수도관을 맨손으로 막고 있던 남자. "밸브 좀 잡아 줘! …후, 살았다."',
    last: '수압 게이지 빨간 선 넘기지 마세요. 터집니다.',
  },
  n_ma: {
    id: 'n_ma', name: '마동수', sprite: 'c_big', named: true, job: 'caretaker', skill: 3,
    trait: '누구든 일단 먹이고 재우는 기사식당 사장',
    story: '기사식당을 이십 년 했다. 셔터 내린 식당에서 사람들을 먹이고 있었다.',
    rescue: '셔터 내린 식당에서 사람들을 먹이고 있던 사장. "밥은 먹었어? 얼굴이 반쪽이야."',
    last: '다들 밥은 챙겨 먹여요. 사람은 배가 불러야 버팁니다.',
  },
  n_yun: {
    id: 'n_yun', name: '윤석호', sprite: 'c_elder', named: true, job: 'researcher', skill: 5,
    trait: '답을 찾기 전에는 잠들지 않는 노교수',
    story: '감염병을 삼십 년 연구한 교수. 병원 지하 검사실에서 시료를 들여다보고 있었다.',
    rescue: '지하 검사실에서 시료를 들여다보던 노교수. "저것들이 왜 저렇게 됐는지, 누군가는 알아내야 하지 않겠나."',
    last: '내 노트는 세 번째 칸에 있네. 결론은… 아직 못 냈지만.',
  },
  n_go: {
    id: 'n_go', name: '고철민', sprite: 'c_bald', named: true, job: 'mechanic', skill: 4,
    trait: '못 고치는 게 없다고 큰소리치는 용접공',
    story: '철공소 사장. 문에 철판을 덧대고 있던 중에 발견됐다.',
    rescue: '철공소 문에 철판을 덧대던 용접공. "고철만 있으면 뭐든 만들어 주지."',
    last: '이건 새것보다 낫다니까… 끝까지 내 말 안 믿더니.',
  },
  n_lee: {
    id: 'n_lee', name: '이서진', sprite: 'c_woman2', named: true, job: 'guard', skill: 5,
    trait: '농담은 안 해도 약속은 지키는 전직 부사관',
    story: '부대는 첫 주에 무너졌고, 혼자 검문소를 지켰다. 쉽게 믿지 않는다.',
    rescue: '무너진 검문소를 끝까지 지키던 부사관. "부대는 첫 주에 무너졌다. …당신들이 지킬 만한 사람들인지 지켜보겠어."',
    last: '입구는 제가 지켰습니다. 이제부터는 당신 몫입니다.',
  },
};

const FAMILY = ['김', '이', '박', '최', '정', '조', '윤', '장', '임', '오', '신', '권', '한', '송', '배', '홍'];
const GIVEN = ['지훈', '서연', '민수', '하늘', '도현', '수아', '준호', '예린', '상우', '미정', '태윤', '은지', '현우', '소라', '재민', '다은', '성민', '유진'];
const NORMAL_JOBS: Job[] = ['engineer', 'farmer', 'scout', 'guard', 'caretaker', 'mechanic', 'laborer', 'medic', 'researcher'];
const SPRITES = ['c_hijab', 'c_woman2', 'c_man_red', 'c_strong', 'c_big', 'c_beard', 'c_glasses', 'c_bald'];

/**
 * 직업별로 있을 법한 사람만 나오게 하는 틀.
 * 나이대와 숙련도 쏠림, 그리고 "성격 + 직업" 식의 한 줄 소개에 쓰는 말들.
 */
interface JobProfile {
  age: [number, number];
  /** 숙련도 가중치 (1~5 순서). 합이 클수록 그 숙련도가 잘 나온다 */
  skill: [number, number, number, number, number];
  traits: string[];
  /** 직업 앞에 붙는 설명 */
  noun: string;
}

const JOB_PROFILE: Record<Job, JobProfile> = {
  engineer: { age: [26, 55], skill: [3, 5, 4, 1, 0], noun: '엔지니어', traits: ['꼼꼼한', '말수가 적은', '고집이 센', '손재주가 좋은', '계산이 빠른'] },
  medic: { age: [27, 58], skill: [3, 4, 3, 1, 0], noun: '의료 종사자', traits: ['침착한', '손이 떨리는 편인', '피를 봐도 담담한', '잠을 못 자는', '다정한'] },
  farmer: { age: [24, 62], skill: [3, 5, 3, 1, 0], noun: '농사꾼', traits: ['느긋한', '날씨를 잘 아는', '아침형인', '땅을 아끼는', '묵묵한'] },
  scout: { age: [19, 38], skill: [4, 5, 2, 1, 0], noun: '정찰병', traits: ['눈치가 빠른', '겁이 많지만 빠른', '발소리가 없는', '혼자 다니길 좋아하는', '낙천적인'] },
  guard: { age: [22, 48], skill: [3, 4, 3, 1, 0], noun: '경비병', traits: ['과묵한', '규율을 중시하는', '체력이 좋은', '의심이 많은', '충직한'] },
  caretaker: { age: [30, 64], skill: [4, 5, 2, 1, 0], noun: '살림꾼', traits: ['잔소리가 많은', '넉살 좋은', '아이를 잘 달래는', '아끼는 데 익숙한', '정이 많은'] },
  mechanic: { age: [25, 56], skill: [3, 5, 3, 1, 0], noun: '기계공', traits: ['기름때 묻은', '농담이 많은', '못 고치면 잠을 못 자는', '성미 급한', '꾸준한'] },
  researcher: { age: [28, 62], skill: [4, 4, 3, 1, 0], noun: '연구원', traits: ['호기심 많은', '사람보다 자료를 믿는', '메모가 습관인', '예민한', '말이 많은'] },
  laborer: { age: [20, 58], skill: [6, 4, 1, 0, 0], noun: '일용직', traits: ['성실한', '몸이 튼튼한', '시키는 건 하는', '요령 있는', '입이 거친'] },
};

const pick = <T,>(list: T[], rng: () => number): T => list[Math.floor(rng() * list.length)];

function weighted(weights: number[], rng: () => number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

const lookInt = (rng: () => number): number => Math.floor(rng() * 1000);

/** 일반 생존자를 한 명 만든다. 직업에 맞는 나이·숙련도·소개가 나온다. */
export function makeNormal(id: string, rng: () => number, job?: Job, day = 1): Survivor {
  const j = job ?? pick(NORMAL_JOBS, rng);
  const prof = JOB_PROFILE[j];
  const age = prof.age[0] + Math.floor(rng() * (prof.age[1] - prof.age[0] + 1));
  // 나이가 많을수록 숙련도가 약간 오르고, 아주 어리면 내려간다
  const w = prof.skill.map((v, i) => (age >= 45 ? v * (1 + i * 0.15) : age <= 24 ? v * (1 - i * 0.1) : v));
  const skill = 1 + weighted(w, rng);
  return {
    id,
    name: pick(FAMILY, rng) + pick(GIVEN, rng),
    sprite: pick(SPRITES, rng),
    named: false,
    job: j,
    trait: `${pick(prof.traits, rng)} ${prof.noun}`,
    skill,
    hp: 100,
    stress: 10 + Math.floor(rng() * 15),
    loyalty: 55 + Math.floor(rng() * 20),
    status: 'ok',
    post: null,
    exception: null,
    age,
    joined: day,
    look: {
      body: lookInt(rng), hair: lookInt(rng), outfit: lookInt(rng), acc: lookInt(rng),
      skin: lookInt(rng), hairColor: lookInt(rng), height: Math.floor(rng() * 100),
    },
  };
}

export function fromSeed(seed: NamedSeed, day = 1): Survivor {
  return {
    ...seed, hp: 100, stress: 15, loyalty: 70, status: 'ok', post: null, exception: null,
    age: NAMED_AGE[seed.id] ?? 35, joined: day,
  };
}

// ───────── 유언 (사망 일지) ─────────

const LAST_GENERIC = [
  '…보급이 끊겼습니다. 다들 버텨 주세요.',
  '제 몫의 배급은 다른 사람에게 돌려 주세요.',
  '기록 남깁니다. 저는 최선을 다했습니다.',
  '사령관님, 이 벙커의 불이 계속 켜져 있기를 바랍니다.',
  '살려 달라고 하지 않겠습니다. 대신 기억해 주세요.',
  '…문을 열어 둘걸 그랬어요.',
];

const LAST_BY_CAUSE: Record<string, string[]> = {
  아사: ['마지막으로 먹은 게 언제였더라…', '배급표를 보니 제 이름이 맨 끝이더군요.'],
  탈수: ['물… 한 모금이면 됐을 텐데.', '입안이 모래 같습니다. 정수기는 아직 돌아가나요?'],
  질병: ['열이 내리질 않네요. 약이 있었다면…', '기침이 멎질 않습니다. 옆 사람에게 옮기지 않았으면 좋겠습니다.'],
  '원정 중 실종': ['돌아가지 못할 것 같습니다. 교신 종료.', '여긴 너무 조용합니다. 이상할 만큼.'],
  '치명적 질병': ['제 자리는 신참에게 맡기세요.', '알고 있었습니다. 약이 없다는 걸.'],
  '부상 악화': ['생각보다 깊었나 봅니다. 붕대가 다 젖었어요.'],
  쇠약: ['몸이 더는 말을 안 듣습니다.'],
  폭동: ['…이럴 줄은 몰랐습니다.'],
};

export function lastWords(s: Survivor, cause: string, rng: () => number): string {
  if (s.named && s.last && cause !== '원정 중 실종') return s.last;
  const pool = [...(LAST_BY_CAUSE[cause] ?? []), ...LAST_GENERIC];
  return pick(pool, rng);
}

// ───────── 사령관 ─────────

export interface BackgroundDef {
  name: string;
  desc: string;
  command: number;
  logistics: number;
  analysis: number;
}

export const BACKGROUNDS: BackgroundDef[] = [
  { name: '군 병참장교', desc: '물자 흐름에 밝다. 배분이 강하고 분석이 약하다.', command: 6, logistics: 7, analysis: 3 },
  { name: '관제센터 운영관', desc: '사람을 움직이는 데 익숙하다. 지휘가 강하다.', command: 7, logistics: 4, analysis: 5 },
  { name: '보안 시스템 분석가', desc: '정보를 읽는 눈이 좋다. 위험 판단이 정확하고 지휘가 약하다.', command: 3, logistics: 5, analysis: 8 },
];

export interface TitleDef {
  name: string;
  desc: string;
  consumption: number;
  production: number;
  stress: number;
  loot: number;
  loyalty: number;
  /** 패시브 설명 */
  passive: string;
}

const T = (name: string, desc: string, p: Partial<TitleDef>, passive: string): TitleDef => ({
  name, desc, consumption: 1, production: 1, stress: 1, loot: 1, loyalty: 0, passive, ...p,
});

export const TITLES: Record<string, TitleDef> = {
  '신임 관리자': T('신임 관리자', '아직 성향이 판독되지 않았다.', {}, '없음'),
  '철혈의 독재자': T('철혈의 독재자', '효율을 위해서라면 누구든 소모한다.', { production: 1.15, stress: 1.35 }, '생산 +15% / 스트레스 증가 +35%'),
  '냉혈한': T('냉혈한', '필요하다면 냉정하게 잘라 낸다.', { production: 1.05, stress: 1.2 }, '생산 +5% / 스트레스 증가 +20%'),
  '비정한 회계사': T('비정한 회계사', '모든 것을 장부로 환산한다.', { loot: 1.12, consumption: 0.95, stress: 1.1 }, '전리품 +12% / 소비 -5% / 스트레스 증가 +10%'),
  '노련한 여우': T('노련한 여우', '손실을 최소화하는 데 능하다.', { loot: 1.08, consumption: 0.97 }, '전리품 +8% / 소비 -3%'),
  '위태로운 성자': T('위태로운 성자', '모두를 살리려다 곳간이 바닥난다.', { consumption: 1.12, stress: 0.8, loyalty: 1 }, '소비 +12% / 스트레스 증가 -20% / 충성도 +1/일'),
  '방관자': T('방관자', '명령이 없다. 벙커는 스스로 굴러가고 있다.', { stress: 1.25 }, '스트레스 증가 +25%'),
};
