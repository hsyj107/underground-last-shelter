import { EXTRA_PROFS } from './profs_extra.ts';
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

export type ResKey = 'food' | 'water' | 'med';
export const RES: Record<ResKey, { name: string; icon: string }> = {
  food: { name: '식량', icon: '🍞' },
  water: { name: '식수', icon: '💧' },
  med: { name: '의약품', icon: '💊' },
};

/** 일해 본 분야. 탐사 구역과 겹치면 그 구역을 잘 안다 */
export type Know = 'food' | 'medical' | 'tech' | 'culture' | 'security' | 'retail' | 'office' | 'edu' | 'auto' | 'logistics';
export const KNOW_NAME: Record<Know, string> = {
  food: '식품·조리',
  medical: '의료',
  tech: '전기·기계',
  culture: '책·문화',
  security: '경비·구조',
  retail: '상점·유통',
  office: '사무',
  edu: '교육',
  auto: '차량',
  logistics: '운송',
};

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
  /** 이 구역을 잘 아는 분야. 팀에 이 분야 사람이 있으면 유리하다 */
  know: Know[];
  /** 이 구역에서 가져오는 생존 물자의 범위 */
  supply: Partial<Record<ResKey, [number, number]>>;
  blurb: string;
  lines: string[];
}

export const ZONES: ZoneDef[] = [
  { id: 'mart', name: '동네 슈퍼마트', icon: '🛒', D: 1, minutes: 4, unlock: 0, cats: { food: 10, daily: 5, pet: 4 },
    know: ['retail', 'food', 'logistics'],
    supply: { food: [16, 30], water: [10, 20] },
    blurb: '셔터가 반쯤 내려간 동네 마트. 다들 한 번은 털고 간 곳.',
    lines: ['진열대 밑에서 굴러 들어간 물건을 건졌다.', '좀비 두 마리가 졸고 있어서 발끝으로 걸었다.', '계산대 밑 서랍까지 샅샅이 뒤졌다.'] },
  { id: 'pharmacy', name: '24시 약국', icon: '💊', D: 1, minutes: 8, unlock: 5, cats: { medical: 10, daily: 3, food: 2 },
    know: ['medical', 'retail'],
    supply: { med: [8, 16], water: [6, 12] },
    blurb: '24시간이라더니 정말 불이 꺼진 적이 없다. 간판만.',
    lines: ['약 서랍마다 라벨이 또박또박 붙어 있었다.', '조제실 안쪽에서 의외로 깨끗한 상자를 찾았다.', '쇼케이스 뒤쪽까지 손을 뻗었다.'] },
  { id: 'office', name: '사무실 빌딩', icon: '🏢', D: 2, minutes: 12, unlock: 8, cats: { tech: 5, culture: 4, daily: 5, food: 3 },
    know: ['office', 'tech'],
    supply: { food: [6, 12], water: [8, 14] },
    blurb: '출근 카드를 찍던 층. 책상 위 커피잔이 아직 그 자리에 있다.',
    lines: ['칸막이 사이를 숨죽이고 지나 서랍을 하나씩 열었다.', '탕비실 찬장에서 의외의 보급품을 찾았다.', '서버실 문은 열지 않았다. 안에서 소리가 났다.'] },
  { id: 'bookstore', name: '고서당 헌책방', icon: '📖', D: 2, minutes: 15, unlock: 10, cats: { culture: 10, daily: 3, pet: 1 },
    know: ['culture', 'edu'],
    supply: { food: [4, 8], water: [4, 8] },
    blurb: '종이 냄새가 가득하다. 쌓인 책탑 사이로 뭔가 움직인다.',
    lines: ['책탑이 무너질까 봐 숨을 참고 걸었다.', '먼지 쌓인 서가 뒤에서 상자를 발견했다.', '좀비가 책을 읽는 척 서 있었다. 그냥 지나쳤다.'] },
  { id: 'school', name: '초등학교', icon: '🏫', D: 2, minutes: 18, unlock: 13, cats: { culture: 8, daily: 4, food: 3 },
    know: ['edu', 'culture'],
    supply: { food: [6, 12], water: [6, 12] },
    blurb: '텅 빈 교실에 출석부가 펼쳐져 있다. 마지막 칸은 비어 있다.',
    lines: ['급식실 선반에서 먼지 덮인 상자를 건졌다.', '복도 끝 교무실은 문이 잠겨 있었다. 열쇠는 책상 밑에 있었다.', '아이들 사물함을 열어 보지 않으려 애썼다.'] },
  { id: 'electro', name: '전자상가', icon: '🔌', D: 3, minutes: 25, unlock: 16, cats: { tech: 10, culture: 2, daily: 2 },
    know: ['tech', 'retail'],
    supply: { water: [8, 14], food: [3, 6] },
    blurb: '네온 간판이 아직도 한 글자 깜박인다. 좀비도 깜박인다.',
    lines: ['선이 엉킨 진열대에서 쓸 만한 걸 골라냈다.', '셔터 틈으로 기어서 들어갔다.', '전원이 들어오는 물건이 몇 개나 남아 있었다.'] },
  { id: 'gas', name: '주유소 정비소', icon: '⛽', D: 3, minutes: 30, unlock: 19, cats: { daily: 6, tech: 4, food: 4 },
    know: ['auto', 'logistics', 'tech'],
    supply: { water: [6, 12], food: [6, 12] },
    blurb: '펌프는 멈췄는데 매점 불빛이 가끔 깜박인다. 전기가 어디서 오는지는 모른다.',
    lines: ['정비 리프트 아래에서 쓸 만한 공구 상자를 찾았다.', '매점 냉장고는 열지 않았다. 냄새가 모든 걸 말해 줬다.', '세차장 지붕 위에서 주변을 살폈다.'] },
  { id: 'hospital', name: '종합병원', icon: '🏥', D: 4, minutes: 40, unlock: 22, cats: { medical: 10, tech: 3, daily: 2 },
    know: ['medical'],
    supply: { med: [20, 34], food: [6, 10], water: [6, 10] },
    blurb: '로비엔 아직 대기번호가 켜져 있다. 불길한 숫자다.',
    lines: ['약제과 금고를 열 수 있는 방법을 찾았다.', '병동 복도에서 소리 없이 이동했다.', '응급실 카트에서 쓸 만한 물건을 건졌다.'] },
  { id: 'police', name: '경찰서', icon: '🚓', D: 4, minutes: 60, unlock: 28, cats: { tech: 5, daily: 5, medical: 3, culture: 1 },
    know: ['security'],
    supply: { food: [8, 14], med: [6, 12], water: [6, 12] },
    blurb: '유치장 문은 안에서 열려 있다. 누가 먼저 나갔는지는 모른다.',
    lines: ['증거물 보관실에서 의외의 물건이 쏟아졌다.', '순찰차 트렁크를 열고 숨을 골랐다.', '당직실 책상 서랍에서 비상용품을 찾았다.'] },
  { id: 'megamart', name: '대형마트 지하', icon: '🏬', D: 5, minutes: 120, unlock: 34, cats: { food: 6, medical: 6, tech: 6, culture: 6, pet: 6, daily: 6 },
    know: ['retail', 'logistics', 'food'],
    supply: { food: [40, 70], water: [30, 50], med: [14, 26] },
    blurb: '카트 소리가 아직 울린다. 그 소리는 사람이 아니다.',
    lines: ['어둠 속에서 카트를 천천히 밀어 진열대를 돌았다.', '창고 가장 안쪽에서 손도 안 댄 팔레트를 발견했다.', '냉동 코너만은 건드리지 않고 지나갔다.'] },
];

