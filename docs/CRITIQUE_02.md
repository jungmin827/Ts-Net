# CRITIQUE_02 — 2라운드 검증 보고서

- 작성: 2026-10-08 04:0x~04:1x KST (비평 에이전트 2라운드)
- 검증 수단: 소스 정독, `npx tsc --noEmit`(통과 0건), `npx eslint .`(통과 0건),
  `curl http://localhost:3100/...`, **라이브 Supabase REST 를 공개 anon 키로 직접 호출**,
  `/api/admin/*` 실제 응답코드 측정. `next build` 는 지시대로 실행하지 않았다.
- 1라운드와 달리 **DB 실측을 포함**했다. 그 결과 "파일은 고쳤는데 라이브는 그대로"인 항목이
  문서가 기록한 것보다 더 많다는 것이 숫자로 확인됐다.

## 읽은 시점 고정 (동시 수정 중인 파일)

검증 중에도 다른 작업자가 파일을 고치고 있었다. `04:08` 기준 스냅샷을 떠서 분석했고,
그 사이 바뀐 파일은 아래뿐이다. 나머지 전 항목은 04:08 상태 그대로다.

| 파일 | 상태 |
|---|---|
| `FE/lib/admin/auth.ts` · `FE/app/api/admin/login/route.ts` | 03:58 `ENROLL_PATH` 도입 |
| `FE/app/(admin)/admin/login/LoginForm.tsx` | 03:59 `enrollRequired` 분기 추가 |
| `FE/app/(admin)/admin/enroll-2fa/{page,EnrollForm}.tsx` | 04:0x 신설 |
| `docs/GOAL_PLAN.md` | 04:0x "자기 회귀 수정 — 2FA 강제가 만든 영구 잠금" 추가 |

→ **"2FA 강제가 만든 로그인 불가" 는 내가 지적을 쓰기 전에 작업자가 스스로 찾아 고쳤다.**
   그래서 결함으로 올리지 않았다. 다만 그 수정이 남긴 구멍은 D-17 로 올린다.

---

# A. 1라운드 "처리 완료" 주장의 검증 결과

## 요약 — 라이브 실측 (공개 anon 키만 사용, 쓰기 없음)

| 검증 | 기대(문서) | 실측 |
|---|---|---|
| `POST /rpc/purge_expired_leads` | 005 로 차단 | **200 `0` — 실행됨** |
| `POST /rpc/purge_old_access_logs` | 005 로 차단 | **204 — 실행됨** |
| `GET /live_feed` | 005 로 5건 게이트 | **200, QA 3행 그대로 노출** |
| `POST /rpc/lead_rate_count` | 006 으로 레이트리밋 동작 | **404 PGRST202 — 함수 없음** |
| `GET /plans?description=not.is.null` | C-02 해소 | **12행, 레퍼런스 카피 그대로 반환** |
| `GET /plans` 건수 | 72 (신규 시드) | **50 (폐기된 구 시드)** |
| `GET /leads` (anon) | 차단 | `[]` ✓ |
| `GET /access_logs` (anon) | 차단 | `[]` ✓ |
| `GET /api/admin/export` | 405 | 405 ✓ |
| `POST /api/admin/export` Origin 없음 / 교차출처 | 403 | 403 / 403 ✓ |
| 로그인 6회 실패 (동일 XFF) | 429 | 429 ✓ |
| 로그인 8회 실패 (**XFF 첫 요소 회전**) | 429 | **401 × 8 — 락아웃 우회** |

**C-13(export CSRF) 과 C-23(락아웃) 만 실측으로 확인됐다.** 나머지 "처리 완료" 는
마이그레이션 미적용 때문에 **라이브에서 한 건도 효력이 없다.**

---

## D-01 [치명] 사업자정보 6종이 전부 사라져 전자상거래법 표시의무 영역이 통째로 비었다 — C-04 수정이 만든 회귀

- 주장: `GOAL_PLAN.md` "이번 라운드에 추가로 해소한 것" —
  "**C-04** 사업자정보 `TODO ...` 자리표시자 미렌더 (`isPlaceholder`). 값이 들어오면 자동 복귀."
- 실제:
  - `FE/components/sections/Footer.tsx:70-89` — 6항목을 `.filter(([, value]) => !isPlaceholder(value))`
    로 걸러낸다. `FE/lib/site-config.ts:23-30` 의 6개 값이 **전부 `TODO ...`** 이므로 전량 제거된다.
  - 라이브 HTML 실측: `<dl class="grid ...">` **</dl> — 자식 0개**.
    `grep -c '사업자등록번호' → 0`, `grep -c '통신판매업' → 0`.
  - 같은 라운드의 C-07 수정(`hasTel()`)으로 `FE/.env.local` 의 `NEXT_PUBLIC_TEL` 이 비어
    있어 `grep -c 'tel:' → 0`. 전화번호도 0곳이다.
  - `CONSULT_GUIDE.facts` 3칸은 전부 `value: null`(`site-config.ts:438-445`)이라 영업시간도 없다.
  - 전자우편주소는 `site-config.ts` 에 **필드 자체가 없다.**
- 왜 문제인가: 전자상거래법 §10①은 상호·대표자명·주소·전화번호·전자우편주소·사업자등록번호·
  통신판매업 신고번호를 **초기화면에 표시**하도록 한다. 1라운드에서는 "TODO 가 보인다"가
  위반이었고, 지금은 **"아무것도 없다"가 위반**이다. 위반의 형태만 바뀌었다.
  게다가 "TODO 상호"는 보는 사람이 미완성임을 알 수 있어 고칠 동기가 생기는데, 빈 칸은
  **고쳐야 한다는 신호 자체가 화면에서 사라진다.** `isPlaceholder` 는 문제를 안 보이게 만들었다.
  또한 방문자가 쓸 수 있는 연락 수단이 **폼 하나뿐**이다 — 전화·이메일·영업시간이 전부 없다.
- 조치:
  1. `FE/components/sections/Footer.tsx` — 전 항목이 placeholder 일 때 빈 `<dl>` 로 끝내지 않고,
     **런칭 전 체크 스크립트가 빌드를 실패시키게** 한다. "조용히 비우는" 선택지는 법적으로 없다.
  2. `FE/lib/site-config.ts:23-30` 에 `email` 필드 추가 + 6종 실제 값 기입 (운영자 조치).
  3. `NEXT_PUBLIC_TEL` 기입 전까지는 최소한 **전자우편주소**라도 표시되게 할 것.

## D-02 [치명] 마이그레이션 005 미적용 — 공개 anon 키로 리드 파기·접속기록 삭제가 **지금도** 실행된다 (C-01 라이브 미해결)

- 주장: `GOAL_PLAN.md` "처리 완료" 표 C-01 행 — "`005_lock_down_functions.sql` 신규. **003 보다 먼저 적용할 것**".
  C-35 행 — "005 에서 **뷰 자체에 5건 게이트** 추가 (이중 방어)".
  "QA 중 실 DB 에 들어간 테스트 데이터" 절 — "**005 를 적용하면 노출이 멈춘다.**"
- 실제: 브라우저 번들에 박히는 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 만으로 실행했다.
  ```
  POST /rest/v1/rpc/purge_expired_leads    → 200  "0"
  POST /rest/v1/rpc/purge_old_access_logs  → 204
  GET  /rest/v1/live_feed?select=*         → 200  [3행]  ← 5건 미만인데 그대로 나온다
  POST /rest/v1/rpc/is_admin               → 200  false
  ```
  `BE/supabase/migrations/005_lock_down_functions.sql` 은 **파일로만 존재한다.**
- 왜 문제인가: 1라운드가 치명으로 올린 구멍이 **한 글자도 막히지 않았다.** 문서의 "처리 완료"는
  "revoke 를 적는 파일을 만들었다"는 뜻이지 "막혔다"는 뜻이 아닌데, 표의 제목이 "처리 완료"다.
  특히 `purge_old_access_logs` 는 지금 당장 **개인정보 접속기록(법정 1년 보관) 파괴**가 가능하다
  — 1년 경과분만이라 현재 피해는 0이지만, 막기 전에는 "0행이라 괜찮다"가 유일한 방어다.
  그리고 `GOAL_PLAN` 이 경고한 적용 순서(005→003) 역시 **둘 다 미적용**이라 아직 유효하다.
- 조치: `BE/supabase/migrations/005` → `003` → `004` → `006` 순서로 **DB 에 적용.**
  적용 전까지 `GOAL_PLAN.md` 의 C-01·C-35 행은 "처리 완료"에서 **"파일 작성 / 미적용"으로 내릴 것.**
  "처리 완료" 표에 `적용 여부` 열을 추가하는 것이 구조적 해법이다.

## D-03 [치명] C-02(규칙 5) 미해결 — 레퍼런스 마케팅 카피 12행이 **우리 공개 API 로 지금도 서비스된다**

- 주장: `GOAL_PLAN.md` C-02 행 — "`lib/plans.ts` 에 `SUPPRESS_PLAN_DESCRIPTION` — **조회 단계에서 제거**.
  화면만 가리면 RSC 페이로드로 HTML 소스에 남는다. **4개 페이지 전수 0건 확인**".
  `FE/lib/plans.ts:36-55` 주석도 같은 논리를 전개한다.
- 실제: 우리 페이지에서는 사실이다(`/kt` 추천카드 설명 0줄 실측). 그런데 그 데이터는
  **같은 anon 키로 누구나 직접 읽을 수 있다.**
  ```
  GET /rest/v1/plans?select=carrier,name,description&description=not.is.null
  → 12행
    KT|인터넷와이드    |끊김 없이, 빠르게! 유선통신 중심 DPS
    KT|KT 오피스넷     |속도와 안정성의 만남, 유선 DPS 솔루션!
    KT|프리미엄 결합   |미세한 변화까지 감지하는 스마트 TPS!
    (SK/LG/SKYLIFE 동일 3종씩)
  ```
  `001_init_schema.sql:260-261` 의 `plans_public_read` 는 `is_active` 인 **모든 열**을 anon 에 연다.
- 왜 문제인가: 규칙 5 위반은 "우리 화면에 안 보이게 한다"로 해소되지 않는다. 우리가 운영하는
  엔드포인트가 우리 도메인의 공개 키로 그 문구를 **배포하고 있다.**
  `plans.ts` 주석이 "화면만 가리면 소스에 남는다"며 한 겹 더 내려갔는데, **한 겹 더 있었다.**
  같은 종류의 추론 실패가 반복됐다 — "내가 아는 노출 경로"를 전수로 착각한 것이다.
- 조치: `BE/supabase/seed/plans_damoa_2026-10-08.sql` 적용
  (97행 `delete from plans where carrier in (...)` 가 12행을 함께 지운다).
  적용 후에만 `SUPPRESS_PLAN_DESCRIPTION = false`. **그전까지 C-02 는 미해결이다.**
  차단 스위치만으로 해소를 선언하지 않도록 `plans.ts:36-48` 주석에 "REST 직접 조회로는 여전히
  나간다"를 명시할 것.

## D-04 [치명] C-03 미해결 — 화면이 고지한 보유기간(D+14 / D+1095)과 실제 보관(2년)이 여전히 다르다

- 주장: `GOAL_PLAN.md` "열린 결정" — "`[ ]` 개인정보 보유기간 고지(D+1095/D+14) vs DB 파기 주기(일괄 2년)
  불일치 → 마이그레이션 필요". `BE/.../003_purge_at_by_status.sql` 이 작성돼 있다.
- 실제: 라이브 HTML 에 `"③ 보유, 이용기간 : 개통 완료시 D+1095일 단순상담시 D+14일 후 식별불가 암호화 파쇄"`
  가 **2곳**(인라인 폼 + 퀵상담 모달) 그대로 찍힌다. `001_init_schema.sql:77` 의
  `purge_at default (now() + interval '2 years')` 는 그대로고, 003 은 미적용이다.
