import type { JobType, SurvivorProfile } from '../types';

/** 네임드 생존자: 이름·사연·개성이 있고, 정해진 탐험 지역에서 구해 올 수 있다. */
export interface NamedSurvivor {
  profile: SurvivorProfile;
  /** 만날 수 있는 탐험 지역 id (data/expeditions.ts) */
  area: string;
  /** 구했을 때 나오는 사연 */
  rescue: string;
}

const named = (
  id: string, name: string, job: JobType, sprite: string, best: SurvivorProfile['best'], trait: string, lines: string[],
): SurvivorProfile => ({ id, name, job, sprite, trait, best, lines, named: true, facility: null });

export const NAMED_SURVIVORS: NamedSurvivor[] = [
  {
    area: 'outskirts',
    rescue: '무너진 변전소에서 혼자 발전기를 고치던 남자. "기계는 거짓말을 안 해. 당신들 벙커에 발전기가 있다고?"',
    profile: named('n_handoyun', '한도윤', 'engineer', 'c_beard', 'power_plant', '기계하고만 말이 통하는 정비공',
      ['이 녀석, 오늘은 기분이 좋군.', '기계는 거짓말을 안 해. 사람보다 낫지.', '연료만 구해 와. 나머진 내가 해.']),
  },
  {
    area: 'outskirts',
    rescue: '옥상 텃밭의 상추를 지키고 있던 청년. "얘는 초록이, 쟤는 버티기예요. 같이 데려가도 되죠?"',
    profile: named('n_parkminjae', '박민재', 'farmer', 'c_glasses', 'farm', '작물마다 이름을 붙이는 농대 연구원',
      ['버티기가 새잎을 냈어요! 보셨어요?', '물이랑 빛만 있으면 열 명은 먹여요.', '조명을 조금만 더 달아 주시면 안 될까요?']),
  },
  {
    area: 'market',
    rescue: '터진 수도관을 맨손으로 막고 있던 남자. "밸브 좀 잡아 줘! …후, 살았다. 배관 일만 십오 년 했지."',
    profile: named('n_kangtaesik', '강태식', 'engineer', 'c_strong', 'water_purifier', '말보다 몸이 먼저 나가는 배관공',
      ['수압 정상! 오늘도 물맛 끝내줄 거야.', '새는 데 있으면 바로 불러. 뛰어갈게.', '필터는 내가 매일 닦아. 걱정 마.']),
  },
  {
    area: 'market',
    rescue: '셔터 내린 식당에서 사람들을 먹이고 있던 사장. "밥은 먹었어? 얼굴이 반쪽이야. 일단 앉아."',
    profile: named('n_madongsu', '마동수', 'caretaker', 'c_big', 'dormitory', '누구든 일단 먹이고 재우는 기사식당 사장',
      ['밥은 먹고 다니는 거지?', '이불 새로 털어 놨어. 좀 자고 가.', '사람은 배부르고 등 따셔야 버텨.']),
  },
  {
    area: 'hospital',
    rescue: '약품 창고를 혼자 지키던 간호사. "멈춰요. 손부터 보여 줘요. …깨끗하네요. 같이 가죠."',
    profile: named('n_choihaeun', '최하은', 'medic', 'c_woman1', 'medical', '차갑게 말하고 따뜻하게 돌보는 응급실 간호사',
      ['어디 다친 데는 없죠? 숨기지 말고요.', '환자는 없어요. 다행이죠.', '잠 좀 자요. 그게 제일 좋은 약이에요.']),
  },
  {
    area: 'hospital',
    rescue: '지하 검사실에서 시료를 들여다보던 노교수. "저것들이 왜 저렇게 됐는지, 누군가는 알아내야 하지 않겠나."',
    profile: named('n_yunseokho', '윤석호', 'researcher', 'c_elder', 'laboratory', '답을 찾기 전에는 잠들지 않는 노교수',
      ['조금만 더 하면 뭔가 나올 것 같네.', '자네, 밖에서 시료 좀 구해 올 수 있겠나?', '잠은 나중에 자도 되네. 답이 먼저야.']),
  },
  {
    area: 'factory',
    rescue: '철공소 문에 철판을 덧대던 용접공. "고철만 있으면 뭐든 만들어 주지. 내 손 거치면 새것보다 낫다니까."',
    profile: named('n_gocheolmin', '고철민', 'mechanic', 'c_bald', 'workshop', '못 고치는 게 없다고 큰소리치는 용접공',
      ['고철만 있으면 뭐든 만들어 주지.', '이건 새것보다 낫다니까. 진짜야.', '부품이 더 필요해. 나가면 좀 챙겨 와.']),
  },
  {
    area: 'checkpoint',
    rescue: '무너진 검문소를 끝까지 지키던 부사관. "부대는 첫 주에 무너졌다. …당신들이 지킬 만한 사람들인지 지켜보겠어."',
    profile: named('n_leeseojin', '이서진', 'guard', 'c_woman2', 'armory', '농담은 안 해도 약속은 지키는 전직 부사관',
      ['이상 없음.', '탄약은 아껴 써. 한 발이 한 목숨이야.', '입구는 내가 본다. 당신은 사람들을 챙겨.']),
  },
];

/** 일반 생존자가 건네는 말 */
export const NORMAL_LINES: string[] = [
  '별일 없습니다, 대장.', '맡은 일은 하고 있어요.', '밖은 좀 어떤가요?', '여기라도 있어서 다행이에요.', '더 도울 일 있으면 말해 주세요.',
];

const FAMILY = ['김', '이', '박', '최', '정', '조', '윤', '장', '임', '오', '신', '권'];
const GIVEN = ['지훈', '서연', '민수', '하늘', '도현', '수아', '준호', '예린', '상우', '미정', '태윤', '은지', '현우', '소라'];
const TRAITS = ['손이 빠른 편', '겁은 많지만 성실함', '말수가 적음', '눈치가 빠름', '체력이 좋음', '꼼꼼한 성격', '낙천적임', '잠이 많음'];
const JOBS_POOL: JobType[] = ['engineer', 'medic', 'farmer', 'scout', 'guard', 'caretaker', 'mechanic'];
const SPRITES = ['c_hijab', 'c_woman1', 'c_woman2', 'c_bald', 'c_strong', 'c_big', 'c_beard', 'c_glasses', 'c_man_red'];

const pick = <T>(list: T[], rng: () => number): T => list[Math.floor(rng() * list.length)];

/** 일반 생존자를 한 명 만든다. */
export function makeNormalSurvivor(id: string, rng: () => number = Math.random): SurvivorProfile {
  return {
    id,
    name: pick(FAMILY, rng) + pick(GIVEN, rng),
    job: pick(JOBS_POOL, rng),
    sprite: pick(SPRITES, rng),
    trait: pick(TRAITS, rng),
    named: false,
    facility: null,
  };
}