export const ZONE_BY_ID: Record<string, ZoneDef> = Object.fromEntries(ZONES.map((z) => [z.id, z]));


// ---------- 생존자 ----------

/** 벙커에 있을 때 적용(prod_*, calm, med_yield) 또는 탐사대에 있을 때 적용(exp_*) */
export type BuffKind = 'prod_food' | 'prod_water' | 'prod_all' | 'med_yield' | 'calm' | 'exp_guard' | 'exp_luck' | 'exp_loot';

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
  /** 여성이면 그림에 입술·리본이 붙고, skirt 면 치마를 입는다 */
  f?: boolean;
  skirt?: boolean;
}

export type Unlock =
  | { type: 'start' }
  | { type: 'found'; n: number }
  | { type: 'cat'; cat: Cat; n: number }
  | { type: 'exp'; n: number }
  | { type: 'item'; id: string }
  | { type: 'crew'; n: number };

/** 화면과 규칙이 읽는 생존자 한 명의 모습 (직업 + 개인 정보를 합친 것) */
export interface SurvDef {
  id: string;
  name: string;
  title: string;
  look: Look;
    buff: { kind: BuffKind; cat?: Cat; value: number; text: string };
  power: number;
  likes: { items: string[]; cat?: Cat };
  unlock: Unlock;
  hint: string;
  intro: string;
  chapters: [string, string, string];
  chat: string[];
  prof: string;
  stats: Stats;
  know: Know[];
  gender: Gender;
}

export const CHAPTER_AFF = [20, 50, 100];

/** 능력치: 전투(싸움·버티기), 수색(물건 찾기), 의료(치료), 매력(거래·협상) — 1~10 */
export interface Stats {
  str: number;
  agi: number;
  med: number;
  cha: number;
}
export const STAT_NAME: Record<keyof Stats, string> = { str: '전투', agi: '수색', med: '의료', cha: '매력' };

/** 저장되는 개인 정보. 직업(prof)에서 나머지가 정해진다 */
export interface Person {
  id: string;
  prof: string;
  name: string;
  look: Look;
  stats: Stats;
  /** 예전 저장에는 없을 수 있다. 없으면 머리 모양으로 짐작한다 */
  gender?: Gender;
}

export interface ProfDef {
  id: string;
  title: string;
  look: Look;
  hairs?: string[];
  styles?: Look['style'][];
  /** 직업의 핵심 능력치는 최소치가 보장된다 */
  range: Record<keyof Stats, [number, number]>;
  names: 'person' | 'cat' | 'kid' | 'old';
  buff: SurvDef['buff'];
  likes: SurvDef['likes'];
  unlock: Unlock;
  hint: string;
  intro: string;
  chapters: [string, string, string];
  chat: string[];
  lastWords: string[];
}

/** 플레이어(관리자) 기본값. 시작 화면에서 고른 값으로 바뀐다. */
export const PLAYER: SurvDef = {
  id: 'me',
  name: '관리자',
  title: '지하 7층 대피소 관리자',
  look: { skin: '#f0c8a0', hair: '#3a2a22', style: 'short', top: '#2f4a6a', top2: '#ff9a3c', pants: '#3a3a4a', shoes: '#2a2a2a', acc: ['vest'] },
  buff: { kind: 'prod_all', value: 0, text: '' },
  power: 1,
  likes: { items: [] },
  unlock: { type: 'start' },
  hint: '',
  intro: '',
  chapters: ['', '', ''],
  chat: ['아직 문은 닫혀 있다.', '오늘도 숫자부터 센다. 사람, 식량, 물.', '내가 내리는 결정이 누군가의 하루가 된다.'],
  prof: 'me',
  stats: { str: 3, agi: 3, med: 3, cha: 4 },
  know: [],
  gender: 'm',
};

// ---------- 플레이어 만들기 ----------

export type Gender = 'm' | 'f';
export const GENDERS: { id: Gender; name: string }[] = [
  { id: 'm', name: '남성' },
  { id: 'f', name: '여성' },
];

export interface Start {
  food?: number;
  water?: number;
  med?: number;
  caps?: number;
  upg?: Partial<Record<UpgKey, number>>;
}

/** 출신: 사태가 터졌을 때 어디서 무엇이었나 */
export interface Origin {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  bonus: Partial<Stats>;
  start: Start;
  perk: string;
  acc: string[];
  /** 이 출신이 가질 수 있는 직업과, 그 조합에서의 구체적인 직함·설명 */
  jobs: Record<string, { title: string; blurb: string }>;
}

