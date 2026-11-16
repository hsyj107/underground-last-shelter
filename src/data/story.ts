/** 대화 한 줄. speaker 가 비어 있으면 해설 */
export interface StoryLine {
  speaker: string;
  text: string;
}

/** 캐릭터를 만든 직후 나오는 도입부 (주인공 이야기) */
export function introLines(nickname: string): StoryLine[] {
  return [
    { speaker: '', text: '사태 37일째. 지상은 더 이상 사람이 살 곳이 아니다.' },
    { speaker: '', text: `${nickname}. 그날 이후 혼자 살아남았다. 함께 달리던 사람들은 하나둘 보이지 않게 됐다.` },
    { speaker: '', text: '쫓기듯 달리다, 무너진 건물 아래에서 낡은 벙커의 입구를 찾았다.' },
    { speaker: nickname, text: '…전기도, 물도 끊겼군. 그래도 문은 닫힌다. 여기라면 버틸 수 있어.' },
    { speaker: nickname, text: '혼자서는 오래 못 가. 밖에 아직 살아 있는 사람들이 있을 거야. 찾아서 데려오자.' },
    { speaker: '', text: '먼저 지하 1층 발전실을 눌러 개방하세요. 그다음 아래 [탐험]에서 생존자를 찾아 데려와 시설에 배치합니다.' },
  ];
}
