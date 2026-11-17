# UNDERGROUND: LAST SHELTER

좀비 아포칼립스 지하 벙커 생존 경영 시뮬레이션. 플레이어는 단말기 앞의 사령관이며, 자원과 사람을 통제합니다.
(TypeScript + Vite, 화면은 HTML 단말기 UI, 규칙은 `src/sim` 의 순수 시뮬레이션 엔진)

## 구조
- `src/sim` : 게임 규칙(하루 정산, 배급, 원정, 세럼 결정, 칭호 등). 화면과 무관하게 테스트 가능
- `src/ui` : CRT 단말기 화면
- `tools/tests/sim.test.ts` : 엔진 테스트

## 실행
```
npm install
npm run dev
```

## 주의
- 모든 수치는 **임시 테스트 값**입니다(밸런스 미확정).
- 저장은 브라우저 localStorage 에만 됩니다(서버 검증 없음). 주소 뒤에 `?reset` 을 붙이면 저장이 지워집니다.
- 외부 세력, 파벌 갈등, 미형 생존자, 방어전, 서버 연동은 아직 구현 전입니다.