- 왜 문제인가: **고지한 기간(14일)보다 실제 보관(730일)이 52배 길다.** 개인정보 보호법상
  고지와 다른 보유는 그 자체가 위반이며, 이 사이트가 수집하는 유일한 자산이 개인정보다.
  1라운드가 치명으로 올렸고 "열린 결정"으로 옮겨졌을 뿐 **상태는 동일하다.**
- 조치: 둘 중 하나를 **지금** 고른다 —
  (a) 003 적용 (단, 상담 중인 건이 14일에 파기된다. 운영 흐름 확인 필수), 또는
  (b) `FE/lib/site-config.ts:236-241` `privacyDetail` ③을 실제 보관(2년)으로 **먼저 수정.**
  (b) 가 즉시 가능하고 법적으로 안전하다. 어느 쪽도 하지 않고 런칭하면 안 된다.

## D-05 [치명] C-05 미해결 — "개인정보처리방침" 이 아직 동의문구 4줄이고, 개인정보 보호책임자 표기가 0건이다

- 주장: 1라운드 C-05(치명). `GOAL_PLAN.md` 의 "처리 완료"·"미해결" 어느 목록에도 **C-05 가 없다.**
  누락된 채 라운드가 종료됐다.
- 실제: `FE/components/sections/LegalLinks.tsx:65-75` — 모달 본문이
  `CONSENT.privacyDetail.map()` 네 줄이다. `TERMS_NOTICE`(20-27행)도 4문장.
  라이브 HTML `grep -c '보호책임자' → 0`.
  `FE/content/` 디렉터리는 존재하지 않는다 (`terms.mdx`·`privacy.mdx` 미작성 — CLAUDE.md 디렉터리 규약 미충족).
- 왜 문제인가: 개인정보 보호법 §30①은 처리방침에 처리 목적·항목, 처리·보유기간, 제3자 제공,
  처리위탁, 정보주체의 권리·행사방법, **개인정보 보호책임자의 성명·연락처**, 안전성 확보조치,
  열람청구 접수·처리 부서를 포함하도록 열거한다. 현재 4줄에는 이 중 3개만 걸친다.
  "개인정보처리방침"이라는 이름의 링크를 눌렀는데 수집동의 문구가 나오는 것은
  **방침 미수립 + 허위 표기** 양쪽이다.
- 조치: `FE/content/privacy.mdx`·`terms.mdx` 작성 후 `LegalLinks.tsx` 가 전문을 렌더하도록 교체.
  전문 확정 전이라면 모달 제목을 "개인정보 수집·이용 동의 내역"으로 바꿔 **최소한 거짓말은 멈춘다.**

## D-06 [치명] 006 미적용 + 테스트 Turnstile + XFF 신뢰 = 접수 무제한, 그리고 외부인이 "실시간 신청 현황"의 내용을 심을 수 있다 (C-32 미해결)

- 주장: `GOAL_PLAN.md` — "**C-30** 레이트리밋을 `lead_rate_count()` RPC(`006`)로 이관 —
  service_role 의존 제거. 함수 미적용 시 접수는 통과시키되 **원인까지 `console.error` 로 남긴다**".
  C-32 는 처리 완료·미해결 어느 목록에도 없다.
- 실제 (세 가지가 동시에 성립):
  1. `POST /rest/v1/rpc/lead_rate_count` → **404 PGRST202** (006 미적용).
     `FE/app/api/leads/route.ts:111-119` 가 설계대로 통과시킨다 → **레이트리밋 0.**
  2. `FE/.env.local` — `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x0000…`,
     `TURNSTILE_SECRET_KEY=1x0000…` = Cloudflare **"항상 통과" 테스트 쌍** → **봇 방어 0** (C-34 미해결).
  3. 레이트리밋이 적용돼도 `route.ts:18-21` `clientIp()` 가
     `x-forwarded-for.split(",")[0]` 즉 **클라이언트가 보낸 첫 요소**를 쓴다 (D-07 실측 우회).
  그리고 `GET /rest/v1/live_feed` 는 anon 에 열려 있고(D-02) 5건 게이트도 없다.
- 왜 문제인가: 외부인이 임의의 이름·통신사로 리드를 **무제한 삽입**할 수 있다.
  `live_feed` 는 `left(name,1)||'**'` 과 `carrier` 를 그대로 노출하므로,
  공격자가 메인 "실시간 신청 현황"에 **원하는 글자와 통신사 분포를 전시**할 수 있다.
  표시되는 데이터가 "실제 `leads` 행"이라는 점에서 형식적으로는 CLAUDE.md 규칙 1을 지키지만,
  **규칙 1의 목적(허위 성황 표시 금지)은 정면으로 깨진다.** 가짜 데이터를 우리가 안 만들어도
  남이 만들 수 있으면 같은 결과다. 덧붙여 어드민 목록이 스팸으로 덮여 운영 자체가 막힌다.
- 조치:
  1. 006 적용 + 운영 Turnstile 키 발급 (둘 다 운영자 조치).
  2. `FE/app/api/leads/route.ts` `clientIp()` 를 **신뢰 가능한 헤더**로 교체 —
     Cloudflare 경유면 `cf-connecting-ip`, Vercel 이면 `x-vercel-forwarded-for`.
     `x-forwarded-for` 를 쓸 수밖에 없다면 **마지막 요소**를 쓴다.
  3. 006 미적용 시 `console.error` 만 남기고 통과시키는 현재 선택은, **Turnstile 이 테스트 키인 동안에는
     "통제 2개가 동시에 꺼진 상태"** 다. 운영 키 발급 전까지는 fail-closed 가 맞다.

---

# B. 1라운드 수정이 만든 새 문제 / 수정이 미완인 것

## D-07 [높음] 로그인 락아웃과 접수 레이트리밋의 식별자가 클라이언트가 조작하는 `x-forwarded-for` **첫 요소**다 — 실측으로 우회됨

- 주장: `GOAL_PLAN.md` "어드민 보안 라운드" C-23 행 — "IP+이메일 기준 15분 내 5회 /
  검증: 6회째 **429** + `Retry-After`". `lib/admin/login-throttle.ts:38` 주석 —
  "식별자는 이메일이 아니라 **IP + 이메일** 조합이다".
- 실제: `FE/lib/admin/audit.ts:25-29` `requestIp()` 와 `FE/app/api/leads/route.ts:18-21`
  `clientIp()` 가 모두 `headers.get("x-forwarded-for").split(",")[0]` 을 쓴다.
  Cloudflare 는 클라이언트가 보낸 `X-Forwarded-For` 에 **append** 하므로 첫 요소는 공격자 값이다.
  실측 (`/api/admin/login`):
  ```
  고정 XFF 203.0.113.9            : 401 401 401 401 401 → 429 429   (락아웃 동작)
  XFF "198.51.100.N, 203.0.113.9" : 401 401 401 401 401 401 401 401 (8회 전부 통과)
  ```
  이미 잠긴 뒤에도 첫 요소만 바꾸면 계속 시도된다.
- 왜 문제인가: C-23 의 목적("자동화 공격의 비용을 올린다")이 **헤더 한 줄로 0 이 된다.**
  문서는 메모리 기반이라는 한계만 밝혔고 **키가 위조 가능하다는 더 치명적인 한계는 적지 않았다.**
  같은 패턴이 접수 레이트리밋에도 있어 D-06 의 구성요소가 된다.
  부작용 반대편도 있다 — 프록시가 XFF 를 안 붙이는 환경에서는 키가 `"unknown|email"` 하나로
  합쳐져 **아무나 운영자 이메일로 5회 실패시켜 15분간 잠글 수 있다**(정상 사용자 차단).
- 조치: `FE/lib/admin/audit.ts` 에 `trustedClientIp(headers)` 를 하나 만들어
  `cf-connecting-ip` → `x-vercel-forwarded-for` → `x-real-ip` → (XFF 라면 **마지막 요소**) 순으로
  읽고, `lib/admin/audit.ts` 와 `app/api/leads/route.ts` 양쪽이 그것만 쓰게 한다.
  `login-throttle.ts` 주석의 "한계" 목록에 위조 가능성을 추가할 것.

## D-08 [높음] 요금 고지가 출처를 "통신사가 공개한 요금표"라고 적는다 — 실제 출처는 경쟁 대리점의 게시가다

- 주장: `FE/lib/legal-notices.ts:89` `PRICE_SOURCE_LINE` —
  "통신사 공개 요금표를 정리한 값으로, 실제 적용 금액은 상담 시 확정해 드립니다."
  같은 파일 120행 — "통신사가 공개한 요금표를 정리한 값입니다."
- 실제: 같은 파일 61-64행 주석이 출처를 "**인터넷다모아 공개 요금표 (타사 게시 가격)**" 로 적고,
  `BE/supabase/seed/plans_damoa_2026-10-08.sql:2-4,19-21` 은
  "출처: 인터넷다모아", "**⚠ 타사가 게시한 가격이다.** 통신사 표준요금·결합할인에 기반하지만
  우리 계약 조건과 일치한다는 보장이 없다" 라고 명시한다.
  `PRICE_SOURCE.verified = false`(75행) 이고 `legal-notices.ts` TODO T6 은 교차검증 불일치 8건이
  미판정이라고 적는다. 라이브 메인은 이 값으로 37,400 / 45,100 / 45,100 / 48,400 원을 공표 중이다.
- 왜 문제인가: 코드가 자기 주석으로 "타사 게시가"라고 아는 값을, **화면 고지에서는 "통신사 공개"로
  승격**시킨다. 출처를 실제보다 권위 있게 적는 것은 표시광고법상 허위·과장 표시에 해당할 수 있고,
  금액이 틀렸을 때 "통신사 자료를 믿었다"는 방어가 성립하지 않는다.
  규칙 6("근거에 맞춰 수정할 수 있어야 한다")도 어긋난다 — 근거와 표기가 다르다.
- 조치: `FE/lib/legal-notices.ts:89, 120` 의 문구를
  "통신사 상품 요금을 정리·게시한 공개 자료를 수집한 값" 처럼 **출처를 과장하지 않는 서술**로 교체.
  또는 `PRICE_SOURCE` 에 `sourceLabel` 을 두고 문구가 그것을 참조하게 한다(검증 완료 시 교체).

## D-09 [높음] QA 테스트 3행이 **지금 이 순간** 공개 노출 중이다 — "005 를 적용하면 멈춘다"는 전제가 성립하지 않았다

- 주장: `GOAL_PLAN.md` "QA 중 실 DB 에 들어간 테스트 데이터" —
  "마이그레이션 005 가 뷰 자체에 게이트를 심으므로 **005 를 적용하면 노출이 멈춘다.**"
  "**앞으로의 규약**: QA 접수는 넣은 직후 `status = 'SPAM'` 으로 바꾼다."
- 실제: 005 미적용(D-02)이고, 공개 anon 키로 읽힌다.
  ```
  GET /rest/v1/live_feed?select=*
  [{"applied_date":"26-10-08","carrier":"LG","masked_name":"김**","status_label":"접수완료",...},
   {"...","carrier":"SK","masked_name":"검**", ...},
   {"...","carrier":"KT","masked_name":"테**", ...}]
  ```
  `GOAL_PLAN` 표의 3건(테스트/검증/김검증)과 첫 글자가 일치한다. `status` 도 `SPAM` 으로
  바뀌지 않았다 — 권고한 규약이 기존 행에 적용되지 않았다.
- 왜 문제인가: 1라운드에서 "지금 노출 중"이라고 상향된 항목이 **그대로 노출 중**이다.
  `/api/feed/live` 는 service_role 키가 비어 있어 `{items:[]}` 를 돌려주므로 **우리 화면에는
  안 보이고, 공개 REST 로는 보인다** — 가장 알아차리기 어려운 형태다.
- 조치: DB 권한이 있는 쪽에서 **지금** 3행을 `status='SPAM'` 으로 변경(또는 삭제).
  권한이 없으면 005 선적용. 둘 중 하나는 런칭 전이 아니라 **오늘** 해야 한다.

