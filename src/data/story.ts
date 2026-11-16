import type { SurvivorProfile } from '../types';

/** 대화 한 줄. who: 나(메인 캐릭터) / 상대 생존자 / 해설 */
export interface StoryLine {
  who: 'player' | 'npc' | 'narration';
  text: string;
}

/** 한 층의 이야기: 그 층에서 만나는 생존자와 첫 만남 */
export interface FloorStory {
  /** 1부터 시작하는 지하 층 번호 (data/facilities.ts 의 floor 와 같다) */
  floor: number;
  survivor: SurvivorProfile;
  /** 처음 만났을 때의 대화 */
  encounter: StoryLine[];
  /** 동료가 되기 전에 하는 부탁 (이 말 뒤에 그 시설의 미니게임이 시작된다. data/minigames.ts) */
  request: string;
  /** 층을 확보한 뒤 나오는 안내 (튜토리얼) */
  secured: string;
  /** 확보한 뒤 들렀을 때 건네는 말 */
  lines: string[];
}

/** 게임을 처음 시작했을 때 */
export const INTRO: StoryLine[] = [
  { who: 'narration', text: '사태 37일째. 지상은 더 이상 사람이 살 곳이 아니다.' },
  { who: 'narration', text: '쫓기듯 달리다, 무너진 건물 아래에서 낡은 벙커의 입구를 찾았다.' },
  { who: 'player', text: '…전기도, 물도 끊겼군. 그런데 안쪽에서 무슨 소리가 난다.' },
  { who: 'narration', text: '지하 1층 발전실을 눌러 안으로 들어가 보세요.' },
];

/**
 * 층별 이야기. 위층부터 한 층씩, 그 층에 숨어 있던 생존자를 만나 동료로 맞이하면 층이 확보된다.
 * 인물은 그 층 시설의 성격에 맞춰 만들었다. (이름·대사는 자유롭게 고칠 수 있다)
 */