export const ORIGINS: Origin[] = [
  { id: 'tenant', name: '입점 상인', icon: '🏪', acc: ['vest'],
    blurb: '이 층에 입점한 가게 사람이었다. 셔터 열쇠와 매장 재고가 손에 있었다. 이 층에서 가장 먼저 문을 걸어 잠근 사람이다.',
    bonus: { cha: 1 }, start: { food: 20, caps: 20 }, perk: '매력 +1 · 시작 식량 +20 · 뚜껑 +20',
    jobs: {
      merchant: { title: '편의점 점주', blurb: '지하 7층 편의점의 주인이었다. 매출보다 재고 숫자를 더 자주 세던 사람. 손님과 흥정하는 일이라면 누구보다 능숙하다.' },
      medic: { title: '입점 약국 약사', blurb: '같은 층 약국의 약사였다. 처방전보다 먼저 사람 얼굴을 보던 습관이 있고, 약 서랍 열쇠가 아직 주머니에 있다.' },
      clerk: { title: '편의점 야간 직원', blurb: '편의점 야간 근무자였다. 유통기한과 재고 정리가 몸에 익은 평범한 사람. 눈에 띄진 않아도 쉽게 무너지지 않는다.' },
    } },
  { id: 'staff', name: '시설 관리직원', icon: '🔧', acc: ['cap'],
    blurb: '건물 설비팀이었다. 정수 탱크, 비상 발전기, 배관 도면의 위치를 몸으로 안다. 마스터키 한 뭉치가 허리춤에서 짤랑거린다.',
    bonus: { str: 1 }, start: { water: 30 }, perk: '전투 +1 · 시작 식수 +30',
    jobs: {
      engineer: { title: '설비 기사', blurb: '정수 탱크와 비상 발전기를 관리하던 설비팀 기사. 배관 도면이 머릿속에 들어 있다. 망가진 건 고치면 된다. 사람만 빼고.' },
      medic: { title: '건물 의무실 간호사', blurb: '건물 의무실에서 일하던 간호사. 이 건물 직원들의 병력을 대부분 안다. 응급 상자의 위치도.' },
      clerk: { title: '관리사무소 직원', blurb: '관리사무소에서 입주사 민원과 출입 기록을 맡았다. 이 건물에 누가 있었는지 가장 잘 아는 사람.' },
    } },
  { id: 'guard', name: '보안 요원', icon: '🛡', acc: [],
    blurb: '야간 순찰 중이었다. 진압봉과 무전기, 그리고 사람들이 몰려오는 순간 문을 닫아야 했던 기억이 남았다. 누구를 들였고 누구를 못 들였는지, 전부 기억한다.',
    bonus: { str: 2 }, start: {}, perk: '전투 +2',
    jobs: {
      soldier: { title: '군 출신 경비', blurb: '군에서 전역한 뒤 이곳 보안을 맡았다. 명령을 받고 내리는 데 익숙하고, 위기에서 몸이 먼저 판단한다.' },
      engineer: { title: '보안 설비 기사', blurb: 'CCTV와 출입 통제 시스템을 유지하던 보안 기술자. 어디가 뚫릴 수 있는지 누구보다 잘 안다.' },
      clerk: { title: '관제실 요원', blurb: '모니터 앞에서 밤을 새던 관제 요원. 건물 전체의 움직임을 화면으로만 봐 왔다. 이제는 화면 밖에 서 있다.' },
    } },
  { id: 'shopper', name: '쇼핑 온 시민', icon: '🛍', acc: [],
    blurb: '그날은 그냥 장을 보러 내려온 평범한 사람이었다. 가진 건 장바구니와 가방 속 상비약뿐이지만, 얽매인 것도 없다.',
    bonus: {}, start: { caps: 60, med: 10 }, perk: '시작 뚜껑 +60 · 의약품 +10',
    jobs: {
      medic: { title: '병원 근무자', blurb: '쉬는 날 장을 보러 내려온 병원 근무자였다. 근무복은 없어도 다친 사람 앞에서 손이 먼저 움직인다.' },
      engineer: { title: '엔지니어', blurb: '휴일에 장 보러 나온 엔지니어였다. 가방 속 공구는 없지만, 망가진 걸 보면 고칠 방법부터 떠올린다.' },
      soldier: { title: '퇴직 경찰', blurb: '퇴직한 경찰이었다. 이제는 장바구니를 든 시민일 뿐인데, 몸은 아직 위험을 먼저 본다.' },
      merchant: { title: '영업사원', blurb: '외근 중에 들른 영업사원이었다. 사람을 만나 설득하고 값을 맞추는 일이 업이었다.' },
      clerk: { title: '회사원', blurb: '퇴근길에 장을 보러 온 회사원이었다. 튀지 않고 성실하게 살아서, 이 상황에서도 크게 무너지지 않는다.' },
    } },
];

/** 직업: 사태 전에 하던 일. 능력치 굴림의 범위를 정한다 */
export interface Job {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  range: Record<keyof Stats, [number, number]>;
  start: Start;
  perk: string;
  chat: string[];
}

export const JOBS: Job[] = [
  { id: 'medic', name: '의료인', icon: '⚕', blurb: '응급실이든 약국이든, 다친 사람 앞에서 손이 먼저 움직인다.',
    range: { str: [1, 3], agi: [2, 4], med: [6, 9], cha: [2, 5] }, start: { med: 15 }, perk: '의료 6~9 · 시작 의약품 +15',
    chat: ['약은 아껴 쓰는 게 아니라 필요한 사람에게 쓰는 겁니다.', '상처부터 보여 주세요. 변명은 그다음.', '오늘 몇 명이 아프지?']},
  { id: 'engineer', name: '기술자', icon: '🛠', blurb: '망가진 건 고치면 된다. 사람만 빼고.',
    range: { str: [2, 4], agi: [5, 8], med: [1, 3], cha: [1, 4] }, start: { upg: { farm: 1 } }, perk: '수색 5~8 · 수경재배 Lv1로 시작',
    chat: ['이 배관, 아직 쓸 만합니다.', '전기는 거짓말을 안 해요. 사람과 달리.', '고칠 수 있는 건 고쳐 놨습니다.']},
  { id: 'soldier', name: '군·경 출신', icon: '🎖', blurb: '명령을 받고 내리는 데 익숙하다. 두려움을 숨기는 법도.',
    range: { str: [6, 9], agi: [3, 5], med: [1, 3], cha: [1, 3] }, start: {}, perk: '전투 6~9',
    chat: ['상황 보고부터.', '아직 여기가 무너진 건 아니다.', '살아 있는 사람 수부터 센다.']},
  { id: 'merchant', name: '영업·상인', icon: '💼', blurb: '사람을 만나 이야기하고, 값을 깎고 올리는 일을 해 왔다.',
    range: { str: [1, 3], agi: [2, 4], med: [1, 3], cha: [6, 9] }, start: { caps: 40 }, perk: '매력 6~9 · 시작 뚜껑 +40',
    chat: ['공짜는 없습니다. 목숨값도요.', '거래는 신뢰예요. 아직은 있나 봅니다.', '값은 상대가 정합니다. 필요한 만큼.']},
  { id: 'clerk', name: '사무직', icon: '🗂', blurb: '튀지 않고 성실하게 살았다. 그래서 이 상황에서도 크게 무너지지 않는다.',
    range: { str: [2, 4], agi: [2, 4], med: [2, 4], cha: [2, 4] }, start: { food: 15, water: 15 }, perk: '고르게 2~4 · 시작 식량·식수 +15',
    chat: ['일단 표로 정리해 봅시다.', '재고 파악이 먼저예요.', '숫자는 정직하다. 사람이 문제지.']},
];