## D-10 [높음] `GOAL_PLAN.md` 의 "체크 표시 정정" 표가 실제 체크박스에 반영되지 않았다 — 문서가 자기 자신과 모순된다

- 주장: `GOAL_PLAN.md` "체크 표시 정정 (비평 지적 — 과대 표기였던 것)" 표가
  G1-1 / G1-6 / G2-3 / G3-2 / G3-5 를 내리라고 적는다. 머리말은 "아래는 **되돌리거나 쪼갠다.**"
- 실제: 같은 문서 위쪽의 체크박스가 **하나도 바뀌지 않았다.**

  | 항목 | 정정 지시 | 현재 줄 |
  |---|---|---|
  | G1-1 | `[x] 시드 작성 / [ ] DB 반영` | 27행 `- [x] G1-1 …` |
  | G1-6 | 동상 | 37행 `- [x] G1-6 …` |
  | G2-3 | `[~]` | 45행 `- [x] G2-3 …` |
  | G3-2 | `[~]` | 61행 `- [x] G3-2 … (Supabase Auth + TOTP 2FA, aal2 요구)` |
  | G3-5 | `[~]` | 64행 `- [x] G3-5 …` |

  또 "현재 수치" 표(113-124행)의 "불투명 초록 색면 1.22%", "대비 위반 0곳" 은
  정정 표가 지적한 "파일 vs 라이브" 구분이 없다.
- 왜 문제인가: 이 문서는 스스로 "**진행 상태의 단일 출처**"(3행)라고 선언한다. 단일 출처가
  위쪽에서 `[x]`, 아래쪽에서 "과대 표기였다"를 동시에 말하면 **어느 쪽도 신뢰할 수 없다.**
  1라운드가 진단한 근본 원인("'파일을 고쳤다'와 '라이브에 반영됐다'를 같은 `[x]` 로 적은 것")이
  진단만 기록되고 **표기 체계는 그대로**다. 2라운드에서 D-02~D-04 가 전부 같은 이유로 재발했다.
- 조치: `docs/GOAL_PLAN.md` —
  1. 27·37·45·61·64행 체크박스를 정정 표대로 수정.
  2. 각 목표 항목에 `[파일]`/`[라이브]` 두 칸을 두는 형식으로 바꾼다.
     DB·환경변수에 의존하는 항목은 **라이브 칸이 비어 있으면 `[x]` 를 금지**한다.

## D-11 [높음] 마이그레이션 004 가 아무 효과도 내지 못한다 — PATCH 라우트가 여전히 service_role 로 쓰고, 주석도 004 작성 전 상태다

- 주장: `BE/supabase/migrations/004_lead_logs_insert_policy.sql:15-17` —
  "이 마이그레이션 이후 어드민은 **세션 클라이언트로 leads 를 수정할 수 있고 actor_id 가
  실제 수정자로 채워진다.**" `GOAL_PLAN.md` 블로커 3 — "마이그레이션 003·004 미적용.
  DB 에 적용해야 … `lead_logs` 기록이 동작한다."
- 실제: `FE/app/api/admin/leads/[id]/route.ts:11-14` 주석이 **004 전 상태를 그대로 설명한다** —
  "쓰기는 service_role 클라이언트로 한다. … `lead_logs` 에는 **INSERT 정책이 없어**
  authenticated 세션으로는 트리거가 RLS 에 막힌다."
  코드도 그대로다 — 82행 `admin = createAdminClient()`, 90행 `admin.from("leads").update(patch)`.
  service_role 세션에서는 `auth.uid()` 가 NULL 이므로 `log_lead_change()`(001:126,130)가 넣는
  `lead_logs.actor_id` 는 **004 를 적용해도 계속 NULL** 이다.
- 왜 문제인가: 004 를 적용해도 선언한 효과가 안 나온다. 마이그레이션은 썼지만 **그걸 쓰는 코드를
  안 고쳤다.** 부수 피해가 더 크다 — `createAdminClient()` 가 키 부재 시 throw 하므로
  `SUPABASE_SERVICE_ROLE_KEY` 가 비어 있는 현재 **상태 변경이 500 으로 전면 불가**인데,
  004 의 목적이 바로 그 의존 제거였다.
- 조치: 004 적용 후 `FE/app/api/admin/leads/[id]/route.ts` —
  80-90행의 `createAdminClient()` 경로를 제거하고 `guard.supabase`(세션 클라이언트)로 update.
  11-14행 주석을 현재 사실로 교체. `lead_logs` 수동 INSERT(98-104행)도 세션 클라이언트로.

## D-12 [높음] "아직 남은 높음" 7건 중 처리된 것은 3건뿐이고, C-18 과장·모순 카피는 라이브에 그대로 있다

- 주장: `GOAL_PLAN.md` "아직 남은 높음 (다음 라운드)" — C-11 / C-13 / C-12 / C-23 / C-16 / C-18 / C-15.
  이후 "어드민 보안 라운드 — 완료" 에서 C-11 / C-13 / C-23 세 건만 처리됐다.
- 실제: 나머지 네 건(C-12 / C-16 / C-18 / C-15)은 코드가 한 줄도 바뀌지 않았다.
  C-18 라이브 실측 (`grep -c`, 전부 1건씩 존재):
  - `"지원금과 경품을 **최대한 챙겨**드리려고 노력하고 있습니다"` (`site-config.ts:45`)
  - `"설치 완료 후 포함된 혜택은 **바로 받아** 보실 수 있습니다"` (`site-config.ts:101`)
  - `"상품 설치 직후에 문제 발생시 태산넷이 **책임지고 수리**합니다"` (`site-config.ts:101`)
- 왜 문제인가: 세 번째 문장은 **우리가 통신사 설비를 수리한다는 약속**이다. 이 사이트는
  상담 접수 창구이고(CLAUDE.md 1행) 설치·AS 는 통신사 소관이다. 이행 수단이 없는 약속은
  표시광고법상 부당 표시이자 분쟁 시 그대로 책임 근거가 된다.
  두 번째 문장은 같은 페이지의 FAQ `"사은품은 설치가 **확인된 뒤** 지급합니다"`
  (`site-config.ts:382`)와 **직접 모순**이고, `PLAN_NOTICE_BLOCKS` gift 블록의
  "지급 시기는 … 상담 시 안내" 와도 어긋난다. 한 화면 안에서 서로를 반박한다.
- 조치: `FE/lib/site-config.ts:45, 101` —
  "최대한 챙겨드리려고" → "적용 가능한 지원금과 조건을 안내해 드립니다",
  "바로 받아 보실 수 있습니다" → "설치가 확인된 뒤 안내된 조건에 따라 지급됩니다",
  "책임지고 수리합니다" → "설치 직후 문제가 생기면 통신사 AS 접수를 저희가 대신 진행해 드립니다"
  (이것조차 실제로 하는 일인지 운영자 확인 필요).

## D-13 [높음] C-16 미해결 — 요금 계산기가 "휴대폰 미포함"이라고 쓰면서 휴대폰 결합이 전제된 금액을 보여주고, 선택하면 그 위에 또 더한다

- 주장: `GOAL_PLAN.md` "아직 남은 높음" — "**C-16** 요금 계산기의 '휴대폰 미포함' 전제 중복 계상".
- 실제: `FE/components/sections/PlanCalculator.tsx`
  - 147-151행: `휴대폰` 행이 선택 없으면 **"미포함"** 으로 표시된다.
  - 38-41행: `total = combo.monthly_fee + (mobile?.monthly_fee ?? 0)`.
  - 181행: 바로 아래에 `PRICE_BASIS_LINE` = "표시 금액은 36개월 약정 · **휴대폰 1회선 결합 할인 적용** ·
    부가세 포함 기준입니다."(`legal-notices.ts:86`)

  즉 `combo.monthly_fee` 는 이미 휴대폰 1회선 결합 할인이 반영된 값인데, 화면은 같은 카드 안에서
  "휴대폰 미포함"이라고 쓰고, 휴대폰을 고르면 그 요금을 **더한다.**
- 왜 문제인가: 기본 상태의 "월 예상 요금"은 실제보다 **낮다**(휴대폰 없이 결합 할인가를 보여줌).
  휴대폰을 고른 상태는 실제보다 **높다**(할인 전제 + 휴대폰 요금 이중 계상).
  어느 선택지에서도 맞는 금액이 안 나오는 계산기이고, 금액 오안내는 이 업종의 주요 분쟁 사유다.
  바로 아래 각주가 자기 모순을 증명하고 있는데도 라운드 2회를 통과했다.
- 조치: `FE/components/sections/PlanCalculator.tsx` —
  (a) 기본 선택을 "미포함"이 아니라 **"휴대폰 1회선 결합(기준)"** 으로 두고, 해제 시
      "결합 미적용 금액은 상담 시 안내" 로 **금액을 비운다**(없는 값을 만들지 않는다), 또는
  (b) 휴대폰 축을 계산기에서 **제거**하고 결합 전제만 고지한다.
  (b) 가 데이터로 뒷받침되는 유일한 선택이다 — 시드에 "결합 미적용가"가 없다.

## D-14 [높음] 화면 밖 컨트롤이 탭 순서에 남아 있고(C-36), JS 가 죽으면 하단 상담바와 홍보 밴드가 못 쓰게 된다(C-38) — 둘 다 미수정이고 같은 결함이 `BackToTop` 에 새로 생겼다

- 주장: 1라운드 C-36 / C-38(둘 다 높음). `GOAL_PLAN.md` 에 **두 건 모두 등장하지 않는다** —
  처리도 보류도 기록되지 않았다.
- 실제:
  - `FE/components/forms/StickyConsultBar.tsx:47` `const [visible, setVisible] = useState(false)`
    + 109-111행 `visible ? "translate-y-0" : "translate-y-full"`.
    `transform` 은 접근성 트리에서 요소를 제거하지 않는다 → 페이지 상단에서 **데스크톱 바의
    select·입력 2칸·체크박스·'자세히'·제출·접기 7개가 화면 밖에서 탭 가능**하다.
    라이브 HTML 에 `translate-y-full` 2회 확인(데스크톱/모바일 두 벌).
  - JS 미동작 시 `visible` 이 영원히 false → **하단바가 영구히 화면 밖.** 레이아웃은
    `FE/app/(site)/layout.tsx:14` 에서 `pb-[4.5rem] lg:pb-[5.5rem]` 를 계속 비워 둔다.
  - `FE/components/sections/PromoBand.tsx:49,79-108` — SSR 은 `frames[0]` 한 장만 그린다.
    JS 없으면 "인터넷 · TV 가입" 조각만 남는다 (전체 문장은 66행 `sr-only` 에만 있다).
  - **새 결함**: `FE/components/ui/BackToTop.tsx:28-34` — 숨김 상태가
    `pointer-events-none translate-y-2 opacity-0` 뿐이다. `hidden`·`aria-hidden`·`tabIndex={-1}`
    이 없어 **보이지 않는 버튼이 탭 순서에 있다.** C-36 과 같은 실수를 1라운드 이후 신설 컴포넌트에서 반복했다.
- 왜 문제인가: 키보드 사용자는 Tab 을 눌렀을 때 포커스가 **화면 어디에도 없는 상태**가 된다
  (WCAG 2.4.3 / 2.4.7). 그리고 하단 고정바는 문서가 "이 업종의 핵심 전환 장치"
  (`StickyConsultBar.tsx:15`)라고 쓴 요소인데 스크립트 실패 시 전환 수단이 통째로 사라진다.
