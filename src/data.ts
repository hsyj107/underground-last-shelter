// 게임 데이터: 물건, 탐사 구역, 생존자. 규칙(계산)은 state.ts, 그림은 sprites.ts 에 있다.

export type Rarity = 'common' | 'good' | 'rare' | 'legend';
export type Cat = 'food' | 'medical' | 'tech' | 'culture' | 'pet' | 'daily';

export const CAT_ORDER: Cat[] = ['food', 'medical', 'tech', 'culture', 'pet', 'daily'];

export const CATS: Record<Cat, { name: string; icon: string }> = {
  food: { name: '식료품', icon: '🥫' },
  medical: { name: '의약품', icon: '💊' },
  tech: { name: '전자기기', icon: '🔋' },
  culture: { name: '문화', icon: '📚' },
  pet: { name: '반려', icon: '🐾' },
  daily: { name: '생활용품', icon: '🧻' },
};

export const RARITY: Record<Rarity, { name: string; color: string; income: number; sell: number; weight: number }> = {
  common: { name: '흔함', color: '#b8b0a0', income: 1, sell: 4, weight: 10 },
  good: { name: '쓸만함', color: '#7fd18b', income: 2, sell: 10, weight: 5 },
  rare: { name: '희귀', color: '#6cb4ff', income: 4, sell: 30, weight: 1.5 },
  legend: { name: '전설', color: '#ffb84d', income: 12, sell: 100, weight: 0.25 },
};

/** 아이콘 색: m 본체, l 밝은 부분, a 포인트 */
export interface Pal {
  m: string;
  l: string;
  a: string;
}

export interface ItemDef {
  id: string;
  name: string;
  cat: Cat;
  rarity: Rarity;
  shape: string;
  pal: Pal;
  desc: string;
}

const p = (m: string, l: string, a: string): Pal => ({ m, l, a });