/** 출신에 맞는 직업 목록 (정의된 순서) */
export function jobsOf(originId: string): Job[] {
  const o = ORIGINS.find((x) => x.id === originId);
  return o ? JOBS.filter((j) => j.id in o.jobs) : [];
}
export function jobTitle(originId: string, jobId: string): string {
  return ORIGINS.find((x) => x.id === originId)?.jobs[jobId]?.title ?? JOBS.find((j) => j.id === jobId)?.name ?? '';
}

export const ORIGIN_BY_ID: Record<string, Origin> = Object.fromEntries(ORIGINS.map((o) => [o.id, o]));
export const JOB_BY_ID: Record<string, Job> = Object.fromEntries(JOBS.map((j) => [j.id, j]));

export const LOOK_OPTS = {
  skins: ['#f4d4b0', '#f0c8a0', '#e8c098', '#e0b088', '#d0a078', '#b88860'],
  hairs: ['#2a2a3a', '#3a2a22', '#4a3022', '#8a5a2a', '#c8a050', '#8a8a8a', '#6a3a8a', '#c8486a'],
  styles: [
    { id: 'short', name: '짧은 머리' },
    { id: 'long', name: '긴 머리' },
    { id: 'bun', name: '묶음 머리' },
    { id: 'tuft', name: '삐죽 머리' },
    { id: 'bald', name: '민머리' },
  ] as { id: Look['style']; name: string }[],
  tops: ['#2f4a6a', '#6a3a3a', '#3a6a4a', '#4a4a4a', '#8a6a3a', '#5a3a6a'],
  accs: [
    { id: 'glasses', name: '안경' },
    { id: 'cap', name: '모자' },
    { id: 'beard', name: '수염' },
    { id: 'scar', name: '흉터' },
  ],
};

export const NAME_POOL: Record<Gender, string[]> = {
  m: ['도윤', '서준', '지후', '현우', '태민', '건우', '민재', '준혁'],
  f: ['서연', '지아', '하윤', '수빈', '예린', '지민', '다은', '유나'],
};

/** 시작 화면에서 정해진 플레이어 정보 */
export interface PlayerInfo {
  /** 지휘 특성 id (TRAITS) */
  trait: string;
  name: string;
  gender: Gender;
  origin: string;
  job: string;
  look: Look;
  stats: Stats;
}

export const SKINS = ['#f4d4b0', '#f0c8a0', '#e8c098', '#e0b088', '#d0a078'];
export const DARK_HAIRS = ['#2a2a3a', '#3a2a22', '#4a3022', '#4a2a1a', '#1e1e26'];

export const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
export const GIVEN_M = ['지우', '서진', '도연', '하람', '시현', '해든', '지오', '라온', '이안', '세인', '도하', '한결', '유건', '시안', '민준', '재원', '태호', '승우', '동현', '우진', '성민', '준서', '형준', '상훈'];
export const GIVEN_F = ['지안', '은우', '아람', '다온', '보람', '해솔', '나윤', '로아', '예온', '소담', '수아', '하은', '서윤', '지유', '채원', '민서', '유진', '예은', '시은', '다인', '나연', '가은', '소율', '미래'];
export const OLD_GIVEN_M = ['만복', '덕팔', '순길', '영철', '봉수', '기태', '두식', '판석'];
export const OLD_GIVEN_F = ['옥순', '말순', '영자', '순덕', '금자', '정숙', '복례', '분이'];
export const KID_NAMES = ['두리', '콩이', '보리', '하늘', '단비', '초롱', '별이', '새롬'];
export const CAT_NAMES = ['나비', '치즈', '고등어', '먼지', '두부', '모찌', '삼색이', '까망이'];