- 조치:
  1. `StickyConsultBar.tsx` — 바 컨테이너에 `inert`(또는 `aria-hidden` + 내부 `tabIndex={-1}`)를
     `!visible` 일 때 부여. `BackToTop.tsx` 는 `hidden={!show}` 로 바꾸는 것이 가장 짧다.
  2. `visible` 초기값을 CSS 로 제어 — `useState(true)` 로 두고 `scroll` 로 숨기거나,
     `<noscript>` 용 정적 CTA 를 `(site)/layout.tsx` 에 하나 둔다.
  3. `PromoBand.tsx` — `sr-only` 문장을 **시각적으로도** 기본 표시하고(JS 가 붙으면 교체),
     또는 `reduced` 분기와 동일한 "전체 문장 한 줄"을 SSR 기본값으로 둔다.

## D-15 [높음] C-37 미해결 — `Modal` 과 모바일 바텀시트에 포커스 트랩·초기 포커스·포커스 복원이 전부 없다

- 주장: 1라운드 C-37(높음). `GOAL_PLAN.md` 에 기록 없음.
- 실제: `FE/components/ui/Modal.tsx` 전체 59행에 포커스 관련 코드가 **0줄**이다.
  `role="dialog" aria-modal="true"`(38-40행)만 선언하고 실제 모달 거동은 없다 —
  열려도 포커스는 뒤의 버튼에 남고, Tab 은 배경 페이지를 돈다.
  닫을 때 포커스 복원도 없다. `StickyConsultBar.tsx:321-423` 바텀시트는 `role="dialog"` 조차 없다.
- 왜 문제인가: `aria-modal="true"` 는 "배경은 접근 대상이 아니다"를 **약속**하는 선언이다.
  구현이 없으면 스크린리더 사용자는 "모달이 열렸다"고 안내받은 뒤 배경을 읽게 되는,
  선언이 없을 때보다 더 혼란스러운 상태가 된다. 이 모달이 여는 내용이 **약관·개인정보 고지**다.
- 조치: `FE/components/ui/Modal.tsx` — `<dialog>` 네이티브 요소로 교체(`showModal()` 이
  트랩·Esc·배경 inert 를 브라우저가 처리)하거나, 열릴 때 컨테이너에 포커스 이동 +
  Tab 순환 처리 + 닫을 때 `previousActiveElement.focus()` 를 추가.
  바텀시트도 같은 `Modal` 을 쓰도록 통일.

## D-16 [높음] C-44 미해결 — `StickyConsultBar` 의 이름·연락처 입력 4칸에 접근 가능한 이름이 없다

- 주장: `GOAL_PLAN.md` "이번 라운드에 추가로 해소한 것" — "**C-19** 이름·연락처 입력칸에
  `sr-only` 라벨 + `aria-invalid` / `aria-describedby`."
- 실제: `FE/components/forms/LeadForm.tsx:166-197` 은 맞다(`sr-only` 라벨 2개).
  그런데 `FE/components/forms/StickyConsultBar.tsx` 의 네 칸은 `placeholder` 뿐이다 —
  - 227-236행 데스크톱 이름: `placeholder="이름"`, label/aria-label 없음
  - 237-247행 데스크톱 연락처: `placeholder="연락처"`, 없음
  - 356-365행 모바일 이름: `placeholder="이름을 입력해주세요."`, 없음
  - 366-376행 모바일 연락처: 없음

  `select` 2개에는 `aria-label` 이 있다(216·346행) — **같은 파일 안에서 기준이 갈린다.**
- 왜 문제인가: 하단 고정바는 전 페이지에 상시 노출되는 주 전환 경로다. placeholder 는
  입력을 시작하면 사라지므로 라벨이 아니고(1라운드가 쓴 그대로), 음성입력·스크린리더
  사용자는 칸을 식별할 수 없다. C-19 를 고치면서 **같은 결함의 더 중요한 인스턴스를 건너뛰었다.**
- 조치: `FE/components/forms/StickyConsultBar.tsx` 네 입력에 `aria-label="이름"` /
  `aria-label="연락처"` 추가 (좁은 바에는 `sr-only` 라벨보다 `aria-label` 이 간단).
  `error` 시 `aria-invalid` 도 함께.

## D-17 [높음] 2FA 부트스트랩 구멍 — TOTP 미등록 기간에는 비밀번호 하나로 어드민 전권을 탈취할 수 있다

- 주장: `GOAL_PLAN.md` "자기 회귀 수정 — 2FA 강제가 만든 영구 잠금"(04:0x 추가) —
  "로그인 라우트는 미등록 시 **세션을 끊지 않고** `{ ok: true, enrollRequired: true }` 를 돌려준다."
  표에 "TOTP 미등록 + aal1 → `ENROLL_REQUIRED` → `/admin/enroll-2fa` (유일하게 aal1 허용)".
- 실제: 설계대로 구현됐다(`login/route.ts:124-138`, `lib/admin/auth.ts:92-99`,
  `(admin)/admin/enroll-2fa/`). 다만 그 조합의 귀결이 문서에 없다 —
  1. 비밀번호가 맞으면 `signOut()` 없이 **aal1 세션 쿠키가 발급된다**(128행 `clearFailures(tk)` 로
     락아웃 기록까지 지워진다).
  2. `/admin/enroll-2fa` 는 aal1 로 열린다(`page.tsx:17` `checkAdmin({ allowAal1: true })`).
  3. `EnrollForm.tsx:35-45` 는 **미검증 factor 를 정리한 뒤 새 factor 를 발급**한다.

  → 운영자가 TOTP 를 등록하기 **전에** 비밀번호가 유출되면, 공격자가 자기 인증 앱을 등록해
    aal2 로 올라가고 **정상 운영자는 그 뒤로 못 들어온다**(verified factor 가 공격자 것).
- 왜 문제인가: CLAUDE.md 는 "어드민 = 단일 계정 1개 + **2FA**" 를 확정 사항으로 둔다.
  현재 상태는 **2FA 가 "운영자가 등록을 마치기 전까지는 없는" 조건부 통제**이고,
  그 창(window)의 길이는 운영자 행동에 달려 있다(지금은 계정 자체가 미생성이라 열려 있는 셈).
  문서는 "교훈: 보안을 조이는 변경은 정상 사용자 경로를 먼저 답해야 한다"로 끝났는데,
  답한 경로가 **공격자에게도 열려 있다**는 점은 적지 않았다.
- 조치:
  1. `FE/app/(admin)/admin/enroll-2fa/page.tsx` — 등록을 **1회용 토큰**으로 게이트.
     `admin_users` 에 `enroll_token`/`enroll_token_expires_at` 을 두고 운영자가 DB 에서
     직접 발급·전달받은 값을 쿼리로 요구한다. 토큰 소진 시 페이지를 닫는다.
  2. 최소 조치로도 가능한 것 — 등록 성공 시 `access_logs` 에 `UPDATE/target=admin:mfa_enrolled` 를
     남겨 **사후 탐지**를 가능하게 한다. 현재 등록은 브라우저↔Supabase 사이에서만 일어나
     **우리 감사로그에 흔적이 전혀 없다.**
  3. `GOAL_PLAN.md` 의 C-11 행("verified TOTP 부재 시 403 으로 먼저 끊어")은 **현재 코드와 다르다.**
     함께 갱신할 것.

## D-18 [높음] export 를 POST 로 바꾼 뒤, 실패하면 어드민이 raw JSON 페이지로 튕겨 나간다 — 가장 흔한 실패(대상 0건)에서 매번 발생한다

- 주장: `GOAL_PLAN.md` "어드민 보안 라운드" C-13 행 —
  "POST 전환 + `Sec-Fetch-Site`/`Origin` 검증. **UI 는 링크 → 별도 POST 폼(JS 불필요)**".
  `FE/app/(admin)/admin/leads/LeadFilterBar.tsx:167-175` 주석도 "JS 없이 동작하므로 서버 컴포넌트
  그대로 쓸 수 있다".
- 실제: `LeadFilterBar.tsx:176-190` 은 `target` 도 JS 핸들러도 없는 **최상위 네비게이션 POST 폼**이다.
  성공 시에만 `Content-Disposition: attachment` 로 다운로드되어 화면이 유지된다.
  실패 응답은 전부 JSON 본문이고, 브라우저는 **그 JSON 으로 페이지를 이동**한다 —
  - `export/route.ts:109-114` 대상 0건 → **404** `{"ok":false,"error":"선택한 기간·조건에 내보낼 접수 내역이 없습니다"}`
  - 117-140행 감사로그 실패 → 500 / 176-197행 `exported_at` 실패 → 500
  - `requireAdminApi()` 401·403 (세션 만료)
- 왜 문제인가: "미내보내기만 + 특정 통신사" 처럼 **결과가 비는 조합은 일상적**이다. 그때마다
  어드민은 필터를 전부 잃고 흰 화면의 JSON 을 본 뒤 뒤로가기를 눌러야 한다(POST 뒤로가기는
  재전송 경고까지 뜬다). `SUPABASE_SERVICE_ROLE_KEY` 가 비어 있는 **현재 상태에서는 감사로그
  기록이 반드시 실패**하므로, 지금 버튼을 누르면 100% 이 경로를 탄다.
  CSRF 를 막으면서 "JS 불필요"를 지킨 선택은 옳지만, **실패 경로를 설계하지 않았다.**
- 조치: `FE/app/(admin)/admin/leads/LeadFilterBar.tsx` —
  (a) 폼에 `target="_blank"` 를 주어 실패 JSON 이 새 탭에 떨어지게 하거나(가장 짧다),
  (b) `export/route.ts` 가 실패 시 `303 See Other` 로
      `/admin/leads?...&exportError=<code>` 로 리다이렉트하고 목록 페이지가 그 코드를 배너로
      띄우게 한다 (JS 불필요 원칙 유지 + 필터 보존). (b) 가 옳다.

## D-19 [높음] C-12 미해결 — `exported_at` 청크 중 하나가 실패하면 앞 청크는 "내보냄"으로 찍히고 파일은 전달되지 않는다

- 주장: `GOAL_PLAN.md` G3-5 — "감사로그를 **복호화 전에** 기록, `exported_at` 갱신 실패 시
  파일 미전달". 정정 표는 `[~]` 로 내리라고 했으나 64행은 여전히 `[x]`(D-10).
- 실제: `FE/app/api/admin/export/route.ts:173-197` — 300건 단위 루프에서
  한 청크가 실패하면 즉시 500 을 돌려주고 파일을 보내지 않는다. 그런데
  **이미 성공한 청크의 `exported_at` 은 롤백되지 않는다.**
  단일 트랜잭션이 아니고 보상 로직도 없다.
- 왜 문제인가: 300건 이상을 내보낼 때 앞 300건이 "내보냄"으로 표시되지만 운영자는 파일을 못 받는다.
  그 뒤 "미내보내기만" 필터로 재시도하면 **앞 300건이 영구히 배분 대상에서 빠진다.**
  이 사이트의 산출물이 "엑셀로 내보내 상담사에게 배분"(CLAUDE.md)이므로 리드 유실 = 매출 유실이다.
  게다가 "내보냄 표시를 해제하는 경로"가 어드민에 없다 — `StatusEditor` 는 status/gift/memo 만 다룬다.
- 조치:
  1. `BE/supabase/migrations/` 에 `mark_leads_exported(p_ids bigint[], p_at timestamptz)` RPC
     (`security definer`)를 추가해 **한 문장으로** 갱신. 20,000건 상한이면 단일 `update ... in (...)`
     로 충분하다 — 청크로 쪼갠 것 자체가 원인이다.
  2. 어드민 상세에 "내보냄 표시 해제" 버튼 추가 (`access_logs` 기록 포함).

---

# C. 1라운드가 놓친 새 결함

## D-20 [중간] 키보드 포커스 링이 흰 배경에서 2.88:1 이다 — 대비 스윕이 포커스 인디케이터를 보지 않았다

- 주장: `GOAL_PLAN.md` — "**검증**: 메인 / `/kt` / `/admin/login` 전부 **대비 위반 0건**.
  재현 도구를 `FE/scripts/contrast-audit.js` 로 남겼다 — … **렌더된 DOM 을 직접 훑는** 방식".
  G4-6 `[x] 재검증 완료`.
