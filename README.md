# UNDERGROUND: LAST SHELTER

좀비 아포칼립스 지하 벙커 생존 경영 게임 (Phaser 3 + TypeScript + Vite)

현재 진행 단계: **1단계 – 프로젝트 환경 구축**

## 처음 한 번만: 준비물

1. Node.js LTS 설치 → https://nodejs.org (LTS 버튼)
2. 설치 확인 (터미널/명령 프롬프트에서)
   ```
   node -v
   npm -v
   ```

## 실행 방법

프로젝트 폴더에서 터미널을 열고:

```
npm install
npm run dev
```

터미널에 `http://localhost:5173/` 주소가 나오면 브라우저에서 열면 됩니다.
같은 와이파이의 휴대폰에서는 터미널에 함께 표시되는 `Network:` 주소로 접속하세요.

## 기타 명령

| 명령 | 설명 |
|---|---|
| `npm run typecheck` | TypeScript 오류 검사 |
| `npm run build` | 배포용 빌드 (`dist/` 폴더 생성) |
| `npm run preview` | 빌드 결과 미리보기 |

## 그래픽 교체 방법 (나중에)

`src/game/config/assetManifest.ts`에서 해당 항목에 `file: 'assets/icons/food.png'`처럼 경로만 추가하고
이미지를 `public/assets/` 아래에 넣으면 임시 도형 대신 픽셀 아트가 표시됩니다.

## 그림 파일 다시 만들기

방 배경과 캐릭터 PNG(`public/assets/rooms`, `public/assets/characters`)는 `tools/asset-pipeline/`의
`extract.py`, `build.py`가 원본 시트(`source-sheet.png`)에서 잘라내고 합성해 만든 것입니다.
방 안 소품 배치를 바꾸려면 `build.py`의 `ROOMS` 목록을 고친 뒤 다시 실행합니다.

## 폴더 구조

```
src/
  game/config/   해상도·레이아웃·에셋 목록·게임 설정
  game/scenes/   Boot → Preload → Bunker 화면
  art/           픽셀 아트를 코드로 그리는 모듈 (방, 생존자, 아이콘, 지상) — Phaser와 무관
  ui/            상단 자원바, 하단 메뉴, 벙커 단면 컴포넌트
  data/          시설·자원·메뉴 정의, 임시(mock) 데이터
  types/         공용 타입
```

## 현재 게임 흐름 (시험 버전)

- 처음 접속하면 캐릭터(닉네임·성별·연령대)를 만들고 도입부를 본다.
- 시설은 조건(대장 레벨, 이전 시설 레벨, 철)을 채우고 복구 작업(미니게임)을 성공하면 개방된다. → `src/data/progression.ts`, `src/data/minigames.ts`
- 생존자는 [탐험]으로 구해 온다. 네임드 생존자와 일반 생존자가 있다. → `src/data/expeditions.ts`, `src/data/survivorPool.ts`
- 생존자를 시설에 배치해야 그 시설이 가동된다.
- 진행 상황과 규칙 계산은 `src/game/state/gameState.ts` 에 있고, **지금은 브라우저에만 임시 저장**한다. (서버 저장·검증은 6단계)
- 처음부터 다시 하려면 주소 끝에 `?reset` 을 붙여 연다.
- 숫자(시간·보상·조건)는 모두 시험용 값이다.