const CORE_PROFS: ProfDef[] = [
  {
    id: 'cook', title: '전직 해장국집 사장',
    look: { skin: '#f0c8a0', hair: '#4a3022', style: 'bun', top: '#d8d0c0', top2: '#f4efe4', pants: '#4a5a6a', shoes: '#5a4a3a', acc: ['chefhat', 'apron'] },
    styles: ['bun', 'short'],
    range: { str: [2, 5], agi: [3, 6], med: [1, 4], cha: [3, 6] }, names: 'person',
    buff: { kind: 'prod_food', value: 0.4, text: '벙커에 있으면 식량 생산 +40%' },
    likes: { items: ['f_ramen', 'f_coffee'], cat: 'food' },
    unlock: { type: 'start' }, hint: '곧 누군가 문을 두드린다.',
    intro: '"문 좀 열어주세요… 혹시 컵라면 냄새 안 나요? 주방, 아니, 그 구석 좀 써도 될까요?"',
    chapters: [
      '24시간 불이 꺼지지 않던 해장국집이었다. 사태가 터진 날에도 손님 열두 명에게 국밥을 말아줬다고 한다. "다 먹고 나서야 도망갔어요. 배는 안 곯아야죠."',
      '간판은 못 가져왔지만 낡은 국자 하나는 품에 있었다. 선반의 컵라면으로 끓여 준 라면을 한참 말없이 먹더니 중얼거렸다. "…면이 좀 불었는데, 이상하게 제일 맛있네요."',
      '계산대 옆에 작은 취사 코너가 생겼다. 삐뚤빼뚤 쓴 간판은 \'{n}네 야식\'. "손님 한 명이라도 오면 열 거예요. 아무도 안 와도 열 거고요."',
    ],
    chat: ['간은 제일 마지막에 보는 거예요.', '오늘 국물은 내가 봐도 잘 나왔네.', '냄새가 나면 사람이 모여요. 그게 제일 좋은 간판이죠.'],
    lastWords: ['"국이 식기 전에 돌아가고 싶었는데."', '"간은… 제일 마지막에 보는 거라고 했잖아요."', '"배는 안 곯아야죠. 다들."'],
  },
  {
    id: 'dev', title: '밤샘 코딩하던 개발자',
    look: { skin: '#f4d4b0', hair: '#2a2a3a', style: 'short', top: '#4a4a5a', top2: '#3a3a48', pants: '#2f3a4a', shoes: '#e8e8e8', acc: ['hood', 'glasses'] },
    range: { str: [1, 3], agi: [5, 9], med: [1, 3], cha: [1, 4] }, names: 'person',
    buff: { kind: 'prod_water', value: 0.4, text: '벙커에 있으면 정수·식수 생산 +40%' },
    likes: { items: ['t_game', 't_laptop'], cat: 'tech' },
    unlock: { type: 'found', n: 6 }, hint: '도감을 6종 채우면 찾아온다.',
    intro: '"저, 저기… 와이파이 있어요? 아, 없구나. 그럼 일단 들어가도 돼요? 아니 들어가겠습니다."',
    chapters: [
      '사태 전날 밤샘 코딩 중이었다. 눈을 떠 보니 세상이 끝나 있었다는 게 본인 설명. "근데 서버는 안 죽었어요. 아직 어딘가에서 돌고 있을걸요."',
      '낡은 계산대를 분해해서 재고 관리 단말기를 만들었다. 선반 물건이 이제 화면에 뜬다. "재고 관리는 제 일이죠. 이것만큼은 자신 있어요."',
      '새벽마다 무전기로 같은 말을 보낸다. "여기 B7, 불 켜져 있어요." 가끔 지직거리는 잡음 사이로 누군가 대답한다.',
    ],
    chat: ['이거 재부팅하면 다시 켜질까요… 아 이건 계산대구나.', '사람이 서버보다 오래 버티네요.', '로그를 보면 이 가게, 생각보다 잘 돌아가고 있어요.'],
    lastWords: ['"로그는 남겨 뒀어요. 누가 읽겠지."', '"재부팅하면 다시 켜질 줄 알았는데."', '"서버는 안 죽었어요. 아직… 돌고 있을 거예요."'],
  },
  {
    id: 'soldier', title: '은퇴한 특수부대 원사',
    look: { skin: '#e0b088', hair: '#5a5a5a', style: 'short', top: '#5a6a3a', top2: '#4a5a2a', pants: '#4a5a2a', shoes: '#2a2a22', acc: ['beret', 'scar', 'camo'] },
    hairs: ['#5a5a5a', '#3a3a3a', '#8a8a8a'],
    range: { str: [8, 10], agi: [3, 6], med: [2, 5], cha: [1, 4] }, names: 'person',
    buff: { kind: 'exp_guard', value: 0.6, text: '탐사대에 있으면 들킬 확률 -60%, 전리품 +1' },
    likes: { items: ['f_choco', 't_light'], cat: 'daily' },
    unlock: { type: 'exp', n: 3 }, hint: '탐사를 3번 다녀오면 찾아온다.',
    intro: '"경계 이상 무. 들어가도 되겠나? 문 앞의 좀비 셋은 조용히 처리했다."',
    chapters: [
      '전역 후 동네 경비 일을 하던 중이었다. "평생 지키는 일만 했는데, 지킬 게 없어졌더군." 하지만 매일 밤 편의점 문단속은 그가 한다.',
      '몰래 숨겨 둔 곰 젤리가 들통났다. 얼굴이 빨개진 채 말한다. "…전투식량엔 이런 게 없어서."',
      '신입에게 이것저것 가르치는 걸 은근히 좋아한다. "원칙 하나. 안 죽는다. 원칙 둘. 같이 돌아온다." 탐사대의 구호가 되었다.',
    ],
    chat: ['경계 이상 무.', '신발끈부터 다시 묶고 가라.', '문단속은 제일 중요한 일이다. 제일.'],
    lastWords: ['"원칙 하나. 안 죽는다. …미안하다."', '"문단속은 부탁한다."', '"경계 이상… 없다."'],
  },
  {
    id: 'cat', title: '길고양이 · 계산대 위의 주인',
    look: { skin: '#e8944a', hair: '#c86a2a', style: 'short', top: '#e8944a', top2: '#c86a2a', pants: '#e8944a', shoes: '#e8944a', acc: [], cat: true },
    range: { str: [1, 2], agi: [6, 9], med: [1, 1], cha: [5, 8] }, names: 'cat',
    buff: { kind: 'exp_luck', value: 0.8, text: '탐사대에 있으면 희귀·전설 발견 확률 +80%' },
    likes: { items: ['p_churu', 'p_food'], cat: 'pet' },
    unlock: { type: 'item', id: 'p_food' }, hint: '고양이 사료를 발견하면 냄새를 맡고 온다.',
    intro: '(냐아) 고양이 사료 냄새를 맡고 문 앞에 앉아 있다. 목에는 낡은 방울이 달려 있다.',
    chapters: [
      '매일 같은 시각에 계산대 위로 올라앉는다. 아무도 시킨 적 없지만 거기가 출근 자리다.',
      '이 고양이가 가는 곳엔 이상하게 물건이 남아 있다. 몰래 탐사 가방에 들어가 따라간 날, 평소보다 두 배나 많이 가져왔다.',
      '방울 안쪽에 작은 글씨가 새겨져 있다. \'집 잃으면 연락주세요.\' 이제 그 번호를 받을 사람은 없지만, 집은 잃지 않았다.',
    ],
    chat: ['냐아.', '(골골골)', '(계산대 위에서 느긋하게 기지개를 켠다)'],
    lastWords: ['(…냐아.)', '(방울 소리가 멀어진다.)', '(계산대 위는 끝내 비어 있다.)'],
  },
  {
    id: 'nurse', title: '종합병원 야간 간호사',
    look: { skin: '#f4d4b0', hair: '#3a2a2a', style: 'long', top: '#78b8c8', top2: '#5898a8', pants: '#78b8c8', shoes: '#f4efe4', acc: ['nursecap'] },
    styles: ['long', 'bun'],
    range: { str: [1, 4], agi: [2, 5], med: [7, 10], cha: [4, 7] }, names: 'person',
    buff: { kind: 'med_yield', value: 0.4, text: '벙커에 있으면 탐사에서 얻는 의약품 +40%' },
    likes: { items: ['m_vita', 'f_coffee'], cat: 'medical' },
    unlock: { type: 'cat', cat: 'medical', n: 3 }, hint: '의약품을 3종 발견하면 찾아온다.',
    intro: '"다친 사람 있어요? 아니면 제가 먼저 다쳤을지도. 하하, 농담이에요. 들어가도 될까요?"',
    chapters: [
      '야간 근무 중이던 병동의 환자들을 끝까지 옥상으로 대피시켰다. 마지막 한 명까지. 그 이야기는 거기까지만 한다.',
      '구급상자를 정리하다 말했다. "연고에도 유통기한이 있는데, 마음 달래는 건 유통기한이 없대요." 그리고 관리자의 손에 밴드를 붙였다.',
      '편의점 구석에 \'간이 진료소\' 팻말이 생겼다. 환자가 한 명도 안 오는 날이 제일 좋은 날이라고 한다.',
    ],
    chat: ['밥은 먹었어요? 약보다 밥이 먼저예요.', '손 씻었죠? 씻었다고 해 줘요.', '오늘은 다치지 말기로 해요, 우리.'],
    lastWords: ['"밥은 먹어요. 약보다 밥이 먼저예요."', '"다친 사람 없어서… 다행이에요."', '"연고는 서랍 둘째 칸에 있어요."'],
  },
  {
    id: 'comic', title: '40년차 만화방 주인',
    look: { skin: '#e8c098', hair: '#e8e8e8', style: 'short', top: '#8a6a4a', top2: '#7a5a3a', pants: '#4a4a4a', shoes: '#3a2a22', acc: ['beard', 'cane'] },
    hairs: ['#e8e8e8', '#d0d0d0'],
    range: { str: [1, 3], agi: [2, 5], med: [1, 3], cha: [2, 5] }, names: 'old',
    buff: { kind: 'calm', value: 0.5, text: '벙커에 있으면 절식의 부작용이 절반' },
    likes: { items: ['c_vol4', 'c_comic'], cat: 'culture' },
    unlock: { type: 'cat', cat: 'culture', n: 3 }, hint: '문화 물건을 3종 발견하면 찾아온다.',
    intro: '"어허, 문 열어라 이놈들아. …아니, 문 좀 열어 주시오. 내 만화 전집이 여기 있다고 들었소."',
    chapters: [
      '40년간 만화방을 지켰다. 사태가 터지던 날에도 "마지막 권 보고 가야지" 하며 앉아 있었다고 한다.',
      '선반의 낡은 만화책을 보고 눈이 반짝였다. "이건 한 권이 빠졌구먼. 4권이 없어. 에잉." 그날부터 4권 찾는 게 소원이 되었다.',
      '4권을 마침내 읽었다. 한참을 조용히 책장을 넘기다 말했다. "결말이 이랬구먼. 살아서 봤으니 됐다."',
    ],
    chat: ['요즘 애들은 만화를 안 봐서 탈이야.', '이 책은 3권이 제일 재밌소. 4권이 없어서 더.', '자, 한 권 보고 가시오. 공짜요.'],
    lastWords: ['"4권을 못 봤구먼. 에잉."', '"한 권 보고 가시오. 공짜요."', '"살 만큼 살았소. 이놈들아 밥 챙겨 먹어라."'],
  },
  {
    id: 'dj', title: '심야 라디오 DJ',
    look: { skin: '#e8c098', hair: '#6a3a8a', style: 'long', top: '#3a3a5a', top2: '#e84a8a', pants: '#2a2a3a', shoes: '#e84a8a', acc: ['headphones'] },
    hairs: ['#6a3a8a', '#e84a8a', '#2a6a8a'],
    range: { str: [1, 3], agi: [3, 6], med: [1, 3], cha: [7, 10] }, names: 'person',
    buff: { kind: 'prod_all', value: 0.1, text: '벙커에 있으면 모든 생산 +10%' },
    likes: { items: ['t_radio', 'c_lp', 'c_tape'], cat: 'culture' },
    unlock: { type: 'item', id: 't_radio' }, hint: '작동하는 라디오를 발견하면 찾아온다.',
    intro: '"안녕하세요 B7 청취자 여러분— 아, 청취자가 아직 없구나. 방송 장비부터 찾아야겠어요!"',
    chapters: [
      '새벽 두 시, 방송국 대신 편의점 계산대 뒤에서 마이크를 잡았다. 첫 곡 신청자는 관리자.',
      '라디오에 지직거리며 다른 곳의 신호가 잡혔다. "다른 생존자가 있나 봐요! 우리, 혼자가 아니에요."',
      '매일 밤 12시 \'종말 편의점 심야방송\'이 시작된다. 오프닝 멘트는 늘 같다. "오늘도 살아남은 당신, 수고했어요."',
    ],
    chat: ['오늘의 신청곡은 관리자님 거예요.', '마이크 체크, 원 투. 청취자 한 분 계시죠?', '새벽엔 모든 노래가 더 좋게 들려요.'],
    lastWords: ['"오늘도 살아남은 당신, 수고했어요. 이건 마지막 멘트."', '"마이크 체크… 원 투…"', '"청취자 한 분, 계셨죠?"'],
  },
  {
    id: 'kid', title: '구슬과 병뚜껑을 모으는 아홉 살',
    look: { skin: '#f4d4b0', hair: '#4a2a1a', style: 'tuft', top: '#e8c040', top2: '#d8a830', pants: '#4a78b8', shoes: '#e84a4a', acc: [], kid: true },
    range: { str: [1, 2], agi: [5, 8], med: [1, 1], cha: [5, 8] }, names: 'kid',
    buff: { kind: 'exp_loot', value: 1, text: '탐사대에 있으면 전리품 +1, 처음 발견한 물건의 뚜껑 보너스 2배' },
    likes: { items: ['f_choco', 'p_toy', 'f_snack'], cat: 'food' },
    unlock: { type: 'crew', n: 4 }, hint: '생존자가 4명 모이면 누군가 따라온다.',
    intro: '"아저씨! 과자 있어요? 저 주머니에 뚜껑 모아 놨어요. 다섯 개나요!"',
    chapters: [
      '반짝이는 걸 잘 찾는다. 병뚜껑, 구슬, 가끔은 잃어버린 열쇠. 어른들은 못 보는 구석을 아이는 본다.',
      '배낭 속엔 사진이 한 장 있다. 아무도 묻지 않았지만 다들 안다. 다음 날부터 어른들은 아이 몫으로 간식을 한 개씩 더 챙긴다.',
      '"나 커서 관리자 할래요!" "벌써 관리자는 여기 있는데?" "그럼 부관리자!" 아이는 오늘도 선반을 정리한다. 가끔은 거꾸로.',
    ],
    chat: ['이거 보세요! 별 모양 뚜껑!', '나 오늘 선반 열 개나 닦았어요!', '밤에 무서우면 고양이랑 자면 돼요.'],
    lastWords: ['"아저씨, 뚜껑 내 주머니에 있어요. 가져요."', '"무서우면 고양이랑 자면 된댔는데…"', '"나 커서… 부관리자 할 건데."'],
  },
];