- 실제: `FE/app/globals.css:277-282`
  ```css
  :focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 4px; }
  ```
  `--brand: #07b040` 이고 같은 파일 19-20행이 스스로 "**대비 2.88:1 로 기준 미달**"이라고 적는다.
  `contrast-audit.js` 는 텍스트/배경 조합을 훑으므로 **포커스 시에만 나타나는 outline 색은
  검사 대상에 들어가지 않는다.**
- 왜 문제인가: WCAG 2.2 SC 1.4.11(비텍스트 대비)은 포커스 인디케이터에 인접색 대비 3:1 을 요구하고,
  SC 2.4.11(Focus Appearance, AAA)도 같은 선을 쓴다. 흰 면 위 2.88:1 링은
  "대비 위반 0건" 선언의 **유일한 반례가 하필 모든 조작 요소에 걸리는 전역 규칙**이라는 점에서
  특히 나쁘다. 1라운드 C-31 이 "흰 글자 on 통신사색"을 잡고 `--carrier-*-ink` 를 만들었는데,
  같은 종류의 비텍스트 대비를 전역 포커스 링에서 놓쳤다.
- 조치: `FE/app/globals.css:279` `outline: 2px solid var(--brand-dark)` (4.94:1) 로 교체.
  `FE/scripts/contrast-audit.js` 에 **`:focus-visible` 스타일을 강제 적용해 훑는 패스**를 추가.

## D-21 [중간] 전역 `:focus-visible` 이 `border-radius: 4px` 를 강제해, 포커스되는 순간 모든 알약·원형 버튼이 각져 보인다

- 주장: 같은 블록 주석 — "키보드 포커스는 반드시 보이게. 마우스 클릭 시에는 링을 띄우지 않는다."
  의도는 outline 뿐이다.
- 실제: `FE/app/globals.css:278-282` 의 `border-radius: 4px` 는 outline 이 아니라
  **요소 자체의 모서리**를 바꾼다. 이 규칙은 `@layer` 밖에 있고 Tailwind v4 유틸리티는
  `@layer utilities` 안에 있으므로, **레이어 밖 선언이 항상 이긴다** —
  `rounded-full`(통신사 칩 `PlanCalculator.tsx:44`, 상태 배지),
  `rounded-xl`(CTA `Button.tsx` lg/md), 전화 아이콘 원형 등이
  **키보드 포커스 시 4px 로 변형**된다.
- 왜 문제인가: 키보드 사용자만 겪는 시각적 변형이고, 포커스 이동마다 버튼 모양이 바뀌어
  "눌린 것인지 모양이 깨진 것인지" 구분이 안 된다. 1라운드·2라운드 모두 포커스 상태를
  스크린샷으로 보지 않았다는 증거다.
- 조치: `FE/app/globals.css:281` 의 `border-radius: 4px` 한 줄 **삭제.**
  `outline` 은 요소 radius 를 따라 그려지므로 별도 선언이 불필요하다.

## D-22 [중간] 자동 순환 콘텐츠에 정지 수단이 없다 (WCAG 2.2.2) — `PromoBand` 는 수단 자체가 없고, `LiveFeed` 는 hover 뿐이라 키보드로 멈출 수 없다

- 주장: `GOAL_PLAN.md` G2-5 / `PromoBand.tsx:18-19` 주석 —
  "prefers-reduced-motion 이면 회전을 멈추고 전체 문장을 한 번에 보여준다."
- 실제:
  - `FE/components/sections/PromoBand.tsx:35-42` — `setInterval(…, holdMs)` 가
    `holdMs: 2400`(`site-config.ts:147`)으로 **무한 반복**된다. 일시정지 컨트롤이 없다.
  - `FE/components/sections/LiveFeed.tsx:66` — `animate-feed-scroll`
    (`globals.css:128` `32s linear infinite`) + `group-hover:[animation-play-state:paused]`.
    **hover 만** 이고 `focus-within` 도, 버튼도 없다.
- 왜 문제인가: WCAG 2.2.2(Pause, Stop, Hide)는 5초를 넘는 자동 이동·갱신 콘텐츠에
  **사용자가 일시정지·정지·숨길 수단**을 요구한다. `prefers-reduced-motion` 은 OS 설정이라
  이 요구를 충족하지 않는다(전체를 끄거나 전체를 켜는 선택뿐이다).
  `LiveFeed` 는 hover 로 멈추는데, 키보드·터치 사용자에게는 멈출 방법이 없고
  이 영역은 **읽어야 하는 정보**(신청 현황)를 담는다.
- 조치:
  1. `PromoBand.tsx` — 진행 눈금(113-124행) 옆에 `일시정지/재생` 토글 버튼을 추가하고
     `index` 갱신을 그 상태로 끈다.
  2. `LiveFeed.tsx:60-66` — 컨테이너에 `focus-within:[animation-play-state:paused]` 추가 +
     명시적 정지 버튼. 또는 애니메이션을 버리고 **최근 20건 정적 목록**으로 바꾼다
     (롤링이 정보 전달에 기여하는 바가 없다).

## D-23 [중간] `SUPPRESS_PLAN_DESCRIPTION` 이 켜진 동안 추천 상품 카드 3장이 상품명·속도·약정만 남는다 — '프리미엄 결합'·'KT 오피스넷'이 무엇인지 알 수 없다

- 주장: `FE/lib/plans.ts:46-47` — "신규 시드 … 는 해당 행이 전부 NULL 이고 사실 정보 9건만
  남아 있다. **재시드 후 false 로 되돌릴 것**". 즉 일시적 조치라는 전제.
- 실제 (`/kt` 라이브 HTML):
  - 추천 카드 3장 = `인터넷와이드` / `KT 오피스넷` / `프리미엄 결합`
  - 설명문(`<p class="mt-3 ... text-muted">`) **0개**
  - 남은 정보 = 속도(`500M+WIFI포함` / `500M` / `1G`) + 약정 + 월 요금 + CTA

  `PlanCards.tsx:49-53` 이 `p.description &&` 로 감싸므로 블록 자체가 사라진다.
- 왜 문제인가:
  1. **'프리미엄 결합'이 무엇을 포함하는지 화면에 없다.** TV 가 포함되는지, 채널이 몇 개인지,
     WIFI 가 포함되는지 알 수 없는 카드에 "이 상품 상담하기" 버튼이 붙어 있다.
     금액만 있고 구성 설명이 없는 상품 카드는 비교 판단을 돕지 못한다.
  2. **'KT 오피스넷'은 사업자용 상품**인데 소비자 랜딩의 "문의가 많은 구성"
     (`PlanCards.tsx:28`)으로 전시된다. 폐기된 구 시드가 라이브라서 생긴 데이터 오류이고
     신규 시드에도 같은 이름이 있다.
  3. 일시 조치라는 전제가 성립하려면 재시드가 선행되어야 하는데 **미적용**이다(D-03).
     "일시"가 언제 끝나는지 정해지지 않은 상태로 4개 서브페이지 12장이 빈약하게 서 있다.
- 조치:
  1. 재시드(D-03)를 선행하고 `SUPPRESS_PLAN_DESCRIPTION = false`.
  2. 그전까지 `FE/components/sections/PlanCards.tsx` — description 이 없으면
     `speed`/`tv_option`/`contract_months` 로 **구성 요약 줄을 조립**해 넣는다
     (데이터에 있는 사실만 쓰므로 규칙 6 위반이 아니다).
  3. 추천 카드 선정(`plans.slice(0, 3)`)에서 사업자용 상품을 제외하는 기준을 시드나
     `plans.ts` 에 둔다.

## D-24 [중간] C-41 미해결 — `PriceBars` 가 `grid-cols-4` 로 고정이고 섹션 카피도 "4사"로 고정이다

- 주장: 1라운드 C-41(중간). `GOAL_PLAN.md` 에 기록 없음.
- 실제: `FE/components/sections/PriceBars.tsx:79, 128` 두 곳 모두 `grid-cols-4` 하드코딩
  (+ 83-89행 그리드선 span 이 전체 폭을 덮는다). `PriceCompare.tsx:22` 는
  `items.length < 3` 에서만 섹션을 끈다 → **3사만 등록되면 4번째 칸이 빈 채로 그리드선과
  눈금만 남는다.** 섹션 설명은 `PriceCompare.tsx:29` `"…4사를 나란히 놓았습니다"` 로 고정이고
  44-46행 각주도 "막대 아래 구성명" 을 전제한다.
  (현재는 라이브에 4행이 있어 증상이 드러나지 않는다 — `bar-fill` 4개 실측.)
- 왜 문제인가: 통신사 하나가 `is_active=false` 가 되거나 500M 결합이 미등록되는 순간
  차트 우측 1/4 이 비고, 그 아래 글은 여전히 "4사"라고 말한다. 데이터 개수에 따라
  **화면이 자기 설명과 어긋난다.**
- 조치: `FE/components/sections/PriceBars.tsx` — `grid-cols-4` 를
  `style={{ gridTemplateColumns: 'repeat(' + items.length + ', minmax(0,1fr))' }}` 로 교체(2곳).
  `PriceCompare.tsx:29` 의 "4사" → `items.length` 기반 보간.

## D-25 [중간] C-20 미해결 — 어드민 목록·상세 조회 기록에 IP 가 빠진다 (접속기록 법정 기재항목)

- 주장: `FE/lib/admin/audit.ts:24` — "Route Handler 에서 접속자 IP — **접속기록의 법정 기재항목**".
  `FE/lib/site-config.ts:476` PRIVACY_PROMISE 근거 — "열람 기록 → `lib/audit.ts` + …".
  화면 문구(509행) — "누가 **언제** 어떤 건을 열었는지 접속기록으로 남깁니다".
- 실제: `ip` 를 넘기는 곳은 Route Handler 3곳뿐이다 (`export`, `decrypt`, `leads/[id]` PATCH).
  서버 컴포넌트는 전부 빠졌다 —
  - `FE/app/(admin)/admin/leads/page.tsx:66-73` `logAccess({...})` — **`ip` 없음**
  - `FE/app/(admin)/admin/leads/[id]/page.tsx:64-71` — **`ip` 없음**
  - `FE/app/(admin)/admin/page.tsx:76-83` — **`ip` 없음**

  Next 15 서버 컴포넌트에서 `await headers()` 로 얻을 수 있는데 쓰지 않았다.
- 왜 문제인가: 「개인정보의 안전성 확보조치 기준」은 접속기록에 **접속지 정보**를 포함하도록 한다.
  개인정보(이름·마스킹번호·메모)가 실제로 화면에 뜨는 경로 3개가 전부 IP 없이 기록되므로,
  유출 조사 시 "누가 어디서" 중 "어디서"가 비어 있다. 자기 모듈 주석이 "법정 기재항목"이라고
  적어 둔 값을 가장 중요한 세 경로에서 빼먹었다.
- 조치: `FE/lib/admin/audit.ts` 에 `requestIpFromHeaders()`(`await headers()` 사용) 추가하고
  위 3개 서버 컴포넌트의 `logAccess`/`logAccessSoft` 호출에 `ip` 를 채운다.
  (D-07 의 신뢰 헤더 교체와 함께 하면 한 번에 끝난다.)

## D-26 [중간] C-14 가 메뉴에서만 제거됐다 — `Reviews` 섹션은 여전히 `/review` 와 `/review/:id` 로 링크한다

- 주장: `GOAL_PLAN.md` — "**C-14** `/review` `/notice` 메뉴 제거 — 404 로 떨어지는 메뉴였다."
  `FE/components/sections/Header.tsx:13-17` 주석 — "페이지를 만들면 배열에 다시 넣으면 된다."
