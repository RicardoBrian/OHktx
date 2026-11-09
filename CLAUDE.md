# OHktx 작업 지침 (KTX 취소표 알림, 개인용)

개인용 코레일 취소표 감시 + 반자동 예매. **먼저 `README.md` 의 "먼저 읽어주세요"를 본다**(개인용 한정, 약관 위반 소지, 셀렉터 미검증).

## 구조
- Node.js + TypeScript + Express 단일 프로세스. `src/server.ts` 진입, `src/scheduler.ts` 주기 확인, `src/korail/` Playwright 로 코레일 조작(`selectors.ts` 는 추정치 — 실제 사이트로 검증 전에는 "고쳤다"고 하지 않는다), `src/notify.ts` 텔레그램, `src/routes/` API, `public/` 화면.

## DB
- 서버의 SQLite(`better-sqlite3`, `src/db.ts`). 카드정보는 AES-256-GCM 암호화(`src/crypto.ts`).
- 비밀값은 `.env`(`.env.example` 참고): `APP_PASSWORD`, `SESSION_SECRET`, `ENCRYPTION_KEY` 필수. **`.env` 는 커밋하지 않는다.**

## 배포
- 오라클 클라우드 Always Free VM(`DEPLOY.md`, `deploy/setup.sh`, systemd `deploy/ohktx.service`, nginx). Cloudflare·Vercel 아님.

## 테스트
- 자동 테스트 없음. `npm run typecheck`, `npm run build`. 로컬 실행 `npm run dev` → http://localhost:3000

## 작업 원칙
- 고치기 전에 **실제 오류 메시지를 먼저 확보**한다. 메시지 없이 추측으로 고치지 않는다.
  사용자에게 확인을 부탁할 때는 열어볼 주소·볼 곳을 하나로 정확히 준다.
- 잘 되던 기능은 요청 없이 건드리지 않는다. 원인이 확인되면 그 원인만 고치고, "겸사겸사" 개선은 먼저 묻는다.
- 같은 문제로 두 번 고쳐도 안 되면 멈추고, 확인한 사실과 모르는 것을 정리해 보고한다.
- 사용자에게는 한국어로, 짧게, 무엇을 바꿨고 무엇을 확인했는지(확인 못 한 것도) 말한다.
- 전체 DB 지도는 `RicardoBrian/Ohweb` 의 `DB.md`. 컬렉션을 새로 만들면 그 표도 고친다.