/** 기본 8종 + 일반 직업들. 오는 순서는 정해져 있지 않다 */
export const PROFS: ProfDef[] = [...CORE_PROFS, ...EXTRA_PROFS];

/** 직업별로 잘 아는 분야 */
export const PROF_KNOW: Record<string, Know[]> = {
  cook: ['food'], dev: ['tech', 'office'], soldier: ['security'], cat: [], nurse: ['medical'], comic: ['culture', 'retail'], dj: ['culture', 'tech'], kid: ['edu'],
  farmer: ['food'], plumber: ['tech'], baker: ['food', 'retail'], firefighter: ['security'], police: ['security'],
  courier: ['logistics'], rider: ['logistics'], teacher: ['edu', 'culture'], pastor: ['culture'], pharmacist: ['medical', 'retail'],
  vet: ['medical'], paramedic: ['medical', 'security'], doctor: ['medical'], cleaner: ['office', 'retail'], electrician: ['tech'],
  mechanic: ['tech', 'auto'], angler: ['food'], streamer: ['tech', 'culture'], busker: ['culture'], student: ['edu', 'office'],
  oldlady: ['retail', 'logistics'], bartender: ['food', 'retail'], researcher: ['tech', 'medical'], trucker: ['logistics', 'auto'],
};
/** 플레이어(관리자)의 직업별로 잘 아는 분야 */
export const JOB_KNOW: Record<string, Know[]> = {
  medic: ['medical'], engineer: ['tech', 'auto'], soldier: ['security'], merchant: ['retail', 'food', 'logistics'], clerk: ['office'],
};