- 실제: `FE/components/sections/Reviews.tsx:60-70` `<Link href="/review">후기 보러가기</Link>`,
  77행 `<Link href={'/review/' + r.id}>` (카드 전체가 링크).
  현재 라이브에 보이지 않는 이유는 `reviews` 테이블이 비어 `reviews.length === 0` 에서
  섹션이 꺼지기 때문이다(`Reviews.tsx:51`) — **코드가 고쳐진 게 아니다.**
  `FE/app/(site)/review/` 디렉터리는 존재하지 않는다.
- 왜 문제인가: 운영자가 후기 1건을 `is_published=true` 로 올리는 순간
  메인에 **404 로 떨어지는 링크가 최대 9개**(목록 1 + 카드 8) 생긴다. C-14 의 근거였던
  "누르면 에러 페이지로 떨어지는 링크가 신뢰를 깎는다"가 그대로 재현된다.
  수정이 Header 에만 적용돼 **같은 결함의 다른 인스턴스를 남겼다** (D-16 과 같은 패턴).
- 조치: `FE/components/sections/Reviews.tsx` — `/review` 페이지 구현 전까지
  60-70행 "후기 보러가기" 링크를 제거하고, 카드의 `<Link>` 를 `<article>` 로 바꾼다.
  (또는 `BOARD_MENU` 처럼 `REVIEW_DETAIL_ENABLED` 플래그 한 곳으로 모은다.)

## D-27 [중간] `lead_rate_count` 를 anon 에 열면 "특정 IP 가 접수했는지" 확인하는 오라클이 된다 — 006 적용 시 발생

- 주장: `BE/supabase/migrations/006_lead_rate_count.sql:20-22` —
  "노출되는 정보 — 호출자가 지정한 IP 의 최근 접수 건수. **IP 를 일일이 넣어가며 세는 공격은
  얻는 게 거의 없고**, 그 대가로 공개 경로에서 전권 키를 제거한다."
- 실제: 42-43행이 `grant execute … to anon` 한다. 함수는 `p_since` 를 **호출자가 지정**하므로,
  공개 anon 키로
  - 특정 IP 의 접수 여부를 확인 (`p_since` = 아주 과거)
  - `p_since` 를 이분 탐색해 **접수 시각을 초 단위까지 특정**
  - 회사·학교·공공 WiFi 의 고정 IP 로 "그 조직에서 누가 신청했는지" 확인

  이 가능하다. 006 은 아직 미적용이라(404 실측) 현재는 발생하지 않는다.
- 왜 문제인가: "얻는 게 거의 없다"는 평가는 **IPv4 전수 탐색**만 상정했다. 실제 위협은
  전수가 아니라 **표적 1건 확인**이다. "이 사람이 통신사를 바꾸려 한다"는 사실 자체가
  개인정보이며, 경쟁 대리점이 그 정보를 얻는 구조를 우리가 공개 키로 제공하게 된다.
  `p_since` 자유 지정은 타임스탬프 추출까지 허용해 노출 폭이 "건수 하나"보다 넓다.
- 조치: `BE/supabase/migrations/006` 을 적용 **전에** 고친다 —
  반환을 `boolean`(초과 여부)으로 바꾸고 `p_since` 를 **인자에서 제거**해 함수 안에서
  `now() - interval '10 minutes'` 로 고정한다(`grant execute` 는 유지).
  그러면 유출은 "이 IP 가 최근 10분 내 3건을 넘겼는가" 한 비트로 줄고 레이트리밋 기능은 그대로다.

## D-28 [중간] `docs/TAMNANET_GAP_ANALYSIS.md` 의 P0 체크리스트가 전부 미체크다 — 완료분과 미완분을 구분할 수 없다

- 주장: `GOAL_PLAN.md` G2-2 `[~]` — "P0 해소 진행 — 보조면 중립화, 고지 18항목, 사은품 빈 열 소거,
  대비 19곳 교정". G2-1 `[x]` — "갭 리포트 … 28항목 / P0 12개".
- 실제: `docs/TAMNANET_GAP_ANALYSIS.md:946-1010` 의 체크박스가 **전부 `[ ]`** 다.
  그런데 그중 상당수는 실제로 끝났다 —

  | 항목 | 실제 상태 |
  |---|---|
  | G-07 사은품 빈 열 소거 | 완료 (`PlanTable.tsx:173-179` `cols.gift`) |
  | G-19 뉴트럴 한랭화 | 완료 (`globals.css:39-42`) |
  | G-25 본문 `#consult` 유도 | 완료 (메인 `href="#consult"` **8개** 실측) |
  | G-06 Journey+Process 통합 | 완료 (`Process.tsx` 삭제됨) |
  | G-12 `PlanNotice` | 완료 (`legal-notices.ts` 18항목) |
  | G-02 가격 비교 | 완료 (`PriceCompare`/`PriceBars`) |
  | **G-08 추천 행 강조** | **미완** — `PlanTable.tsx` 에 추천 강조가 없다 (P0) |
  | **G-05 LiveFeed 5건 미만 정적 대체** | **미완** — `LiveFeed.tsx:35` 여전히 `return null` (P0) |
  | **G-03 사은품/혜택 섹션** | **미완** — `GiftShowcase` 없음 (P0) |
  | **G-09 할인가 열 앞으로 재배치** | 부분 — 페이드·힌트만, 열 순서는 그대로 |
  | **G-13 선택 조합 되읽기** | 미완 — 계산기 결과에 "500M + TV베이직" 표기 없음 |
  | G-21 히어로 다크 면 | **폐기** — G4 색 구조 결정과 충돌하는데 문서에 그 판단이 없다 |
- 왜 문제인가: "갭 분석 28항목"을 근거로 G2 진행률을 말하는데, 그 근거 문서는
  **아무것도 완료되지 않은 것처럼 보인다.** 그래서 남은 P0 3건(G-03/G-05/G-08)이
  완료분에 묻혀 보이지 않는다. 특히 G-05 는 1라운드 C-15·C-32 와 같은 영역이고
  "701px 짜리 전환 장치가 영구 공백"이라고 스스로 적은 P0 다.
- 조치: `docs/TAMNANET_GAP_ANALYSIS.md:942-1010` 체크박스 갱신 + G-21 에
  "G4 색 구조 결정으로 **폐기**" 표기. 미완 P0 3건을 `GOAL_PLAN.md` G2 섹션으로 **승격**.

## D-29 [중간] C-15 미해결 — `LiveFeed` 가 390px 에서 이름 열을 22px 로 눌러버린다 (리드 5건이 들어오는 순간 깨진다)

- 주장: `GOAL_PLAN.md` "아직 남은 높음" — "**C-15** `LiveFeed` 모바일 3열 전환 —
  **리드 5건 도달 전에 처리해야 한다**". G2-7 `[x]` — "창 500px 에서 가로 넘침 0".
- 실제: `FE/components/sections/LiveFeed.tsx:50, 70` — 두 곳 모두
  `grid-cols-[4.5rem_3.5rem_1fr_5rem_4rem]` + `gap-2` + `px-4` 로 **1라운드와 동일**하다.
  계산(**실측 아님** — 라이브에 5건 미만이라 섹션이 렌더되지 않는다):
  390px → 컨테이너 `px-4` 358 → 행 `px-4` 326 →
  고정열 72+56+80+64 = 272, gap 8×4 = 32 → **`1fr` 이름 열 = 22px**.
  `masked_name` 은 `left(name,1)||'**'`(3글자)이므로 `font-bold` 14px 에서 약 34px 필요하다.
- 왜 문제인가: G2-7 의 "가로 넘침 0" 은 사실이지만(그리드는 넘치지 않고 **안으로 짜부라진다**),
  문제는 넘침이 아니라 **내용이 잘리는 것**이다. 측정 지표가 결함을 못 잡는 종류였다.
  그리고 이 섹션은 리드 5건이 쌓이면 **자동으로 켜진다** — 발견 시점이 운영 중이 된다.
- 조치: `FE/components/sections/LiveFeed.tsx` — 기본 그리드를
  `grid-cols-[4.5rem_1fr_4.5rem]`(신청일·이름+통신사·상태) 3열로 바꾸고,
  통신사 배지는 이름 줄 안에, 사은품은 `sm:` 이상에서만 노출. 헤더 행도 같이 바꿀 것.

## D-30 [중간] C-42 미해결 — 표 우측 페이드가 스크롤 컨테이너 **밖**에 있어 끝까지 밀어도 32px 를 계속 가린다

- 주장: 1라운드 C-42(중간). `GOAL_PLAN.md` G2-6 `[x]` — "모바일 스크롤 힌트" 는 추가됐다.
- 실제: `FE/components/sections/PlanTable.tsx:68`(`<div className="relative">`) →
  73행 `<div className="overflow-x-auto">` → 150-154행 페이드가
  **`overflow-x-auto` 의 형제**로 `absolute inset-y-0 right-0 w-8` 에 놓인다.
  스크롤과 무관하게 고정이므로 표를 끝까지 밀어도 마지막 열(사은품/약정) 우측 32px 이 덮인다.
  게다가 `inset-y-0` 가 69-72행의 스크롤 힌트 문단까지 세로로 덮는다.
- 왜 문제인가: "더 볼 내용이 있다"는 신호가 **더 볼 게 없을 때도 계속 켜져 있다** —
  신호로서 기능하지 않고 정보만 가린다. 가리는 값이 금액·사은품 열이다.
- 조치: `FE/components/sections/PlanTable.tsx` — 페이드를
  `overflow-x-auto` 컨테이너 **안**에 `sticky right-0` 로 넣거나, JS 없이 끝 감지를 원하면
  `mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent)` 를
  스크롤 컨테이너 자체에 적용한다(후자가 JS 0 이다).

## D-31 [중간] C-25 미해결 — `Reveal` 이 20여 섹션 중 **1곳**에만 적용돼 있다

- 주장: `GOAL_PLAN.md` G2-5 `[~]` — "`Reveal` 을 **서버 렌더는 항상 보이는 상태**로 재작성
  (JS 죽어도 내용 유지)". `TAMNANET_GAP_ANALYSIS.md` 검증 항목 — "신규 섹션 전부 `<Reveal>` 적용 확인 (G-17)".
- 실제: 재작성은 **사실이다** — `FE/components/ui/Reveal.tsx:39-40` 이 `data-reveal` 을
  JS 로 붙이므로 SSR 결과에는 없고, `globals.css:285` 의 `opacity:0` 이 걸리지 않는다. ✓
  그런데 적용 지점은 `grep -rn "Reveal" FE/components FE/app` 결과 **`CarrierHub.tsx:19` 하나뿐**이다.
  1라운드 이후 신설된 `CarrierMatrix`·`ConsultCue`·`ConsultGuide`·`Faq`·`Journey`·`PriceCompare`·
  `PrivacyPromise`·`PlanNotice`·`PromoSlot` **9개 전부 미적용**이다.
- 왜 문제인가: 스크롤 등장이 한 섹션에서만 일어나면 "연출"이 아니라 "그 섹션만 늦게 뜨는 버그"로
  읽힌다. G2-5 가 `[~]` 인 것은 맞지만, 사유로 적힌 것은 "호버 단위 0.22s 통일 미완"이고
  **적용 범위 1/20 은 사유에 없다.**
- 조치: `FE/app/(site)/page.tsx` 에서 섹션 단위로 `<Reveal>` 을 감싸되,
  **요금·고지·폼은 제외**한다(지연 노출이 정보 전달을 해친다). 또는 연출 자체를 포기하고
  `Reveal` 과 `globals.css:284-295` 를 삭제해 일관성을 택한다. 둘 중 하나를 결정으로 적을 것.

## D-32 [중간] C-45 미해결 — 요금 계산기의 금액 변경이 스크린리더에 알려지지 않는다

- 주장: 1라운드 C-45(중간). `GOAL_PLAN.md` 에 기록 없음.
- 실제: `FE/components/sections/PlanCalculator.tsx:162-167` — 합계 띠의
  `<p className="tabular mt-1 text-3xl font-black">{formatWon(total)}</p>` 에
  `aria-live`/`role="status"` 가 없다. 128-158행 결과 `dl` 도 없다.
  칩 버튼은 `aria-pressed` 만 토글한다(70·86·106·116행).
