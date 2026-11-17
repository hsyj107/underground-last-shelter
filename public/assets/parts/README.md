# 생존자 파츠 (얼굴·몸 조합용)

이 폴더에 그림을 넣고 `manifest.json` 의 숫자만 맞추면, 일반(랜덤) 생존자가 자동으로 조합된 모습으로 바뀝니다.
코드는 건드리지 않아도 됩니다. `body` 가 0이면 지금처럼 임시 그림(`assets/characters`)을 씁니다.

## 규칙

- 모든 파츠는 **같은 크기의 투명 PNG** (권장 64×128)이고, 서로 겹쳤을 때 제자리에 맞아야 합니다.
- 파일 이름은 `종류_두자리번호.png`, 번호는 01부터 빈틈없이.

| 종류 | 파일 예 | 비고 |
| --- | --- | --- |
| body | `body_01.png` | 맨몸·피부. **회색조(밝은 회색 기준)로 그리면** 피부색이 자동으로 입혀집니다 |
| outfit | `outfit_01.png` | 옷. 색 그대로 표시 |
| hair | `hair_01.png` | 머리. **회색조로 그리면** 머리색이 자동으로 입혀집니다 |
| acc | `acc_01.png` | 안경, 모자, 마스크 등. 색 그대로 표시 |
| overlay | `ov_sick.png`, `ov_hurt.png`, `ov_hungry.png` | 상태 표시(창백함, 붕대, 야윔). 있는 것만 manifest 의 `overlays` 에 적기 |

## manifest.json 예

```json
{ "body": 4, "outfit": 10, "hair": 8, "acc": 5, "overlays": ["sick", "hurt", "hungry"] }
```

겹치는 순서는 body → outfit → hair → acc → overlay 입니다.
키 차이는 코드가 세로로 ±6% 늘이고 줄여서 처리합니다.
네임드(이름 있는 생존자)는 이 조합을 쓰지 않고 `assets/characters/` 의 고정 그림을 씁니다.