/** 직업별로 여성일 확률 (기본 0.5) */
export const PROF_FEMALE: Record<string, number> = {
  nurse: 0.85, teacher: 0.7, pharmacist: 0.6, baker: 0.6, oldlady: 1, bartender: 0.5,
  soldier: 0.2, firefighter: 0.15, police: 0.3, mechanic: 0.15, electrician: 0.15, plumber: 0.1, trucker: 0.1, rider: 0.3, doctor: 0.45,
};
/**
 * 직업의 희소성. 전문직일수록 방문 확률이 낮다.
 * common: 흔한 직업 / skilled: 전문 기술 / expert: 전문직(드묾)
 */
export type Tier = 'common' | 'niche' | 'skilled' | 'expert';
export const TIER: Record<Tier, { weight: number; label: string }> = {
  common: { weight: 1, label: '' },
  niche: { weight: 0.35, label: '흔치 않은 직업' },
  skilled: { weight: 0.5, label: '전문 기술' },
  expert: { weight: 0.2, label: '전문직 · 드문 손님' },
};
export const PROF_TIER: Record<string, Tier> = {
  doctor: 'expert', researcher: 'expert', soldier: 'expert',
  nurse: 'skilled', pharmacist: 'skilled', vet: 'skilled', paramedic: 'skilled', dev: 'skilled',
  firefighter: 'skilled', police: 'skilled', electrician: 'skilled', teacher: 'skilled',
  // 특이한 직업은 흔하지 않다
  streamer: 'niche', angler: 'niche', busker: 'niche', bartender: 'niche', pastor: 'niche', trucker: 'niche',
};
export const tierOf = (profId: string): Tier => PROF_TIER[profId] ?? 'common';

/** 작업 모자를 쓰는 직업이 실제로 모자를 쓸 확률 (나머지는 기본 0.25). 다들 모자를 쓰면 구분이 안 된다 */
export const CAP_CHANCE: Record<string, number> = { police: 1, firefighter: 0.7, courier: 0.5 };

/** 치마를 입지 않는 제복·작업복 직업 */
export const NO_SKIRT = new Set(['soldier', 'firefighter', 'police', 'mechanic', 'electrician', 'plumber', 'trucker', 'rider', 'paramedic', 'cleaner', 'cat']);

export const PROF_BY_ID: Record<string, ProfDef> = Object.fromEntries(PROFS.map((p) => [p.id, p]));

/** 생존자 한 명을 화면·규칙이 읽는 형태로 합친다 */
export function makeDef(p: Person): SurvDef {
  const pr = PROF_BY_ID[p.prof];
  const fill = (t: string): string => t.split('{n}').join(p.name);
  const gender: Gender = p.gender ?? (p.look.f || p.look.style === 'long' || p.look.style === 'bun' ? 'f' : 'm');
  return {
    id: p.id,
    name: p.name,
    title: pr.title,
    look: p.look.f === undefined ? { ...p.look, f: gender === 'f' } : p.look,
    buff: pr.buff,
    power: 1 + Math.floor((p.stats.str - 1) / 3.5),
    likes: pr.likes,
    unlock: pr.unlock,
    hint: pr.hint,
    intro: fill(pr.intro),
    chapters: pr.chapters.map(fill) as [string, string, string],
    chat: pr.chat,
    prof: p.prof,
    stats: p.stats,
    know: PROF_KNOW[p.prof] ?? [],
    gender,
  };
}