- 왜 문제인가: 이 컴포넌트의 존재 이유가 "고르면 **즉시** 금액이 바뀐다"인데
  (`PlanCalculator.tsx:16`), 스크린리더 사용자는 칩을 누른 뒤 금액 영역까지 직접 이동해야
  변화를 안다. 조합에 없는 선택일 때 나오는 안내문(153-158행)도 알려지지 않아
  **아무 일도 안 일어난 것처럼 느껴진다.**
- 조치: `FE/components/sections/PlanCalculator.tsx:127` 결과 컨테이너에
  `role="status" aria-live="polite" aria-atomic="true"` 추가.
  합계 문구에 구성 요약("500M · TV베이직 · 휴대폰 미포함")을 함께 넣으면 D-28 의 G-13 도 같이 닫힌다.

## D-33 [중간] SEO 기반이 하나도 없다 — `NEXT_PUBLIC_SITE_URL` 은 설정돼 있는데 아무도 쓰지 않는다

- 주장: `CLAUDE.md` 진행 상태 — "`[ ]` SEO·트래킹·도메인 연결" (미체크이므로 허위 주장은 아니다).
  `FE/app/layout.tsx:24` — "TODO: … metadataBase는 도메인 연결 시 설정".
- 실제: `FE/app/` 에 `sitemap.ts`·`robots.ts` 가 **없다.**
  라이브 HTML: `rel="canonical"` **0**, `property="og:*"` **0**.
  `FE/.env.local` 의 `NEXT_PUBLIC_SITE_URL` 은 **값이 채워져 있는데**
  `grep -rn "NEXT_PUBLIC_SITE_URL" app lib components` → **0건** (완전 미사용).
  `generateMetadata`(`[carrier]/page.tsx:27-35`)는 title/description 만 돌려준다.
- 왜 문제인가: 이 사이트의 유입은 검색·광고·메신저 공유다. OG 태그가 없으면
  **카카오톡·문자로 링크를 보낼 때 제목·설명·썸네일이 하나도 안 뜬다** — DB수집 랜딩에서
  가장 값싼 전환 손실이다. `metadataBase` 가 없으면 Next 가 OG/canonical 의 절대 URL 을
  만들지 못하므로, 환경변수가 이미 있는데도 아무 효과가 없는 상태다.
- 조치: `FE/app/layout.tsx` 에
  `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!)` + `openGraph`(title/description/
  siteName/locale `ko_KR`/images) 추가. `FE/app/sitemap.ts`(`/` + 통신사 4개) ·
  `FE/app/robots.ts`(`/admin`·`/api` disallow) 신설.

---

# D. 낮음

## D-34 [낮음] 로딩 중 CTA 라벨이 1.49:1 로 읽히지 않는다

- 실제: `FE/components/ui/Button.tsx:48` `disabled={disabled || loading}` →
  `globals.css:212-215` `.cta-fill:disabled { background: var(--line-strong); color: #fff }`.
  흰 글자 on `#cbd5df` = **1.49:1**. `LeadForm.tsx:256` 의 `"접수 중..."` 이 이 상태로 찍힌다.
- 왜 문제인가: `disabled` 는 WCAG 1.4.3 대비 예외이지만, **로딩은 "비활성"이 아니라 "진행 중"** 이다.
  접수가 처리되는 몇 초 동안 사용자가 상태 문구를 못 읽는다. 스피너(53-58행)가
  `border-current` 라 함께 흰색이 되어 역시 안 보인다.
- 조치: `FE/app/globals.css` 에 `.cta-fill[aria-busy="true"]` 를 추가해
  로딩 시에는 `--cta-to` 배경 + 흰 글자(4.15:1)를 유지. `Button.tsx` 는 이미 `aria-busy` 를 붙인다.

## D-35 [낮음] `purge_expired_leads()` 의 `current_date` 가 서버 타임존(UTC) 기준이다

- 실제: `BE/supabase/migrations/001_init_schema.sql:285`
  `delete from leads where purge_at < current_date`. `purge_at` 은 003 이
  `(created_at + interval)::date` 로 계산하는데 이 캐스팅도 세션 타임존을 따른다.
  CLAUDE.md 코딩 규칙은 "날짜·시간은 전부 `Asia/Seoul` 기준" 이고 FE 는 `lib/kst.ts` 로 지킨다.
- 왜 문제인가: 파기 시점이 KST 기준 하루 어긋날 수 있다. 보유기간 고지와의 정합을
  다투는 중(D-04)이라면 같은 기준으로 맞춰 두는 편이 안전하다.
- 조치: `003_purge_at_by_status.sql` 의 계산을
  `((new.created_at at time zone 'Asia/Seoul') + interval …)::date` 로,
  `purge_expired_leads()` 의 비교를 `(now() at time zone 'Asia/Seoul')::date` 로 명시.

## D-36 [낮음] `decrypt` 엔드포인트에는 `export` 와 달리 Origin 검증이 없다

- 실제: `FE/app/api/admin/export/route.ts:46-65` 는 `isSameOrigin()` 으로 교차출처를 403 한다
  (실측 확인). 같은 부수효과 등급인 `FE/app/api/admin/leads/[id]/decrypt/route.ts` 는
  **본문을 읽지 않는 POST** 인데 Origin/Sec-Fetch-Site 검증이 없다.
  (`PATCH /api/admin/leads/[id]` 는 메서드가 PATCH 라 폼 CSRF 가 불가하다.)
- 왜 문제인가: 현재는 Supabase 세션 쿠키의 `SameSite=Lax` 가 교차출처 POST 에 쿠키를 싣지 않아
  막힌다 — 즉 **방어가 전부 쿠키 속성 하나에 달려 있다**(쿠키 설정값은 미확인).
  `export` 에 2중 방어를 넣은 판단 기준이 `decrypt` 에는 적용되지 않아 일관성이 없다.
  `decrypt` 는 호출만으로 `access_logs` 에 DECRYPT 가 찍히므로 감사로그 오염도 가능하다.
- 조치: `isSameOrigin()` 을 `FE/lib/admin/auth.ts` 로 옮기고
  `decrypt`·`leads/[id]` PATCH·`logout` 에 공통 적용.

## D-37 [낮음] `live_feed` 가 한 글자 이름을 마스킹 없이 노출한다

- 실제: `001_init_schema.sql:211` / `005:51` 모두 `left(name, 1) || '**'`.
  `leadSchema`(`FE/lib/validation.ts:19`)는 이름을 2~20자로 받으므로 현재는 최소 2자지만,
  어드민이 `leads.name` 을 직접 1자로 넣거나 과거 데이터가 있으면 **전체 이름이 그대로 나간다**.
- 왜 문제인가: 마스킹 규칙이 "앞 1자 + 고정 `**`" 라서 원래 길이와 무관하게 3자를 만든다.
  2자 이름("김이")은 1/2 가 노출된다. 마스킹 강도가 이름 길이에 따라 들쭉날쭉하다.
- 조치: `BE/supabase/migrations/005` 의 뷰 정의를
  `left(name,1) || repeat('*', greatest(char_length(name)-1, 2))` 로 바꿔 적용.

## D-38 [낮음] 폼이 이름·연락처를 클라이언트 검증 없이 보낸다 — 한 번 왕복한 뒤 오류가 뜬다

- 실제: `FE/components/forms/LeadForm.tsx:100-102` `noValidate` + `handleSubmit`(48-81행)이
  동의·토큰만 검사한다. `required`·`maxLength` 는 `noValidate` 로 무력화된다.
  이름이 1자여도 `/api/leads` 까지 가서 400 을 받는다.
  `aria-invalid={error ? true : undefined}`(173·189행)는 **이름·연락처 양쪽에 동시 적용**되어
  어느 칸이 틀렸는지 알려주지 않는다. `StickyConsultBar.tsx:79-90` 도 동일.
- 왜 문제인가: 전환 폼에서 왕복 1회는 이탈 지점이고, Turnstile 토큰도 1회용이라 재발급된다
  (`LeadForm.tsx:79-80`). "버튼을 비활성으로 두지 않고 무엇이 빠졌는지 말해준다"(51-52행 주석)는
  의도가 **동의 체크에만 적용**됐다.
- 조치: `handleSubmit` 에 `leadSchema.pick({ name: true, phone: true })` 로 사전 검증을 넣고
  실패한 필드에만 `aria-invalid` 를 준다. zod 스키마를 공유하므로 규칙 중복이 생기지 않는다.

## D-39 [낮음] `hasTel()` 이 false 인 결과로 데스크톱 헤더 우측과 히어로 좌하단이 빈다