export const STORY: FloorStory[] = [
  {
    floor: 1,
    survivor: {
      id: 's1', name: '한도윤', job: 'engineer', facility: 'power_plant', sprite: 'c_beard',
      trait: '기계하고만 말이 통하는 정비공',
    },
    encounter: [
      { who: 'npc', text: '거기 서! …사람이야? 물린 데는 없고?' },
      { who: 'player', text: '멀쩡해. 지상에서 겨우 도망쳐 내려왔어.' },
      { who: 'npc', text: '한도윤. 발전소에서 이십 년 정비만 했지. 이 고물 발전기를 살리던 중이었어.' },
      { who: 'npc', text: '혼자선 손이 모자라. 당신이 사람들을 모아 주면, 난 이 녀석을 책임지고 돌리지.' },
      { who: 'player', text: '좋아. 여기서부터 다시 시작하자.' },
    ],
    request: '그럼 손부터 빌리지. 바늘이 초록 칸에 올 때 시동 줄을 당겨. 세 번이면 이 녀석이 깨어나.',
    secured: '한도윤이 발전실을 맡았습니다. 시설은 맡은 사람이 있어야 돌아갑니다. 불이 들어오자 아래층에서 물소리가 들립니다.',
    lines: ['이 녀석, 오늘은 기분이 좋군.', '기계는 거짓말을 안 해. 사람보다 낫지.', '연료만 구해 와. 나머진 내가 해.'],
  },
  {
    floor: 2,
    survivor: {
      id: 's2', name: '강태식', job: 'engineer', facility: 'water_purifier', sprite: 'c_strong',
      trait: '말보다 몸이 먼저 나가는 배관공',
    },
    encounter: [
      { who: 'npc', text: '거기 누구든 이 밸브 좀 잡아! 놓치면 물이 다 샌다!' },
      { who: 'player', text: '잡았어! …이제 됐나?' },
      { who: 'npc', text: '후, 살았다. 강태식이야. 배관 일만 십오 년 했지. 위에 불 들어오니까 펌프가 돌기 시작하더라고.' },
      { who: 'npc', text: '사흘째 빗물만 받아 마셨어. 이 정수 탱크만 살리면 다 같이 깨끗한 물을 마실 수 있어.' },
      { who: 'player', text: '그럼 정수실은 당신한테 맡길게.' },
    ],
    request: '그 전에 밸브부터 순서대로 열어야 해. 내가 여는 순서 잘 보고 그대로 따라 해!',
    secured: '강태식이 정수실을 맡았습니다. 물은 모든 생존자가 매일 소비합니다. 더 아래에서 흙냄새와 풀냄새가 올라옵니다.',
    lines: ['수압 정상! 오늘도 물맛 끝내줄 거야.', '새는 데 있으면 바로 불러. 뛰어갈게.', '필터는 내가 매일 닦아. 걱정 마.'],
  },
  {
    floor: 3,
    survivor: {
      id: 's3', name: '박민재', job: 'farmer', facility: 'farm', sprite: 'c_glasses',
      trait: '작물마다 이름을 붙이는 농대 연구원',
    },
    encounter: [
      { who: 'npc', text: '쉿! 문 살살 닫아요. 애들이 놀라요.' },
      { who: 'player', text: '…애들?' },
      { who: 'npc', text: '상추요. 얘는 초록이, 쟤는 버티기. 아, 저는 박민재예요. 농대에서 수경재배를 연구했어요.' },
      { who: 'npc', text: '물이랑 전기만 있으면 여기서 열 명은 먹일 수 있어요. 진짜예요.' },
      { who: 'player', text: '믿어 볼게. 재배실은 네 거야.' },
    ],
    request: '아, 그런데 큰일이에요. 해충이 생겼어요! 애들이 다 먹히기 전에 같이 잡아 주세요.',
    secured: '박민재가 식량 재배실을 맡았습니다. 식량·물·전력이 벙커를 지탱하는 기본 자원입니다. 아래층에서 맛있는 냄새가 납니다.',
    lines: ['버티기가 새잎을 냈어요! 보셨어요?', '이번 주에는 수확할 수 있겠어요.', '조명을 조금만 더 달아 주시면 안 될까요?'],
  },
  {
    floor: 4,
    survivor: {
      id: 's4', name: '마동수', job: 'caretaker', facility: 'dormitory', sprite: 'c_big',
      trait: '누구든 일단 먹이고 재우는 기사식당 사장',
    },
    encounter: [
      { who: 'npc', text: '어이구, 사람이네! 밥은 먹었어? 얼굴이 반쪽이야.' },
      { who: 'player', text: '…며칠째 제대로 못 먹었어.' },
      { who: 'npc', text: '앉아, 앉아. 마동수라고, 기사식당을 이십 년 했어. 통조림 하나로도 한 상 차리는 사람이야.' },
      { who: 'npc', text: '사람은 배부르고 등 따셔야 버텨. 침대는 내가 다 정리해 놨으니까 사람만 데려와.' },
      { who: 'player', text: '숙소는 사장님이 맡아 줘. 든든하네.' },
    ],
    request: '마침 잘 왔네. 창고 물자가 뒤죽박죽이야. 같은 것끼리 짝 좀 맞춰 줘.',
    secured: '마동수가 숙소를 맡았습니다. 숙소가 있어야 더 많은 생존자를 받을 수 있습니다. 아래층에서 약 냄새가 납니다.',
    lines: ['밥은 먹고 다니는 거지?', '이불 새로 털어 놨어. 좀 자고 가.', '다들 잠은 잘 자. 내가 지켜보고 있어.'],
  },
  {
    floor: 5,
    survivor: {
      id: 's5', name: '최하은', job: 'medic', facility: 'medical', sprite: 'c_woman1',
      trait: '차갑게 말하고 따뜻하게 돌보는 응급실 간호사',
    },
    encounter: [
      { who: 'npc', text: '멈춰요. 손부터 보여 줘요. 물린 자국, 긁힌 자국 다.' },
      { who: 'player', text: '없어. 직접 확인해 봐.' },
      { who: 'npc', text: '…깨끗하네요. 최하은이에요. 응급실에서 일했어요. 그날 밤 이후로 여기서 약품을 지키고 있었고요.' },
      { who: 'npc', text: '약은 넉넉하지 않아요. 그래도 다치는 사람이 생기면 여기로 데려와요. 살릴 수 있는 사람은 살릴 테니까.' },
      { who: 'player', text: '의무실은 당신이 맡아 줘. 부탁할게.' },
    ],
    request: '그 전에 일손 좀 빌릴게요. 쏟아진 약품을 같은 것끼리 분류해 줘요. 서둘러요.',
    secured: '최하은이 의무실을 맡았습니다. 다치거나 아픈 생존자는 의무실에서 회복합니다. 아래층에서 쇠 두드리는 소리가 납니다.',
    lines: ['어디 다친 데는 없죠? 숨기지 말고요.', '환자는 없어요. 다행이죠.', '잠 좀 자요. 그게 제일 좋은 약이에요.'],
  },
  {
    floor: 6,
    survivor: {
      id: 's6', name: '고철민', job: 'mechanic', facility: 'workshop', sprite: 'c_bald',
      trait: '못 고치는 게 없다고 큰소리치는 용접공',
    },
    encounter: [
      { who: 'npc', text: '잠깐, 불꽃 튄다! 눈 가려!' },
      { who: 'player', text: '…뭘 만드는 거야?' },
      { who: 'npc', text: '문짝. 고철민이야. 철공소 했지. 저 위 녀석들 못 들어오게 철판을 덧대는 중이야.' },
      { who: 'npc', text: '고철이랑 부품만 갖다 줘. 발전기든 정수기든, 내 손 거치면 새것보다 낫다니까.' },
      { who: 'player', text: '작업장은 당신 거야. 실컷 두드려.' },
    ],
    request: '말만 하지 말고 망치 들어. 달궈진 데가 식기 전에 두드려야 붙는다고.',
    secured: '고철민이 작업장을 맡았습니다. 작업장에서는 철과 부품으로 시설을 고치고 강화합니다. 아래층에서 유리병 부딪치는 소리가 납니다.',
    lines: ['고철만 있으면 뭐든 만들어 주지.', '이건 새것보다 낫다니까. 진짜야.', '부품이 더 필요해. 밖에 나가면 좀 챙겨 와.'],
  },
  {
    floor: 7,
    survivor: {
      id: 's7', name: '윤석호', job: 'researcher', facility: 'laboratory', sprite: 'c_elder',
      trait: '답을 찾기 전에는 잠들지 않는 노교수',
    },
    encounter: [
      { who: 'npc', text: '문 닫게. 샘플 온도가 올라가.' },
      { who: 'player', text: '여기서 혼자 뭘 하고 계신 겁니까?' },
      { who: 'npc', text: '윤석호일세. 감염병을 삼십 년 연구했지. 저것들이 왜 저렇게 됐는지, 누군가는 알아내야 하지 않겠나.' },
      { who: 'npc', text: '시간과 재료만 있으면 되네. 원인을 알면 막을 방법도 나오는 법이야.' },
      { who: 'player', text: '연구실은 박사님께 맡기겠습니다.' },
    ],
    request: '마침 조수가 필요했네. 시료가 반응하는 순서를 그대로 기록해 주게.',
    secured: '윤석호가 연구실을 맡았습니다. 연구실에서는 새로운 기술과 감염의 단서를 연구합니다. 가장 아래층에서 금속성 소리가 납니다.',
    lines: ['조금만 더 하면 뭔가 나올 것 같네.', '자네, 밖에서 샘플 좀 구해 올 수 있겠나?', '잠은 나중에 자도 되네. 답이 먼저야.'],
  },
  {
    floor: 8,
    survivor: {
      id: 's8', name: '이서진', job: 'guard', facility: 'armory', sprite: 'c_woman2',
      trait: '농담은 안 해도 약속은 지키는 전직 부사관',
    },
    encounter: [
      { who: 'npc', text: '움직이지 마. 손은 보이는 데 두고.' },
      { who: 'player', text: '싸우러 온 게 아니야. 위층은 전부 우리가 확보했어.' },
      { who: 'npc', text: '…발소리가 여럿이더니, 그랬군. 이서진. 부사관이었다. 부대는 첫 주에 무너졌고, 나는 이 무기고를 지켰다.' },
      { who: 'npc', text: '총은 지킬 사람이 있어야 의미가 있지. 당신들이 그럴 만한 사람들인지 계속 지켜보겠어.' },
      { who: 'player', text: '무기고는 그대로 맡아 줘. 이제 같은 편이야.' },
    ],
    request: '그 전에 확인할 게 있어. 표적이 조준선에 들어올 때 쏴. 네 발 맞히면 인정하지.',
    secured: '이서진이 무기고를 맡았습니다. 벙커의 모든 층을 확보했습니다. 이제 지상 탐사를 준비할 수 있습니다.',
    lines: ['이상 없음.', '탄약은 아껴 써. 한 발이 한 목숨이야.', '입구는 내가 본다. 당신은 사람들을 챙겨.'],
  },
];