/** 현재 게임에 존재하는 모든 사람(플레이어 포함, 사망자 포함). 상태를 불러오거나 새 사람이 생기면 채운다. */
export const SURV_BY_ID: Record<string, SurvDef> = { me: PLAYER };
export function registerPlayer(p: PlayerInfo): void {
  const o = ORIGIN_BY_ID[p.origin];
  const j = JOB_BY_ID[p.job];
  SURV_BY_ID.me = {
    ...PLAYER,
    name: p.name,
    title: `${o?.name ?? ''} · ${jobTitle(p.origin, p.job)}`,
    look: { ...p.look, f: p.gender === 'f' },
    stats: p.stats,
    know: JOB_KNOW[p.job] ?? [],
    gender: p.gender,
    power: 1 + Math.floor((p.stats.str - 1) / 3.5),
    chat: j?.chat ?? PLAYER.chat,
  };
}
export function registerPerson(p: Person): void {
  SURV_BY_ID[p.id] = makeDef(p);
}
export function resetRegistry(): void {
  for (const k of Object.keys(SURV_BY_ID)) if (k !== 'me') delete SURV_BY_ID[k];
}


// ---------- 지휘 특성 · 별명 ----------

export interface Trait {
  id: string;
  name: string;
  icon: string;
  text: string;
}
/** 관리자가 시작할 때 고르는 특성. 효과는 state.ts 가 id 로 읽는다 */
export const TRAITS: Trait[] = [
  { id: 'calm', name: '침착함', icon: '🧊', text: '탐사에서 동료가 죽을 확률 -10%' },
  { id: 'charm', name: '카리스마', icon: '🎤', text: '협상 성공 +20%, 새로 합류한 사람과 친구가 될 확률 +10%' },
  { id: 'steward', name: '알뜰함', icon: '🧮', text: '식량·식수 소비 -10%' },
  { id: 'veteran', name: '노련함', icon: '🛡', text: '방어력 +20%, 돌파·습격 판정 +' },
  { id: 'lucky', name: '운이 좋음', icon: '🍀', text: '희귀 발견 +20%, 전염병이 돌 확률 -25%' },
  { id: 'healer', name: '돌봄', icon: '💊', text: '치료 비용 의약품 -1, 병든 사람이 오래 버팀' },
];
export const TRAIT_BY_ID: Record<string, Trait> = Object.fromEntries(TRAITS.map((x) => [x.id, x]));

/** 관리자가 탐사나 습격에서 죽을 때 남기는 마지막 말 */
export const ME_LAST = [
  '"…이 벙커를, 부탁해요."',
  '"다들 먹었죠? 그럼 됐어요."',
  '"문은 열어 두지 말고… 이름은 기억해 줘요."',
  '"내가 없어도 식량 계산은 이어서 해요. 제일 중요한 일이에요."',
];

// ---------- 거주 구역 (층 확장) ----------

export interface FloorDef {
  name: string;
  icon: string;
  /** 이 층까지 열었을 때 받아 줄 수 있는 생존자 수(관리자 제외) */
  cap: number;
  /** 이 층을 여는 비용(뚜껑) */
  cost: number;
  blurb: string;
}

/** 아래로 파 내려가며 열리는 거주 구역. 숫자는 시험용 */
export const FLOORS: FloorDef[] = [
  { name: '지하 7층 · 휴게실', icon: '🛏', cap: 4, cost: 0, blurb: '매장 창고 뒤 휴게실. 접이식 침대 네 개가 전부다.' },
  { name: '지하 8층 · 숙소', icon: '🏠', cap: 9, cost: 350, blurb: '비상 계단 아래를 뚫어 만든 이층 침대 방. 코 고는 소리가 벽을 타고 올라온다.' },
  { name: '지하 9층 · 대형 숙소', icon: '🏘', cap: 15, cost: 900, blurb: '옛 주차장 일부를 막아 칸을 나눴다. 사생활이 조금 생긴다.' },
  { name: '지하 10층 · 심층 구역', icon: '🏢', cap: 22, cost: 2000, blurb: '배관과 환풍구가 지나가는 깊은 층. 따뜻하지만 공기가 무겁다.' },
  { name: '지하 11층 · 요새', icon: '🏰', cap: 30, cost: 4500, blurb: '두꺼운 격벽 안쪽. 이제는 벙커라기보다 작은 마을이다.' },
];

// ---------- 개조 ----------

export type UpgKey = 'farm' | 'water' | 'store' | 'pack' | 'radio' | 'gen';

/** 생산·창고 수치는 state.ts 가 이 표를 보고 계산한다 */
export const PROD = { food: 0.08, foodLv: 0.04, water: 0.1, waterLv: 0.05, cap: 120, capLv: 80, medCap: 60 };

export const UPGRADES: Record<UpgKey, { name: string; icon: string; max: number; base: number; grow: number; text: (lv: number) => string }> = {
  farm: { name: '수경재배', icon: '🌱', max: 5, base: 120, grow: 2.2, text: (lv) => `식량 생산 ${fmtN(PROD.food + PROD.foodLv * lv)}/분` },
  water: { name: '정수 설비', icon: '💧', max: 5, base: 120, grow: 2.2, text: (lv) => `식수 생산 ${fmtN(PROD.water + PROD.waterLv * lv)}/분` },
  store: { name: '비축 창고', icon: '📦', max: 5, base: 150, grow: 2.4, text: (lv) => `식량·식수 보관 ${PROD.cap + PROD.capLv * lv}까지` },
  pack: { name: '튼튼한 배낭', icon: '🎒', max: 4, base: 300, grow: 3, text: (lv) => `탐사 전리품 +${lv}개` },
  radio: { name: '무전 안테나', icon: '📡', max: 5, base: 400, grow: 2.4, text: (lv) => `탐사 시간 -${lv * 7}% · 방문자 빨라짐` },
  gen: { name: '예비 발전기', icon: '⚡', max: 5, base: 250, grow: 2.4, text: (lv) => `자리 비워도 ${8 + lv * 2}시간까지 벙커가 돌아가요` },
};

function fmtN(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}