- 실제: `FE/components/sections/Header.tsx:130-146` — `hasTel()` 이 false 면
  `<div className="ml-auto flex shrink-0 items-center gap-2 pl-3 xl:gap-3 xl:pl-4">` 가
  **자식 0개인 빈 컨테이너**로 남는다. 131행 주석("헤더 CTA 를 걷어내 자리가 생겼으므로
  대표번호는 lg 부터 그대로 보인다")의 전제가 깨져, 데스크톱 헤더 우측에 **전환 수단이 0개**다.
  `Hero.tsx:184-217` 도 `lg:pt-12` + `mt-6` 만 남아 좌측 하단이 신뢰 칩 3개로만 채워진다.
- 왜 문제인가: 결함이라기보다 **C-07 수정의 미처리 귀결**이다. "전화 수단을 전부 내린다"는
  결정을 내렸는데, 그 자리를 무엇으로 채울지는 정하지 않았다. 레퍼런스 대조에서
  헤더 우측은 전환 접점이 들어가는 자리다.
- 조치: `hasTel()` 이 false 일 때 헤더 우측에 `#consult` CTA 버튼을 넣고
  (`Header.tsx:130-146` 을 `hasTel() ? 전화 : CTA` 로), `NEXT_PUBLIC_TEL` 이 채워지면
  자동으로 전화로 돌아가게 한다. `pl-3` 가 걸린 빈 `<div>` 도 함께 정리.

## D-40 [낮음] 죽은 에셋 5개와 미사용 prop 이 남아 있다

- 실제: `FE/public/` — `next.svg`·`vercel.svg`·`file.svg`·`globe.svg`·`window.svg`
  (`create-next-app` 기본 에셋, 코드 참조 0건). C-27 미해결.
  `FE/app/(admin)/admin/enroll-2fa/EnrollForm.tsx:14-19` — props 타입에 `enrollPath: string` 을
  **필수로 선언하고 구조분해에서 쓰지 않는다**(page.tsx:35 가 넘겨준다).
- 조치: 5개 파일 삭제. `EnrollForm` props 에서 `enrollPath` 제거(또는 사용).

## D-41 [낮음] `GOAL_PLAN.md` 의 C-11 설명이 현재 코드와 다르다

- 실제: "어드민 보안 라운드" C-11 행 — "로그인 라우트는 **verified TOTP 부재 시 403** 으로
  먼저 끊어 로그인/진입 루프를 막음". 현재 `FE/app/api/admin/login/route.ts:124-138` 은
  403 이 아니라 **세션을 유지한 채 `{ ok: true, enrollRequired: true }`** 를 돌려준다.
  문서 말미의 "자기 회귀 수정" 절이 새 동작을 적지만 **위쪽 표는 갱신되지 않았다**(D-10 과 같은 패턴).
- 조치: 해당 표 행을 갱신하거나 "→ 아래 '자기 회귀 수정' 절에서 변경됨" 을 명기.

---

# E. 목표 달성도 재평가 (GOAL_PLAN 6개 대목표)

"파일을 고쳤다"와 "라이브에 반영됐다"를 분리해 판정했다. 라이브 판정은 실측 근거만 쓴다.

| 목표 | 문서 표기 | 파일 | 라이브 | 판정 근거 |
|---|---|---|---|---|
| **G1** 요금 정합화 | `[x]`4 / `[~]`1 / `[ ]`1 | **90%** | **0%** | 시드 72행 작성 완료. 라이브 `plans` = **50행(구 시드)** 실측. 그 50행 중 12행에 레퍼런스 카피(D-03). G1-4 통신사 공식 대조 미완인 값을 공표 중이고 출처 표기도 사실과 다르다(D-08) |
| **G2** 탐나넷 수준 품질 | `[x]`4 / `[~]`3 / `[ ]`1 | **60%** | **55%** | 분량 2,939→7,328px·섹션 5→11 은 사실(메인 `#consult` 8개 실측). 미완 P0 3건(G-03 혜택 섹션 / G-05 LiveFeed 대체 / G-08 추천 행 강조)이 갭 문서에서 보이지 않는다(D-28). 모바일은 `LiveFeed` 미해결(D-29), 접근성 5건 미해결(D-14/15/16/22/32) |
| **G3** 어드민 엑셀 | `[x]`5 / `[ ]`1 | **75%** | **0%** | 코드는 거의 다 있다. 그러나 `SUPABASE_SERVICE_ROLE_KEY` **EMPTY** 실측 → 목록·상세·복호화·내보내기·상태변경이 **전부 fail-closed**. 004 를 쓰는 코드가 없어 적용해도 의존이 남는다(D-11). 실패 UX 미설계(D-18), 부분 실패 유실(D-19), 어드민 계정 미생성 |
| **G4** 색 구조 리팩터 | `[x]`7 / 7 | **95%** | **95%** | **6개 중 가장 실질적으로 완료된 목표.** 토큰·CTA 유틸·로고·대비 재검증이 코드에 있고 라이브에 반영된다. 남은 것은 포커스 링 2.88:1(D-20)과 `border-radius` 강제(D-21) — 둘 다 `globals.css` 두 줄 |
| **G5** 홍보 이미지 슬롯 구조 | `[x]`5 / 5 | **100%** | **100%** | `PromoSlot`·`PROMO_IMAGES`·데스크톱/모바일 분리·빈 슬롯 미렌더·가이드 문서 전부 확인. "코드 수정 없이 교체 가능" 주장도 검증됨 |
| **G6** 자체 홍보 이미지 | `[x]`4 / 4 | **100%** | **100%** | `FE/public/promo/check-three{,-m}.png` 실존, `afterJourney` 슬롯에 삽입됨, 숫자·수상·인증 표기 0 |

**전체 판정** — 파일 기준 약 **85%**, **라이브 기준 약 45%**.
그 격차의 거의 전부가 **두 개의 운영자 조치**에서 나온다 —
(1) 마이그레이션 005·003·004·006 적용, (2) `SUPABASE_SERVICE_ROLE_KEY` 기입 + 어드민 계정 생성.
이 둘이 끝나기 전에는 G1·G3 의 어떤 `[x]` 도 제품 상태를 서술하지 않는다.

## CLAUDE.md 절대 규칙 6개 현황 (라이브 기준)

| 규칙 | 상태 |
|---|---|
| 1. 가짜 접수 데이터 금지 / 5건 미만 미렌더 | **⚠ 구조적 미준수** — 우리는 만들지 않지만 외부인이 심을 수 있고(D-06), 5건 게이트가 뷰에 없어 QA 3행이 공개 노출 중(D-09) |
| 2. 개인정보·마케팅 동의 분리 | ✅ 준수 — `Field.tsx` `ConsentCheck` 2개, `validation.ts:34-37` 필수/선택 분리, 퀵상담바는 마케팅 미수집 |
| 3. 전화번호 평문 저장·로깅 금지 | ✅ 준수 — `crypto.ts` 3종, `leads` 직접 조회 anon 차단 실측(`[]`), 복호화 2경로 모두 `logAccess` 선행 |
| 4. `ENCRYPTION_KEY`/`PHONE_PEPPER` 환경변수 전용 | ✅ 준수 — DB 스키마에 없고, 라이브 HTML `grep` 0건 |
| 5. 레퍼런스 카피·이미지·CSS 복제 금지 | **❌ 위반 지속** — `plans.description` 12행이 우리 공개 REST 로 서비스 중(D-03) |
| 6. 과장 광고 문구 하드코딩 금지 | **❌ 위반** — "책임지고 수리"·"바로 받아"·"최대한 챙겨"가 설정값에는 있으나 **근거 없는 약속**(D-12)이고, 요금 출처 표기가 사실과 다르다(D-08) |

---

# F. 실행 순서 (치명 · 높음만)

## 0단계 — 운영자만 할 수 있는 것 (이것 없이는 아래 대부분이 무의미)

1. **D-02 / D-03 / D-04 / D-06** — 마이그레이션을 **`005` → `003` → `004` → `006`** 순서로 적용.
   단, `006` 은 **D-27 의 수정(`p_since` 제거)을 먼저 반영한 뒤** 적용한다.
   `003` 적용 전에 D-04 의 (a)/(b) 중 하나를 결정한다.
2. **D-03** — `BE/supabase/seed/plans_damoa_2026-10-08.sql` 적용 →
   `FE/lib/plans.ts:49` `SUPPRESS_PLAN_DESCRIPTION = false`.
3. **D-09** — QA 3행을 `status='SPAM'` 으로 변경(또는 삭제). 1·2보다 먼저 해도 된다.
4. **D-06** — 운영 Turnstile 키 발급 후 `FE/.env.local` 교체.
5. **G3 블로커** — `SUPABASE_SERVICE_ROLE_KEY` 기입 + 어드민 계정 생성.
   계정 생성 직후 **즉시 TOTP 등록**(D-17 의 창을 닫는 유일한 방법).

## 1단계 — 법적 리스크 (코드만으로 가능)

6. **D-04(b)** — `FE/lib/site-config.ts:236-241` `privacyDetail` ③ 보유기간을
   실제 DB 정책과 일치시킨다. 003 적용이 늦어질수록 이쪽이 정답이다.
7. **D-05** — `FE/content/privacy.mdx`·`terms.mdx` 작성 →
   `FE/components/sections/LegalLinks.tsx:65-75` 전문 렌더. 전문 전까지는 모달 제목을
   "개인정보 수집·이용 동의 내역" 으로 변경.
8. **D-01** — `site-config.ts` 에 `email` 필드 추가 + 6종 실제 값(운영자).
   동시에 `Footer.tsx` 가 **전 항목 placeholder 를 조용히 숨기지 못하게** 한다
   (런칭 전 체크 스크립트 또는 프로덕션 빌드 차단).
9. **D-08** — `FE/lib/legal-notices.ts:89, 120` 출처 문구 수정.
10. **D-12** — `FE/lib/site-config.ts:45, 101` 과장·모순 카피 3곳 수정.
11. **D-13** — `FE/components/sections/PlanCalculator.tsx` 휴대폰 축 제거(권고) 또는 전제 재정의.

## 2단계 — 보안

12. **D-07** — `FE/lib/admin/audit.ts` 에 `trustedClientIp()` 신설 →
    `app/api/leads/route.ts:18-21` 과 로그인 스로틀이 그것만 쓰게 한다.
13. **D-17** — `/admin/enroll-2fa` 를 1회용 토큰으로 게이트 + 등록 성공을 `access_logs` 에 기록.
14. **D-11** — 004 적용 후 `app/api/admin/leads/[id]/route.ts` 의 `createAdminClient()` 제거,
    11-14행 주석 교체.
15. **D-19** — `mark_leads_exported()` RPC 로 `exported_at` 단일 갱신 + "내보냄 해제" 경로.

## 3단계 — 기능·접근성

16. **D-18** — export 실패를 `303` + `?exportError=` 로 돌려 목록 배너로 표시.
17. **D-14** — `StickyConsultBar`·`BackToTop` 에 `inert`/`hidden`,
    `PromoBand` SSR 기본값을 전체 문장으로.
18. **D-15** — `Modal` 을 네이티브 `<dialog>` 로 교체, 바텀시트도 같은 컴포넌트로.
19. **D-16** — `StickyConsultBar` 입력 4칸에 `aria-label`.
20. **D-29** — `LiveFeed` 모바일 3열 전환. **리드가 5건에 도달하기 전에** 끝낸다.

## 4단계 — 문서 (다음 라운드의 오판을 막는 유일한 수단)

21. **D-10** — `GOAL_PLAN.md` 27·37·45·61·64행 체크박스를 정정 표대로 수정하고,
    항목 형식을 `[파일]`/`[라이브]` 2칸으로 바꾼다.
    **DB·환경변수 의존 항목은 라이브 칸이 비면 `[x]` 금지.**
22. **D-28** — `TAMNANET_GAP_ANALYSIS.md` P0 체크리스트 갱신 + 미완 P0 3건을 `GOAL_PLAN` 으로 승격.
23. **D-41** — `GOAL_PLAN.md` C-11 행을 현재 코드와 일치시킨다.

---

# 부록 1 — 1라운드 46건 추적

| 상태 | 항목 |
|---|---|
| **해소 확인(실측)** | C-06 접수 500 / C-07 대표번호 폴백 / C-13 export CSRF / C-21 비JSON 흡수 / C-23 락아웃(단 D-07 로 우회) / C-40 평점 날조 |
| **해소 확인(코드 판독)** | C-19 LeadForm 라벨 / C-22 어드민 오류 노출(배너 분리) / C-26·C-29·C-31 대비 토큰 / C-25 `Reveal` SSR 가시성(적용 범위는 D-31) / C-33 암호화 호출 예외 |
| **파일만 고침 · 라이브 미반영** | C-01(D-02) / C-02(D-03) / C-03(D-04) / C-09·C-35(D-09) / C-30(D-06) |
| **부분 해소 · 새 문제 발생** | C-04(D-01) / C-11(D-17) / C-14(D-26) / C-12(D-19) |
| **미착수** | C-05(D-05) / C-15(D-29) / C-16(D-13) / C-18(D-12) / C-20(D-25) / C-27(D-40) / C-32(D-06) / C-34(D-06) / C-36·C-38(D-14) / C-37(D-15) / C-41(D-24) / C-42(D-30) / C-43 / C-44(D-16) / C-45(D-32) / C-46 |
| **판정 보류** | C-24 번들 크기(`next build` 금지로 미측정) / C-28 SEO(D-33 으로 승계) |

# 부록 2 — 미확인으로 남긴 것 (추측하지 않는다)

1. **390px 실측** — 브라우저 창 하한이 500px 이라 D-29·D-24 의 수치는 **마크업 기반 계산**이다.
   실기기 또는 CDP `Emulation.setDeviceMetricsOverride` 로 재확인이 필요하다.
2. **번들 크기 / LCP** — `npx next build` 금지로 측정하지 않았다. C-24 는 판정 보류.
3. **2FA 등록 E2E** — 어드민 계정이 없어 `mfa.enroll()` → `challengeAndVerify()` 왕복을
   실행하지 못했다. 특히 `@supabase/ssr` 의 쿠키 `httpOnly` 설정에 따라
   `EnrollForm`(브라우저 클라이언트)이 서버 라우트가 심은 aal1 세션을 읽지 못할 가능성이 있다
   (읽지 못하면 "Auth session missing" 으로 등록 페이지가 죽는다). **첫 로그인 전 반드시 확인할 것.**
4. **Supabase 세션 쿠키의 `SameSite`** — D-36 의 방어가 여기에 달려 있는데 확인하지 못했다.
5. **`exported_at` 부분 실패 재현** — 300건 이상 데이터가 없어 D-19 는 코드 판독만으로 판정했다.
6. **`live_feed` 뷰의 `security_invoker`** — 005 도 설정하지 않았다. 공개 라이브 피드라는
   설계상 definer 뷰가 의도일 수 있으나, 문서에 그 판단이 적혀 있지 않아 의도인지 누락인지
   단정하지 못했다.
