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