export const ITEMS: ItemDef[] = [
  // 식료품
  { id: 'f_tuna', name: '참치 통조림', cat: 'food', rarity: 'common', shape: 'can', pal: p('#4f86b8', '#9cc4e0', '#e04a3c'), desc: '기름이 반쯤 굳었다. 그래도 참치는 참치다.' },
  { id: 'f_peach', name: '황도 통조림', cat: 'food', rarity: 'common', shape: 'can', pal: p('#e8a24a', '#ffd28a', '#e8604a'), desc: '시럽까지 마시는 게 예의.' },
  { id: 'f_beans', name: '콩 통조림', cat: 'food', rarity: 'common', shape: 'can', pal: p('#6a9a4a', '#a8d078', '#d8b04a'), desc: '메뉴 선택권은 없다.' },
  { id: 'f_spam', name: '스팸', cat: 'food', rarity: 'good', shape: 'can', pal: p('#d65a5a', '#f0a0a0', '#e8c04a'), desc: '지하 7층에서도 분홍빛 미래.' },
  { id: 'f_ramen', name: '컵라면', cat: 'food', rarity: 'common', shape: 'cup', pal: p('#e8603c', '#f4a070', '#ffd040'), desc: '뜨거운 물만 있으면 문명이 돌아온다.' },
  { id: 'f_snack', name: '새우과자', cat: 'food', rarity: 'common', shape: 'bag', pal: p('#e8934a', '#ffc080', '#4a9ae0'), desc: '봉지의 공기가 절반이라 더 정이 간다.' },
  { id: 'f_water', name: '생수', cat: 'food', rarity: 'common', shape: 'bottle', pal: p('#7ab8e8', '#c4e4ff', '#3a7ad0'), desc: '이제 제일 비싼 음료.' },
  { id: 'f_cola', name: '탄산음료', cat: 'food', rarity: 'good', shape: 'bottle', pal: p('#7a3a2a', '#b0644a', '#d83a3a'), desc: '김은 빠졌지만 음료는 음료.' },
  { id: 'f_choco', name: '초코바', cat: 'food', rarity: 'common', shape: 'choc', pal: p('#7a4a2a', '#b07a4a', '#d8402a'), desc: '단 게 필요한 날이 있다.' },
  { id: 'f_coffee', name: '믹스커피', cat: 'food', rarity: 'good', shape: 'stick', pal: p('#a8784a', '#d8b080', '#e8e0d0'), desc: '3 in 1. 아침의 마지막 보루.' },
  { id: 'f_cake', name: '케이크 한 조각', cat: 'food', rarity: 'rare', shape: 'cake', pal: p('#d8a068', '#f8f0e0', '#e86a8a'), desc: '유통기한은 아무도 확인하지 않았다.' },
  { id: 'f_gold', name: '황금 황도 세트', cat: 'food', rarity: 'legend', shape: 'can', pal: p('#e0b030', '#fff0a0', '#d84a3a'), desc: "'멸망 기념 한정판' 스티커가 붙어 있다." },
  // 의약품
  { id: 'm_band', name: '붕대', cat: 'medical', rarity: 'common', shape: 'bandage', pal: p('#e8e0d0', '#ffffff', '#d84a4a'), desc: '돌돌 감으면 마음도 조금 낫는다.' },
  { id: 'm_disinf', name: '소독약', cat: 'medical', rarity: 'common', shape: 'bottle', pal: p('#d86a4a', '#f0a888', '#7a3a2a'), desc: '따끔할수록 효과가 좋다는 믿음.' },
  { id: 'm_pain', name: '진통제', cat: 'medical', rarity: 'common', shape: 'pill', pal: p('#e8e0d0', '#ffffff', '#4a8ad8'), desc: '아픈 건 참을 만한데 두통은 못 참겠다.' },
  { id: 'm_vita', name: '비타민', cat: 'medical', rarity: 'good', shape: 'pill', pal: p('#f0a030', '#ffd078', '#d86a1a'), desc: '지하에서 부족한 건 햇빛과 이것.' },
  { id: 'm_kit', name: '구급상자', cat: 'medical', rarity: 'good', shape: 'medkit', pal: p('#e8e0d0', '#ffffff', '#d83a3a'), desc: '뚜껑을 열면 안심이 들어 있다.' },
  { id: 'm_anti', name: '항생제', cat: 'medical', rarity: 'rare', shape: 'pill', pal: p('#4a8ad8', '#9cc4f0', '#f4efe4'), desc: '이게 몇 사람의 목숨값일까.' },
  { id: 'm_serum', name: '미개봉 백신', cat: 'medical', rarity: 'legend', shape: 'pill', pal: p('#48c8a8', '#b0f0e0', '#ffd34d'), desc: '누군가의 희망이 냉장 보관되어 있었다.' },
  // 전자기기
  { id: 't_battery', name: '건전지', cat: 'tech', rarity: 'common', shape: 'battery', pal: p('#c8a030', '#f0d870', '#3a3a3a'), desc: '다 쓴 척하다가 흔들면 한 번 더 된다.' },
  { id: 't_bank', name: '보조배터리', cat: 'tech', rarity: 'good', shape: 'bank', pal: p('#4a5a78', '#8a9ab8', '#5ae08a'), desc: '남은 칸 하나가 오늘의 복권.' },
  { id: 't_light', name: '손전등', cat: 'tech', rarity: 'good', shape: 'flashlight', pal: p('#d8a830', '#f0d070', '#fff4a8'), desc: '어둠 속에서 가장 믿음직한 친구.' },
  { id: 't_radio', name: '작동하는 라디오', cat: 'tech', rarity: 'rare', shape: 'radio', pal: p('#8a5a3a', '#c89060', '#e8d040'), desc: '지지직… 아직 누군가 있다.' },
  { id: 't_walkie', name: '무전기', cat: 'tech', rarity: 'rare', shape: 'walkie', pal: p('#3a4a3a', '#6a8a6a', '#e8d040'), desc: '"여기는 B7. 응답하라."' },
  { id: 't_game', name: '휴대용 게임기', cat: 'tech', rarity: 'rare', shape: 'console', pal: p('#9a9aa8', '#d0d0d8', '#d84a6a'), desc: '저장 파일이 아직 남아 있다. 12시간 전에서 멈춘.' },
  { id: 't_laptop', name: '살아있는 노트북', cat: 'tech', rarity: 'legend', shape: 'laptop', pal: p('#7a8090', '#c0c8d8', '#6ad8f0'), desc: '배터리 4%. 바탕화면은 누군가의 가족사진.' },
  // 문화
  { id: 'c_comic', name: '낡은 만화책', cat: 'culture', rarity: 'common', shape: 'book', pal: p('#d8a040', '#f0d080', '#d84a3a'), desc: '모서리가 닳도록 읽은 흔적.' },
  { id: 'c_mag', name: '주간지', cat: 'culture', rarity: 'common', shape: 'book', pal: p('#6a8ac8', '#a8c0e8', '#e84a8a'), desc: '표지의 "이번 주 운세"가 뼈아프다.' },
  { id: 'c_board', name: '보드게임', cat: 'culture', rarity: 'good', shape: 'box', pal: p('#d84a4a', '#f08888', '#f4efe4'), desc: '말이 몇 개 없어서 단추로 대신한다.' },
  { id: 'c_tape', name: '카세트테이프', cat: 'culture', rarity: 'good', shape: 'tape', pal: p('#8a6ab8', '#c0a8e0', '#e8c04a'), desc: '손으로 쓴 라벨: "겨울 노래 모음".' },
  { id: 'c_album', name: '사진첩', cat: 'culture', rarity: 'rare', shape: 'book', pal: p('#a85a6a', '#d89098', '#ffd34d'), desc: '모르는 사람들의 웃는 얼굴이 가득하다.' },
  { id: 'c_lp', name: 'LP판', cat: 'culture', rarity: 'rare', shape: 'disc', pal: p('#3a3a44', '#6a6a78', '#d84a3a'), desc: '턴테이블만 있으면, 하지만 턴테이블이 없다.' },
  { id: 'c_vol4', name: '만화 전집 4권', cat: 'culture', rarity: 'legend', shape: 'book', pal: p('#e8b030', '#fff0a0', '#d83a3a'), desc: '모두가 3권까지만 가지고 있던 바로 그 책.' },
  // 반려
  { id: 'p_food', name: '고양이 사료', cat: 'pet', rarity: 'common', shape: 'bag', pal: p('#8a6a4a', '#c8a478', '#f4efe4'), desc: '동네 길고양이들의 소문난 맛집.' },
  { id: 'p_can', name: '고양이 캔', cat: 'pet', rarity: 'common', shape: 'can', pal: p('#d86a8a', '#f0a8c0', '#f4efe4'), desc: '사람이 먹으면 안 된다. 알고 있다. 알고 있다고.' },
  { id: 'p_churu', name: '츄르', cat: 'pet', rarity: 'good', shape: 'stick', pal: p('#e8884a', '#ffc088', '#4aa8e0'), desc: '이걸 보면 어디서든 달려온다.' },
  { id: 'p_toy', name: '낚싯대 장난감', cat: 'pet', rarity: 'good', shape: 'ball', pal: p('#e86a6a', '#ffa8a8', '#f4efe4'), desc: '깃털이 한 가닥 남았다.' },
  { id: 'p_collar', name: '방울 목걸이', cat: 'pet', rarity: 'rare', shape: 'ball', pal: p('#e8c040', '#fff0a0', '#d84a4a'), desc: '딸랑. 이 소리가 나면 가게가 따뜻해진다.' },
  // 생활용품
  { id: 'd_roll', name: '두루마리 휴지', cat: 'daily', rarity: 'common', shape: 'roll', pal: p('#f4efe4', '#ffffff', '#c8c0b0'), desc: '지금 시세로 금보다 귀한 날도 있다.' },
  { id: 'd_lighter', name: '라이터', cat: 'daily', rarity: 'common', shape: 'lighter', pal: p('#4a8ac8', '#8ac0f0', '#e8c040'), desc: '불꽃 하나가 방 하나를 데운다.' },
  { id: 'd_blanket', name: '담요', cat: 'daily', rarity: 'good', shape: 'blanket', pal: p('#c85a5a', '#e89898', '#f4efe4'), desc: '체크무늬. 사람을 얌전하게 만드는 무늬.' },
  { id: 'd_clock', name: '멈춘 벽시계', cat: 'daily', rarity: 'rare', shape: 'clock', pal: p('#d8d0c0', '#ffffff', '#3a3a3a'), desc: '언제나 3시 17분. 하루에 두 번은 맞는다.' },
  { id: 'd_key', name: '마스터키', cat: 'daily', rarity: 'legend', shape: 'key', pal: p('#e8c040', '#fff0a0', '#e8c040'), desc: '지하 7층의 모든 문이 이 열쇠 하나에 열린다는 소문.' },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** 선반에는 분류 순서대로 진열된다 */
export const SHELF_ORDER: string[] = CAT_ORDER.flatMap((c) => ITEMS.filter((i) => i.cat === c).map((i) => i.id));

export interface ZoneDef {
  id: string;
  name: string;
  icon: string;
  /** 위험도 1~5 */
  D: number;
  /** 기본 소요 시간(분) */
  minutes: number;
  /** 도감 몇 종을 발견해야 열리는지 */
  unlock: number;
  cats: Partial<Record<Cat, number>>;
  blurb: string;
  lines: string[];
}

export const ZONES: ZoneDef[] = [
  { id: 'mart', name: '동네 슈퍼마트', icon: '🛒', D: 1, minutes: 4, unlock: 0, cats: { food: 10, daily: 5, pet: 4 },
    blurb: '셔터가 반쯤 내려간 동네 마트. 다들 한 번은 털고 간 곳.',
    lines: ['진열대 밑에서 굴러 들어간 물건을 건졌다.', '좀비 두 마리가 졸고 있어서 발끝으로 걸었다.', '계산대 밑 서랍까지 샅샅이 뒤졌다.'] },
  { id: 'pharmacy', name: '24시 약국', icon: '💊', D: 1, minutes: 8, unlock: 5, cats: { medical: 10, daily: 3, food: 2 },
    blurb: '24시간이라더니 정말 불이 꺼진 적이 없다. 간판만.',
    lines: ['약 서랍마다 라벨이 또박또박 붙어 있었다.', '조제실 안쪽에서 의외로 깨끗한 상자를 찾았다.', '쇼케이스 뒤쪽까지 손을 뻗었다.'] },
  { id: 'bookstore', name: '고서당 헌책방', icon: '📖', D: 2, minutes: 15, unlock: 10, cats: { culture: 10, daily: 3, pet: 1 },
    blurb: '종이 냄새가 가득하다. 쌓인 책탑 사이로 뭔가 움직인다.',
    lines: ['책탑이 무너질까 봐 숨을 참고 걸었다.', '먼지 쌓인 서가 뒤에서 상자를 발견했다.', '좀비가 책을 읽는 척 서 있었다. 그냥 지나쳤다.'] },
  { id: 'electro', name: '전자상가', icon: '🔌', D: 3, minutes: 25, unlock: 16, cats: { tech: 10, culture: 2, daily: 2 },
    blurb: '네온 간판이 아직도 한 글자 깜박인다. 좀비도 깜박인다.',
    lines: ['선이 엉킨 진열대에서 쓸 만한 걸 골라냈다.', '셔터 틈으로 기어서 들어갔다.', '전원이 들어오는 물건이 몇 개나 남아 있었다.'] },
  { id: 'hospital', name: '종합병원', icon: '🏥', D: 4, minutes: 40, unlock: 22, cats: { medical: 10, tech: 3, daily: 2 },
    blurb: '로비엔 아직 대기번호가 켜져 있다. 불길한 숫자다.',
    lines: ['약제과 금고를 열 수 있는 방법을 찾았다.', '병동 복도에서 소리 없이 이동했다.', '응급실 카트에서 쓸 만한 물건을 건졌다.'] },
  { id: 'police', name: '경찰서', icon: '🚓', D: 4, minutes: 60, unlock: 28, cats: { tech: 5, daily: 5, medical: 3, culture: 1 },
    blurb: '유치장 문은 안에서 열려 있다. 누가 먼저 나갔는지는 모른다.',
    lines: ['증거물 보관실에서 의외의 물건이 쏟아졌다.', '순찰차 트렁크를 열고 숨을 골랐다.', '당직실 책상 서랍에서 비상용품을 찾았다.'] },
  { id: 'megamart', name: '대형마트 지하', icon: '🏬', D: 5, minutes: 120, unlock: 34, cats: { food: 6, medical: 6, tech: 6, culture: 6, pet: 6, daily: 6 },
    blurb: '카트 소리가 아직 울린다. 그 소리는 사람이 아니다.',
    lines: ['어둠 속에서 카트를 천천히 밀어 진열대를 돌았다.', '창고 가장 안쪽에서 손도 안 댄 팔레트를 발견했다.', '냉동 코너만은 건드리지 않고 지나갔다.'] },
];

export const ZONE_BY_ID: Record<string, ZoneDef> = Object.fromEntries(ZONES.map((z) => [z.id, z]));

// ---------- 생존자 ----------

export type BuffKind = 'store_cat' | 'store_all' | 'exp_guard' | 'exp_luck' | 'exp_loot';

export interface Look {
  skin: string;
  hair: string;
  style: 'short' | 'long' | 'bun' | 'bald' | 'tuft';
  top: string;
  top2: string;
  pants: string;
  shoes: string;
  acc: string[];
  kid?: boolean;
  cat?: boolean;
}

export type Unlock =
  | { type: 'start' }
  | { type: 'found'; n: number }
  | { type: 'cat'; cat: Cat; n: number }
  | { type: 'exp'; n: number }
  | { type: 'item'; id: string }
  | { type: 'crew'; n: number };

export interface SurvDef {
  id: string;
  name: string;
  title: string;
  look: Look;
  /** 매장에 있을 때(store_*) 또는 탐사대에 있을 때(exp_*) 적용 */
  buff: { kind: BuffKind; cat?: Cat; value: number; text: string };
  power: number;
  likes: { items: string[]; cat?: Cat };
  unlock: Unlock;
  hint: string;
  intro: string;
  chapters: [string, string, string];
  chat: string[];
}

export const CHAPTER_AFF = [20, 50, 100];

export const PLAYER: SurvDef = {
  id: 'me',
  name: '점장',
  title: '지하 7층 편의점 점장',
  look: { skin: '#f0c8a0', hair: '#3a2a22', style: 'short', top: '#2f4a6a', top2: '#ff9a3c', pants: '#3a3a4a', shoes: '#2a2a2a', acc: ['vest', 'cap'] },
  buff: { kind: 'store_all', value: 0, text: '점장은 모든 걸 조금씩 한다' },
  power: 1,
  likes: { items: [] },
  unlock: { type: 'start' },
  hint: '',
  intro: '',
  chapters: ['', '', ''],
  chat: ['오늘도 셔터를 올린다.', '선반이 비어 있으면 마음도 비는 법.', '손님이 와야 장사가 되는데…'],
};

export const SURVIVORS: SurvDef[] = [
  {
    id: 'songi', name: '한송이', title: '전직 해장국집 사장',
    look: { skin: '#f0c8a0', hair: '#4a3022', style: 'bun', top: '#d8d0c0', top2: '#f4efe4', pants: '#4a5a6a', shoes: '#5a4a3a', acc: ['chefhat', 'apron'] },
    buff: { kind: 'store_cat', cat: 'food', value: 0.4, text: '매장에 있으면 식료품 수입 +40%' },
    power: 1, likes: { items: ['f_ramen', 'f_coffee'], cat: 'food' },
    unlock: { type: 'start' }, hint: '곧 누군가 문을 두드린다.',
    intro: '"문 좀 열어주세요… 혹시 컵라면 냄새 안 나요? 주방, 아니, 그 구석 좀 써도 될까요?"',
    chapters: [
      '송이네 해장국은 24시간 불이 꺼지지 않던 가게였다. 사태가 터진 날에도 손님 열두 명에게 국밥을 말아줬다고 한다. "다 먹고 나서야 도망갔어요. 배는 안 곯아야죠."',
      '간판은 못 가져왔지만 낡은 국자 하나는 품에 있었다. 선반의 컵라면으로 끓여 준 라면을 한참 말없이 먹더니 중얼거렸다. "…면이 좀 불었는데, 이상하게 제일 맛있네요."',
      '계산대 옆에 작은 취사 코너가 생겼다. 삐뚤빼뚤 쓴 간판은 \'송이네 야식\'. "손님 한 명이라도 오면 열 거예요. 아무도 안 와도 열 거고요."',
    ],
    chat: ['간은 제일 마지막에 보는 거예요.', '오늘 국물은 내가 봐도 잘 나왔네.', '냄새가 나면 사람이 모여요. 그게 제일 좋은 간판이죠.'],
  },
  {
    id: 'hajun', name: '서하준', title: '밤샘 코딩하던 개발자',
    look: { skin: '#f4d4b0', hair: '#2a2a3a', style: 'short', top: '#4a4a5a', top2: '#3a3a48', pants: '#2f3a4a', shoes: '#e8e8e8', acc: ['hood', 'glasses'] },
    buff: { kind: 'store_cat', cat: 'tech', value: 0.4, text: '매장에 있으면 전자기기 수입 +40%' },
    power: 1, likes: { items: ['t_game', 't_laptop'], cat: 'tech' },
    unlock: { type: 'found', n: 6 }, hint: '도감을 6종 채우면 찾아온다.',
    intro: '"저, 저기… 와이파이 있어요? 아, 없구나. 그럼 일단 들어가도 돼요? 아니 들어가겠습니다."',
    chapters: [
      '사태 전날 밤샘 코딩 중이었다. 눈을 떠 보니 세상이 끝나 있었다는 게 본인 설명. "근데 서버는 안 죽었어요. 아직 어딘가에서 돌고 있을걸요."',
      '낡은 계산대를 분해해서 재고 관리 단말기를 만들었다. 선반 물건이 이제 화면에 뜬다. "재고 관리는 제 일이죠. 이것만큼은 자신 있어요."',
      '하준이 새벽마다 무전기로 같은 말을 보낸다. "여기 B7, 불 켜져 있어요." 가끔 지직거리는 잡음 사이로 누군가 대답한다.',
    ],
    chat: ['이거 재부팅하면 다시 켜질까요… 아 이건 계산대구나.', '사람이 서버보다 오래 버티네요.', '로그를 보면 이 가게, 생각보다 잘 돌아가고 있어요.'],
  },
  {
    id: 'chulmin', name: '오철민', title: '은퇴한 특수부대 원사',
    look: { skin: '#e0b088', hair: '#5a5a5a', style: 'short', top: '#5a6a3a', top2: '#4a5a2a', pants: '#4a5a2a', shoes: '#2a2a22', acc: ['beret', 'scar', 'camo'] },
    buff: { kind: 'exp_guard', value: 0.6, text: '탐사대에 있으면 들킬 확률 -60%, 전리품 +1' },
    power: 3, likes: { items: ['f_choco', 't_light'], cat: 'daily' },
    unlock: { type: 'exp', n: 3 }, hint: '탐사를 3번 다녀오면 찾아온다.',
    intro: '"경계 이상 무. 들어가도 되겠나? 문 앞의 좀비 셋은 조용히 처리했다."',
    chapters: [
      '오 원사는 전역 후 동네 경비 일을 하던 중이었다. "평생 지키는 일만 했는데, 지킬 게 없어졌더군." 하지만 매일 밤 편의점 문단속은 그가 한다.',
      '몰래 숨겨 둔 곰 젤리가 들통났다. 얼굴이 빨개진 채 말한다. "…전투식량엔 이런 게 없어서."',
      '신입에게 이것저것 가르치는 걸 은근히 좋아한다. "원칙 하나. 안 죽는다. 원칙 둘. 같이 돌아온다." 탐사대의 구호가 되었다.',
    ],
    chat: ['경계 이상 무.', '신발끈부터 다시 묶고 가라.', '문단속은 제일 중요한 일이다. 제일.'],
  },
  {
    id: 'nabi', name: '나비', title: '길고양이 · 계산대 위의 주인',
    look: { skin: '#e8944a', hair: '#c86a2a', style: 'short', top: '#e8944a', top2: '#c86a2a', pants: '#e8944a', shoes: '#e8944a', acc: [], cat: true },
    buff: { kind: 'exp_luck', value: 0.8, text: '탐사대에 있으면 희귀·전설 발견 확률 +80%' },
    power: 1, likes: { items: ['p_churu', 'p_food'], cat: 'pet' },
    unlock: { type: 'item', id: 'p_food' }, hint: '고양이 사료를 발견하면 냄새를 맡고 온다.',
    intro: '(냐아) 고양이 사료 냄새를 맡고 문 앞에 앉아 있다. 목에는 낡은 방울이 달려 있다.',
    chapters: [
      '나비는 매일 같은 시각에 계산대 위로 올라앉는다. 아무도 시킨 적 없지만 거기가 나비의 출근 자리다.',
      '나비가 가는 곳엔 이상하게 물건이 남아 있다. 몰래 탐사 가방에 들어가 따라간 날, 평소보다 두 배나 많이 가져왔다.',
      '방울 안쪽에 작은 글씨가 새겨져 있다. \'집 잃으면 연락주세요.\' 이제 그 번호를 받을 사람은 없지만, 나비는 집을 잃지 않았다.',
    ],
    chat: ['냐아.', '(골골골)', '(계산대 위에서 느긋하게 기지개를 켠다)'],
  },
  {
    id: 'yuna', name: '정유나', title: '종합병원 야간 간호사',
    look: { skin: '#f4d4b0', hair: '#3a2a2a', style: 'long', top: '#78b8c8', top2: '#5898a8', pants: '#78b8c8', shoes: '#f4efe4', acc: ['nursecap'] },
    buff: { kind: 'store_cat', cat: 'medical', value: 0.4, text: '매장에 있으면 의약품 수입 +40%' },
    power: 1, likes: { items: ['m_vita', 'f_coffee'], cat: 'medical' },
    unlock: { type: 'cat', cat: 'medical', n: 3 }, hint: '의약품을 3종 발견하면 찾아온다.',
    intro: '"다친 사람 있어요? 아니면 제가 먼저 다쳤을지도. 하하, 농담이에요. 들어가도 될까요?"',
    chapters: [
      '야간 근무 중이던 유나는 병동의 환자들을 끝까지 옥상으로 대피시켰다. 마지막 한 명까지. 그 이야기는 거기까지만 한다.',
      '구급상자를 정리하다 말했다. "연고에도 유통기한이 있는데, 마음 달래는 건 유통기한이 없대요." 그리고 점장의 손에 밴드를 붙였다.',
      '편의점 구석에 \'간이 진료소\' 팻말이 생겼다. 환자가 한 명도 안 오는 날이 제일 좋은 날이라고 한다.',
    ],
    chat: ['밥은 먹었어요? 약보다 밥이 먼저예요.', '손 씻었죠? 씻었다고 해 줘요.', '오늘은 다치지 말기로 해요, 우리.'],
  },
  {
    id: 'manbok', name: '박만복', title: '40년차 만화방 주인',
    look: { skin: '#e8c098', hair: '#e8e8e8', style: 'short', top: '#8a6a4a', top2: '#7a5a3a', pants: '#4a4a4a', shoes: '#3a2a22', acc: ['beard', 'cane'] },
    buff: { kind: 'store_cat', cat: 'culture', value: 0.4, text: '매장에 있으면 문화 수입 +40%' },
    power: 1, likes: { items: ['c_vol4', 'c_comic'], cat: 'culture' },
    unlock: { type: 'cat', cat: 'culture', n: 3 }, hint: '문화 물건을 3종 발견하면 찾아온다.',
    intro: '"어허, 문 열어라 이놈들아. …아니, 문 좀 열어 주시오. 내 만화 전집이 여기 있다고 들었소."',
    chapters: [
      '40년간 만화방을 지켰다. 사태가 터지던 날에도 "마지막 권 보고 가야지" 하며 앉아 있었다고 한다.',
      '선반의 낡은 만화책을 보고 눈이 반짝였다. "이건 한 권이 빠졌구먼. 4권이 없어. 에잉." 그날부터 4권 찾는 게 소원이 되었다.',
      '4권을 마침내 읽었다. 할아버지는 한참을 조용히 책장을 넘기다 말했다. "결말이 이랬구먼. 살아서 봤으니 됐다."',
    ],
    chat: ['요즘 애들은 만화를 안 봐서 탈이야.', '이 책은 3권이 제일 재밌소. 4권이 없어서 더.', '자, 한 권 보고 가시오. 공짜요.'],
  },
  {
    id: 'saebyeok', name: '강새벽', title: '심야 라디오 DJ',
    look: { skin: '#e8c098', hair: '#6a3a8a', style: 'long', top: '#3a3a5a', top2: '#e84a8a', pants: '#2a2a3a', shoes: '#e84a8a', acc: ['headphones'] },
    buff: { kind: 'store_all', value: 0.1, text: '매장에 있으면 전체 수입 +10%' },
    power: 1, likes: { items: ['t_radio', 'c_lp', 'c_tape'], cat: 'culture' },
    unlock: { type: 'item', id: 't_radio' }, hint: '작동하는 라디오를 발견하면 찾아온다.',
    intro: '"안녕하세요 B7 청취자 여러분— 아, 청취자가 아직 없구나. 방송 장비부터 찾아야겠어요!"',
    chapters: [
      '새벽 두 시, 방송국 대신 편의점 계산대 뒤에서 마이크를 잡았다. 첫 곡 신청자는 점장.',
      '라디오에 지직거리며 다른 곳의 신호가 잡혔다. "다른 생존자가 있나 봐요! 우리, 혼자가 아니에요."',
      '매일 밤 12시 \'종말 편의점 심야방송\'이 시작된다. 오프닝 멘트는 늘 같다. "오늘도 살아남은 당신, 수고했어요."',
    ],
    chat: ['오늘의 신청곡은 점장님 거예요.', '마이크 체크, 원 투. 청취자 한 분 계시죠?', '새벽엔 모든 노래가 더 좋게 들려요.'],
  },
  {
    id: 'duri', name: '두리', title: '구슬과 병뚜껑을 모으는 아홉 살',
    look: { skin: '#f4d4b0', hair: '#4a2a1a', style: 'tuft', top: '#e8c040', top2: '#d8a830', pants: '#4a78b8', shoes: '#e84a4a', acc: [], kid: true },
    buff: { kind: 'exp_loot', value: 1, text: '탐사대에 있으면 전리품 +1, 처음 발견한 물건의 뚜껑 보너스 2배' },
    power: 1, likes: { items: ['f_choco', 'p_toy', 'f_snack'], cat: 'food' },
    unlock: { type: 'crew', n: 4 }, hint: '생존자가 4명 모이면 누군가 따라온다.',
    intro: '"아저씨! 과자 있어요? 저 주머니에 뚜껑 모아 놨어요. 다섯 개나요!"',
    chapters: [
      '두리는 반짝이는 걸 잘 찾는다. 병뚜껑, 구슬, 가끔은 잃어버린 열쇠. 어른들은 못 보는 구석을 아이는 본다.',
      '두리의 배낭 속엔 사진이 한 장 있다. 아무도 묻지 않았지만 다들 안다. 다음 날부터 어른들은 두리 몫으로 간식을 한 개씩 더 챙긴다.',
      '"나 커서 점장 할래요!" "벌써 점장은 여기 있는데?" "그럼 부점장!" 두리는 오늘도 선반을 정리한다. 가끔은 거꾸로.',
    ],
    chat: ['이거 보세요! 별 모양 뚜껑!', '나 오늘 선반 열 개나 닦았어요!', '밤에 무서우면 고양이랑 자면 돼요.'],
  },
];

export const SURV_BY_ID: Record<string, SurvDef> = Object.fromEntries([PLAYER, ...SURVIVORS].map((s) => [s.id, s]));

// ---------- 개조 ----------

export type UpgKey = 'shelf' | 'pack' | 'radio' | 'gen';

export const UPGRADES: Record<UpgKey, { name: string; icon: string; max: number; base: number; grow: number; text: (lv: number) => string }> = {
  shelf: { name: '선반 확장', icon: '🗄️', max: 12, base: 100, grow: 2.2, text: (lv) => `전체 수입 +${lv * 15}%` },
  pack: { name: '튼튼한 배낭', icon: '🎒', max: 4, base: 300, grow: 3, text: (lv) => `탐사 전리품 +${lv}개` },
  radio: { name: '무전 안테나', icon: '📡', max: 5, base: 400, grow: 2.4, text: (lv) => `탐사 시간 -${lv * 7}% · 방문자 빨라짐` },
  gen: { name: '예비 발전기', icon: '⚡', max: 5, base: 250, grow: 2.4, text: (lv) => `자리 비워도 수입 ${4 + lv * 2}시간까지` },
};
