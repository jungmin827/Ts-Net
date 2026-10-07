# CRITIQUE_01 — "완료" 주장 검증 보고서

- 작성: 2026-10-08 03:0x KST (비평 에이전트)
- 검증 수단: `curl http://localhost:3100`, Supabase REST(anon 키) 직접 호출,
  `npx tsc --noEmit`, `npx eslint .`, `npx next build --turbopack`, 소스 정독
- `npx tsc --noEmit` **통과(0건)**, `npx eslint .` **통과(0건)**,
  `next build` **성공(15/15 static)**. → 품질 게이트 1번은 사실이다.
  그러나 **타입이 맞는 것과 제품이 맞는 것은 다르다.** 아래가 그 차이다.

## 읽은 시점 고정 (동시 수정 중인 파일)

다른 작업자가 작업 중이라 아래 파일은 **읽은 시점**을 명시한다. 그 뒤 바뀌었을 수 있다.
- `FE/app/(site)/page.tsx` — 02:5x 1차 / **03:04 재확인**(`ConsultGuide`·`Faq`·`PrivacyPromise`·`CarrierMatrix` 추가됨)
- `FE/lib/site-config.ts` — 03:00
- `FE/components/sections/PlanCalculator.tsx` — 03:0x (`chip()` 이 `bg-brand-dark` 로 **이미 수정됨** — 대비비 통과)
- `FE/components/ui/SectionHeading.tsx` — 03:0x (eyebrow 가 `text-brand-deep` 로 **이미 수정됨**)
- `FE/components/sections/{Faq,PlanNotice,PrivacyPromise,ConsultGuide,CarrierMatrix}.tsx` — 03:00~03:05 사이 신설

---

# A. 규칙 위반

## C-01 [치명] anon 키로 `purge_expired_leads()` / `purge_old_access_logs()` 를 직접 호출할 수 있다 — 전체 리드 파기와 접속기록 삭제가 비인증 공개 엔드포인트다

- 주장: `GOAL_PLAN.md` 어디에도 이 항목이 없다. `001_init_schema.sql:277` 주석은
  "pg_cron 으로 매일 03:00 KST 실행"이라고만 적혀 있다 — 호출 주체가 cron 뿐이라는 전제.
- 실제: `BE/supabase/migrations/001_init_schema.sql:280-304` 의 두 함수는
  `language plpgsql security definer` 인데 **`revoke execute from anon` 이 없다.**
  Supabase 는 `public` 스키마 함수를 PostgREST 로 `anon` 에 노출한다.
  실측 (브라우저 번들에 박히는 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 만 사용):
  ```
  POST /rest/v1/rpc/purge_expired_leads    → 200  "0"   (3회 반복 모두 실행됨)
  POST /rest/v1/rpc/purge_old_access_logs  → 204
  ```
  `grep -n "grant\|revoke" BE/supabase/migrations/*.sql` → **0건**. 권한 축소가 한 줄도 없다.
- 왜 문제인가:
  1. `purge_expired_leads` 는 `delete from leads where purge_at < current_date` 를 실행한다.
     지금은 `purge_at` 기본값이 `now()+2y`(001:77) 라서 0행이 지워진다. 그런데
     **C-03 을 고치려고 마이그레이션 003 을 적용하는 순간 `purge_at` 이 접수일+14일이 된다.**
     그때부터는 아무나 이 URL 을 치면 14일 지난 모든 리드가 영구 삭제된다. 이 사이트의
     유일한 자산이 공개 삭제 버튼 뒤에 있게 된다.
  2. 지금도 피해가 있다. 이 함수는 호출마다 `access_logs` 에 DELETE 행을 1건 INSERT 한다
     (001:287-288). 공격자가 루프로 돌리면 **법정 보관 대상 테이블이 쓰레기 행으로 무한 증식**한다.
     Cloudflare WAF 는 Supabase 도메인 앞에 없으므로 막히지 않는다.
  3. `purge_old_access_logs` 는 접속기록(법정 1년 보관) 삭제 함수다. 비인증 호출이 가능한 것
     자체가 개인정보 안전성 확보조치 기준 위반 소지다.
- 조치: `BE/supabase/migrations/005_lock_down_maintenance_functions.sql` 신설 —
  ```sql
  revoke all on function purge_expired_leads()   from anon, authenticated, public;
  revoke all on function purge_old_access_logs() from anon, authenticated, public;
  -- cron 은 postgres 롤로 돌므로 영향 없음
  ```
  그리고 `is_admin()` 도 같이 점검할 것 (현재 anon 호출 시 200 `false` 반환 — 정보노출은 없지만
  공개 노출 자체를 줄이는 편이 낫다). **이 마이그레이션은 003 보다 먼저 적용해야 한다.**

## C-02 [치명] 라이브 DB의 `plans.description` 12행에 레퍼런스 사이트 마케팅 카피가 그대로 남아 4개 서브페이지에 렌더되고 있다 (규칙 5 위반)

- 주장: `BE/supabase/seed/plans_2026-09-28.sql:5-8` —
  "description 컬럼에 레퍼런스 사이트의 마케팅 카피가 그대로 들어 있었다. 규칙 5 위반이라
  2026-10-08 에 **전부 NULL 로 비웠다**."
  `plans_damoa_2026-10-08.sql:30-32` — "원문 마케팅 카피는 **일절 옮기지 않았다**.
  추천카드 3종의 설명문은 전부 홍보 문구이므로 description = NULL."
  `GOAL_PLAN.md:27` G1-1 `[x]`, `:35` G1-6 `[x]`.
- 실제: **파일은 고쳤지만 DB 는 안 고쳤다.** anon 키로 직접 확인:
  ```
  GET /rest/v1/plans?select=carrier,name,description&description=not.is.null  → 12행
    KT      / 인터넷와이드  / "끊김 없이, 빠르게! 유선통신 중심 DPS"
    KT      / KT 오피스넷   / "속도와 안정성의 만남, 유선 DPS 솔루션!"
    KT      / 프리미엄 결합 / "미세한 변화까지 감지하는 스마트 TPS!"
    SK·LG·SKYLIFE 도 동일 3문구 반복 (총 12행)
  GET /rest/v1/plans?select=id (Prefer: count=exact) → content-range: 0-49/50
  ```
  **50행이다. 다모아 신규 시드는 72행이다 → 신규 시드는 적용된 적이 없다.**
  라이브 DB 에는 "폐기(실행하지 말 것)" 라고 적힌 구 시드가 그대로 들어 있다.
  `curl localhost:3100/kt` 본문에 위 3문구가 **전부 출력된다** (추천 상품 카드 3장).
  `/sk` `/lg` `/skylife` 도 같은 문구를 쓴다.
- 왜 문제인가: CLAUDE.md 절대조항 5번("레퍼런스 사이트의 문구·이미지·CSS를 복제하지 않는다")의
  직접 위반이 **4개 페이지 × 3장 = 12개 카드에 현재 라이브로 노출 중**이다. 감탄사까지 동일한
  카피라 우연 일치로 변명할 수 없다. 저작권 분쟁 시 커밋 이력이 "알고도 안 고쳤다"는 증거가 된다.
  동시에 G1-1/G1-2/G1-6 의 `[x]` 는 **"수집·정리는 끝났다"일 뿐 "반영은 안 됐다"** 이므로
  완료 표시가 과장이다.
- 조치: ① 즉시 `psql "$DB_URL" -f BE/supabase/seed/plans_damoa_2026-10-08.sql` 실행
  (파일 헤더에 `delete from plans where carrier in (...)` 가 있어 교체된다).
  ② 적용 후 `GET /rest/v1/plans?description=not.is.null` 이 0행, `count` 가 72 인지 확인.
  ③ `GOAL_PLAN.md` G1 항목을 "시드 파일 작성 완료 / **DB 반영 미완**" 으로 쪼갤 것.
  G1-5 에 적힌 블로커 사유("`SUPABASE_SERVICE_ROLE_KEY` 미기입")는 **틀렸다** —
  `plans` 는 `lib/supabase/public.ts` 의 anon 키로 읽고, 시드 적용은 psql 로 하므로
  service_role 키와 무관하다. 블로커가 아니라 **그냥 안 한 일**이다.

## C-03 [치명] 화면이 고지한 보유기간(D+14 / D+1095)과 실제 DB 보관(2년)이 다르다 — 마이그레이션 003 미적용 실측 확인

- 주장: `FE/lib/site-config.ts:451` — "보유기간 → `BE/supabase/migrations/003_purge_at_by_status.sql`
  (접수일 기준으로 purge_at 을 계산하는 트리거)". 그 근거로 `PRIVACY_PROMISE` 가
  **"보유기간이 지나면 파기합니다 / 접수일을 기준으로 보유기간을 미리 계산해 두고, 기간이 지난
  접수는 복구할 수 없게 파기합니다"** 를 메인 페이지에 단정문으로 출력한다 (03:04 실측 확인).
- 실제: 003 은 **DB 에 적용되지 않았다.** 실측:
  ```
  POST /rest/v1/rpc/lead_is_activated   → 404 PGRST202 (함수 없음)   ← 003 전용 함수
  POST /rest/v1/rpc/purge_expired_leads → 200                        ← 001 은 적용됨
  ```
  `git status` 상 `003_purge_at_by_status.sql` 은 `??`(미추적) — 커밋조차 안 됐다.
  따라서 라이브 `leads.purge_at` 기본값은 `001_init_schema.sql:77` 의 `(now() + interval '2 years')::date` 다.
  게다가 파기 cron 은 `001:295` 에서 **주석 처리**되어 있고(`-- select cron.schedule(...)`),
  `GOAL_PLAN.md:131` 도 "대시보드 후속: pg_cron 스케줄" 미완으로 적어 뒀다.
  → 현재 **파기되는 리드는 0건**이다.
- 왜 문제인가: 화면 고지(`CONSENT.privacyDetail` ③ "단순상담시 D+14일")보다 **실제 보관이
  52배 길다(730일).** 개인정보보호법상 고지 < 실제 보관은 위법이다. 그리고 `PRIVACY_PROMISE` 의
  "기간이 지난 접수는 복구할 수 없게 파기합니다" 는 **현재 구현이 전혀 받쳐주지 않는 문장**이다.
  site-config.ts:456-457 주석이 스스로 "구현이 받쳐주지 않는 문장은 과장광고이자 허위 고지가
  된다"고 써 놓고, 바로 그 상태로 배포되어 있다.
  `GOAL_PLAN.md:119` 는 이걸 "열린 결정"으로 미뤄 두었는데, **이미 공개 문장이 나간 뒤라
  열린 결정이 아니라 진행 중인 위반**이다.
- 조치: 순서를 지켜야 한다.
  1. **C-01 을 먼저 적용**한다 (anon 이 파기 함수를 못 치게 막은 뒤에).
  2. 운영 흐름을 먼저 정한다 — 14일 안에 반드시 엑셀 내보내기를 한다는 전제가 성립하는가?
     성립하지 않으면 `003` 을 적용하지 말고 **`CONSENT.privacyDetail` ③ 문구를 실제 주기로 고친다**
     (003 파일 15-16행이 같은 결론을 적어 뒀다).
  3. 어느 쪽이든 `pg_cron` 스케줄을 실제로 등록해야 "파기합니다" 가 사실이 된다.
     등록 전까지는 `PRIVACY_PROMISE.points[3]` 를 내리거나 "보유기간을 미리 계산해 둡니다" 수준으로
     약화할 것.

## C-04 [치명] 푸터 사업자정보 6종이 `TODO ...` 그대로 라이브 노출 — 전자상거래법 표시의무 위반

- 주장: `FE/components/sections/Footer.tsx:7` — "사업자 정보 6종 표기는 법적 필수(런칭 전 체크리스트)".
  `site-config.ts:3` — "TODO 항목은 사업자 정보 확정 후 실제 값으로 교체할 것".
- 실제: `site-config.ts:17-24` 가 전부 문자열 `"TODO 상호"` 등이고,
  `Footer.tsx:68-82` 가 그 값을 `<dd>` 에 그대로 찍는다. `curl localhost:3100` 본문 실측:
  ```
  상호 TODO 상호 | 대표자 TODO 대표자 | 사업자등록번호 TODO 사업자등록번호
  부가통신사업 신고번호 TODO 부가통신사업 신고번호 | 통신판매업 신고번호 TODO 통신판매업 신고번호
  주소 TODO 주소
  ```
  `/kt` 등 모든 페이지에서 동일하게 출력된다 (푸터는 `(site)/layout.tsx:16`).
- 왜 문제인가: 전자상거래법 제10조는 상호·대표자·주소·사업자등록번호·통신판매업 신고번호의
  표시를 의무화한다. 미표시가 아니라 **"TODO"라는 플레이스홀더를 표시**하는 쪽이 더 나쁘다 —
  방문자에게 "운영 주체 불명 사이트"로 읽히고, 개인정보를 요구하는 폼과 같은 화면에 있다.
  전환율 측면에서도 신뢰 블록이 전무한(갭 리포트 G-04) 상태에서 푸터까지 TODO 면 치명적이다.
- 조치: `FE/lib/site-config.ts:17-24` 를 실제 값으로 교체. 값이 아직 없으면
  `Footer.tsx:76` 의 `.map` 에서 `value.startsWith("TODO")` 인 항목을 **미렌더**로 바꿔
  최소한 "TODO"라는 글자가 공개되지 않게 할 것(임시 조치). 근본 해결은 사업자 정보 확정이다.

## C-05 [치명] "개인정보처리방침" 모달이 동의 문구 4줄로 대체되어 있다 — 법정 기재항목 전무

- 주장: `Footer.tsx:8` — "이용약관·개인정보처리방침은 LegalLinks 가 모달로 연다
  (전문은 content/*.mdx 작성 후 교체)". CLAUDE.md 디렉터리 규약은
  `FE/content/ terms.mdx, privacy.mdx (약관)` 를 명시한다.
- 실제: `ls FE/content` → **빈 디렉터리(0 파일)**.
  `FE/components/sections/LegalLinks.tsx:63-73` 의 개인정보처리방침 모달 본문은
  `CONSENT.privacyDetail` 4줄(수집목적/수집항목/보유기간/거부권)을 그대로 재출력한다.
  이용약관 모달(`:20-25`)은 4줄짜리 안내문이고 그중 한 줄이
  `"약관 전문은 준비 중입니다. 그 전까지 문의는 대표번호 1600-0000 로 받습니다."` 다.
- 왜 문제인가: 개인정보보호법 제30조가 요구하는 처리방침 기재항목 중
  **개인정보 보호책임자 성명·연락처 / 처리위탁 현황 / 제3자 제공 / 파기 절차 및 방법 /
  정보주체 권리행사 방법 / 열람청구 접수부서 / 권익침해 구제방법** 이 **하나도 없다.**
  특히 이 사이트는 Supabase(DB)·Vercel(호스팅)·Cloudflare 에 개인정보 처리를 위탁하므로
  수탁자 고지가 필수다. 상담사에게 엑셀로 배분하는 것도 제3자 제공/위탁에 해당한다.
  또 "약관 전문은 준비 중입니다" 가 **공개 문장으로 나가 있다** — 미완성 사이트라는 자기 고백이
  연락처를 남길지 망설이는 지점 바로 아래에 붙어 있다.
- 조치: `FE/content/privacy.mdx` 를 법정 9항목으로 작성하고 `LegalLinks.tsx:63-73` 을 그 본문으로
  교체. 최소한 **엑셀 내보내기 → 오프라인 배분**(CLAUDE.md 확정사항)을 제3자 제공/위탁 항목에
  반드시 기재해야 한다. 작성 전까지는 폼 제출을 막는 쪽이 법적으로 안전하다.

## C-06 [치명 → 2차에서 해소됨] `/api/leads` 가 HTTP 500 을 반환한다 — 사이트의 유일한 목적인 접수가 완전히 막혀 있다

> **상태 (2026-10-08 03:2x 재확인):** 조정자가 INSERT 를 anon 클라이언트로 전환해
> **`POST /api/leads` → 201 `{"ok":true}`** 를 실측 확인했다. 아래 1차 기술은 발견 당시
> 기록으로 남긴다. 다만 조치 3번(레이트리밋 분리)의 구현 방식과 잔여 결함은
> **C-30**(fail-open 평가)·**C-33**(암호화 호출이 여전히 try 밖)에서 다시 다룬다.
> 아래 "조치 2번"(본문 없는 500 → JSON 500)은 **아직 미적용**이다.

- 주장: `GOAL_PLAN.md` 진행상태 — "`/api/leads` 접수 파이프라인 + `/api/feed/live`" `[x]`.
  CLAUDE.md 현재 진행 상태에도 `[x]`.
- 실제: 실측.
  ```
  POST /api/leads  {"name":"홍길동","phone":"010-1234-5678","consent_privacy":true,
                    "consent_marketing":false,"turnstileToken":"...","website":""}
  → HTTP/1.1 500 Internal Server Error   (본문 완전히 비어 있음)
  ```
  원인: `.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 가 **빈 값**(실측: 길이 0)이고,
  `app/api/leads/route.ts:59` 가 `createAdminClient()` 를 호출하면
  `lib/supabase/admin.ts:10` 이 `throw new Error(...)` 한다. 이 throw 가 **아무 곳에서도
  catch 되지 않는다** → Next 가 본문 없는 500 을 돌려준다.
- 왜 문제인가:
  1. 접수가 0건이다. 랜딩·요금표·계산기·FAQ 를 다 만들어도 제품이 작동하지 않는다.
  2. **설계상 불필요한 의존이다.** `001_init_schema.sql:242-244` 의
     `leads_public_insert` 정책은 `anon` 의 INSERT 를 이미 허용한다. 즉 접수 INSERT 자체는
     anon 키로 가능한데, rate limit 용 `SELECT count`(route.ts:64-68) 때문에 service_role 로
     묶어 버려서 **가장 중요한 엔드포인트가 가장 민감한 비밀에 종속**됐다.
     service_role 키 하나가 비면 사이트가 죽는 구조다.
  3. 클라이언트 쪽 오안내도 생긴다 — `useLeadSubmit.ts:90` 의 `await res.json()` 이 빈 본문에서
     throw 하고 `:97` catch 로 떨어져 사용자에게 **"네트워크 오류입니다"** 라고 뜬다.
     서버 설정 오류인데 사용자 네트워크 탓으로 돌린다.
- 조치:
  1. `SUPABASE_SERVICE_ROLE_KEY` 기입 (운영자 조치, `BE/README.md` 5~8번).
  2. 그와 별개로 `route.ts:59` 를 `try { ... } catch` 로 감싸
     `{ok:false,error:"일시적인 오류입니다..."}` + 500 **JSON** 을 반환하도록 고칠 것.
     본문 없는 500 은 클라이언트가 해석할 수 없다.
  3. 중기적으로 rate limit 을 `leads` SELECT 대신 별도 수단(Cloudflare Rate limit, 또는
     `security definer` RPC `lead_rate_check(ip)` 한 개)으로 옮겨 **접수 경로를 anon 키만으로
     성립**시킬 것. 그러면 service_role 분실·미기입이 전환을 막지 않는다.

## C-07 [치명] 대표번호가 `1600-0000`(무효 번호)이고 `tel:` 링크 7곳이 거기를 가리킨다

- 주장: `TAMNANET_GAP_ANALYSIS.md:952` 0차 선행 이슈 — "`SITE.tel` 자리표시자(`1600-0000`)
  교체 — 현재 `tel:` 링크 14개가 무효 번호를 가리킨다". **미해소 상태로 남아 있다.**
- 실제: `.env.local` 의 `NEXT_PUBLIC_TEL` 이 **빈 값** → `site-config.ts:15` 의 폴백
  `"1600-0000"` 이 적용된다. `curl localhost:3100` 실측 `href="tel:1600-0000"` **6건**
  + 푸터 본문 텍스트 1건 = 화면상 7곳. `/kt` 에도 동일.
- 왜 문제인가: 모바일 방문자의 1순위 행동이 전화다. 헤더·하단 고정바·푸터 전환 밴드의
  전화 버튼을 누르면 연결되지 않는다. 폼 접수도 막혀 있으므로(C-06) **지금 이 사이트에는
  작동하는 전환 경로가 0개**다. 또한 "대표번호 1600-0000" 이 푸터 법적 고지문에 들어가 있어
  허위 연락처 표시가 된다.
- 조치: `.env.local` 의 `NEXT_PUBLIC_TEL` 기입. 동시에 `site-config.ts:15` 의 폴백을
  빈 문자열로 바꾸고, `Header`/`Footer`/`StickyConsultBar` 에서 `SITE.tel` 이 비면
  전화 버튼을 **렌더하지 않도록** 할 것. 폴백 번호가 있으면 미설정이 조용히 숨는다 —
  지금처럼.

## C-08 [치명] 메인 `PriceCompare` 가 미검증 타사 게시 금액을, 시드 자신이 "불일치"로 경고한 값까지 포함해 우리 요금으로 공표한다

- 주장: `GOAL_PLAN.md:43` G2-3 `[x]` — "가격 비교 막대차트 — **경쟁사 대비가 아니라 우리가 파는
  4사 비교**라 표시광고법 리스크가 없다". `lib/plans.ts:146-152` 도 같은 논리.
  한편 `GOAL_PLAN.md:33` G1-4 — "통신사 공식 고지 요금과 **교차 검증** (런칭 전 필수, 표시광고법)"
  은 **`[ ]` 미완**이다.
- 실제: `curl localhost:3100` 실측, 메인에 다음이 렌더된다.
  ```
  인터넷 500M + TV · 월 납부요금
  37,400원 KT스카이라이프 TV베이직 / 45,100원 KT TV베이직
  45,100원 LG유플러스 TV실속형 / 48,400원 SK브로드밴드 TV이코노미
  ```
  이 중 **SK 48,400원은 시드 헤더가 직접 경고한 불일치 B** 다
  (`plans_damoa_2026-10-08.sql:46-48`: "요금표 48,400원 / 계산기 42,900원 / 추천카드 42,900원").
  `/kt` 에는 불일치 A(1G 할인 전 56,000원)도 그대로 출력된다.
  그리고 C-02 대로 라이브 DB 는 다모아 시드도 아닌 **폐기된 구 시드(50행)** 다.
- 왜 문제인가:
  1. G2-3 의 "리스크가 없다"는 **범위를 잘못 잡은 안심**이다. 리스크는 "타사와 비교했는가"가
     아니라 "**우리가 제시한 금액이 실제 체결 가능한 금액인가**"다. 표시광고법상 문제가 되는 건
     비교 구조가 아니라 허위·과장 가격 표시다. 지금 숫자는 (a) 통신사 공식 고지와 미대조(G1-4 미완),
     (b) 출처 사이트 내부에서조차 서로 다른 값, (c) 우리 계약 조건과 무관.
  2. 차트는 **싼 순서로 정렬**(`lib/plans.ts:189`)해 SKYLIFE 37,400원을 맨 앞에 둔다.
     그런데 TV 등급이 각각 TV베이직/TV실속형/TV이코노미로 **서로 다른 상품**이다.
     "같은 조건, 통신사별 월 요금"이라는 섹션 제목과 모순된다. 하단 각주로 면책하고 있지만,
     막대 길이와 정렬이 주는 1차 메시지는 "스카이라이프가 가장 싸다"다.
  3. G1-4 가 미완인데 그 데이터를 쓰는 G2-3 이 먼저 `[x]` 로 완료 처리됐다 — **의존 순서 역전**이다.
- 조치: ① G1-4 가 끝나기 전까지 `PriceCompare` 를 `page.tsx` 에서 내리거나
  `site-config.ts` 에 `PRICE_COMPARE = { enabled: false }` 플래그를 두고 기본 비활성.
  ② 섹션 제목 "같은 조건"을 삭제 — 같은 조건이 아니다. "통신사별 500M+TV 최저 구성"처럼
  사실만 쓸 것. ③ 정렬을 금액순이 아니라 통신사 고정순(KT/SK/LG/SKYLIFE)으로 바꿔
  "순위" 로 읽히지 않게 할 것. ④ `legal-notices.ts` 의 `PRICE_SOURCE.verified` 가 false 인 동안
  차트를 렌더하지 않는 가드를 `PriceCompare.tsx` 에 넣는 것이 가장 안전하다.

## C-09 [높음] `live_feed` 뷰에 `security_invoker` 가 없어 anon 이 5건 게이트를 우회해 직접 읽을 수 있다 (런타임 미확인)

- 주장: CLAUDE.md 절대조항 1 — "건수가 5건 미만이면 섹션 자체를 렌더링하지 않는다".
  구현은 `app/api/feed/live/route.ts:24` 의 `items.length < MIN_ITEMS ? [] : items` 한 곳뿐이다.
- 실제: `BE/supabase/migrations/001_init_schema.sql:207` —
  `create or replace view live_feed as select ... from leads ...` 에
  **`with (security_invoker = true)` 가 없다.** PostgreSQL 기본값에서 뷰는 **소유자 권한**으로
  실행되므로 기반 테이블 `leads` 의 RLS(`leads_admin_select`)가 평가되지 않는다.
  Supabase 는 `public` 스키마 뷰를 PostgREST 로 `anon` 에 노출한다.
  마이그레이션 전체에 `revoke` 가 0건(C-01 참조)이다.
  **런타임 미확인**: `GET /rest/v1/live_feed?select=*` 는 200 `[]` 를 돌려줬지만
  현재 `leads` 가 0행이라 "RLS 차단"과 "데이터 없음"을 구분할 수 없었다. 리드 1건이 들어오면
  바로 판정 가능하다.
- 왜 문제인가: 뷰가 anon 에 열려 있으면 ① 5건 미만이어도 마스킹 데이터가 외부에서 조회되어
  절대조항 1의 게이트가 무력화되고(게이트가 DB 가 아니라 Next 라우트에만 있다),
  ② 접수일·통신사·이름 첫 글자·진행상태가 외부에 상시 공개된다. 마스킹돼 있어도
  "어느 날 몇 건이 들어왔는지"는 영업 정보다.
- 조치: `005` 마이그레이션에 함께 넣을 것 —
  ```sql
  alter view live_feed set (security_invoker = true);
  revoke all on live_feed from anon;          -- 서버(service_role)만 읽는다
  ```
  그리고 **5건 게이트를 뷰 안으로 옮기는 편이 근본적**이다 (예: `where (select count(*) from leads
  where status not in ('CANCEL','SPAM')) >= 5`). 그러면 어느 경로로 읽어도 규칙이 지켜진다.

## C-10 [확인됨·위반 없음] 규칙 2·3·4 와 가짜 데이터 금지는 지켜지고 있다

비판 대상이 아니라 **오탐을 막기 위해** 기록한다. 아래는 실측으로 문제가 없었다.
- **규칙 2 (동의 분리)**: `lib/validation.ts:31-32` `consent_privacy: z.literal(true)` /
  `consent_marketing: z.boolean().default(false)`. UI 는 `components/ui/Field.tsx:28` `ConsentCheck`
  2개 분리(`LeadForm.tsx:195-207`), 초기값 둘 다 `useState(false)`(`LeadForm.tsx:33-34`).
  **기본 체크된 곳 없음.** 라이브 HTML 에서도 `[필수]`/`[선택]` 분리 확인.
- **규칙 3 (평문 미저장·미로깅)**: `lib/crypto.ts` 를 import 하는 곳은
  `api/leads/route.ts`, `api/admin/leads/[id]/decrypt/route.ts`, `api/admin/export/route.ts` **3곳뿐**.
  복호화 2곳 모두 `logAccess`(실패 시 throw)를 **복호화 앞에** 두고 실패 시 반환하지 않는다
  (decrypt:41-60, export:80-103). 목록·상세는 `LEAD_LIST/DETAIL_COLUMNS`(`lib/admin/leads.ts:9-15`)에
  `phone_enc` 가 아예 없어 암호문이 메모리에도 안 올라온다. `route.ts:116` 은 `error.code`·`message`
  만 로깅. `PhoneReveal.tsx` 는 "가리기"로 상태를 비운다.
- **규칙 4 (키 미유출)**: `'use client'` 파일 중 `lib/crypto`·`supabase/admin`·`lib/audit` 를
  import 하는 것 **0건**. `.next` 번들에서 실제 `ENCRYPTION_KEY`(64자)·`PHONE_PEPPER`(64자)
  문자열 검색 → **0건**.
- **가짜 데이터 금지**: 시드·스크립트·테스트 어디에도 `leads` INSERT 가 없다.
  `LiveFeed.tsx:35` `items.length === 0 → return null`, `api/feed/live` 가 5건 미만에 `[]`.
  라이브 메인에 실시간 현황 섹션이 **렌더되지 않음** 확인.
- **gift_amount**: DB 50행 전부 NULL, `/kt` 요금표에 사은품 열 **미렌더**(G-07 해소됨).

---

# B. "완료" 주장 검증 — 실제로 안 된 것

## C-11 [높음] G3-2 "TOTP 2FA, aal2 요구" — 2FA 를 등록하지 않은 계정은 비밀번호만으로 통과한다

- 주장: `GOAL_PLAN.md:56` G3-2 `[x]` — "로그인 (Supabase Auth + TOTP 2FA, **aal2 요구**)".
  CLAUDE.md 확정사항 — "어드민: **단일 계정 1개 + 2FA**".
- 실제: `FE/lib/admin/auth.ts:56-59`
  ```ts
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { ok: false, reason: "MFA_REQUIRED" };
  }
  ```
  `nextLevel` 은 **등록된 factor 가 있을 때만** `"aal2"` 가 된다. TOTP 미등록 계정은
  `nextLevel === "aal1"` 이므로 이 분기를 지나가고 `{ok:true}` 가 된다.
  `api/admin/login/route.ts:87` 도 동일한 조건(`needsMfa`)이라 **코드 입력 단계를 건너뛰고
  바로 세션이 발급된다.** `GOAL_PLAN.md:133` 블로커 2번이 "TOTP 등록" 미완이라고 적혀 있으니,
  계정이 만들어지는 순간 **2FA 없는 어드민**이 실제로 가능해진다.
- 왜 문제인가: "aal2 요구"는 **조건부 요구**다. 운영자가 TOTP 등록을 잊으면 비밀번호 한 개가
  전체 리드 DB(복호화 + 엑셀 반출 포함)의 유일한 방어선이 된다. 더 나쁜 건 이 상태가
  **에러 없이 조용히 통과**한다는 점 — 운영자는 2FA 가 켜진 줄 알고 쓴다.
  `/api/admin/login` 에 rate limit 도 없어(C-13) 비밀번호 단독 방어가 더 약하다.
- 조치: `lib/admin/auth.ts:56-59` 를 "factor 가 없으면 **거부**" 로 바꿀 것.
  ```ts
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.filter(f => f.status === "verified") ?? [];
  if (verified.length === 0) return { ok:false, reason:"MFA_NOT_ENROLLED" };
  if (aal?.currentLevel !== "aal2") return { ok:false, reason:"MFA_REQUIRED" };
  ```
  `/admin/login` 에 `MFA_NOT_ENROLLED` 안내(= 등록 유도)를 추가. 등록 화면이 없으면
  Supabase 대시보드 절차를 `BE/README.md` 에 명시.

## C-12 [높음] G3-5 "`exported_at` 갱신 실패 시 파일 미전달" — 청크 중간 실패 시 일부 행만 exported 로 찍히고 파일은 안 나간다 (배분 누락)

- 주장: `GOAL_PLAN.md:59-60` G3-5 `[x]` — "감사로그를 **복호화 전에** 기록,
  `exported_at` 갱신 실패 시 파일 미전달".
- 실제: `FE/app/api/admin/export/route.ts:136-160`
  ```ts
  for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {       // UPDATE_CHUNK = 300
    const chunk = ids.slice(i, i + UPDATE_CHUNK);
    const { error: updateError } = await guard.supabase.from("leads")
      .update({ exported_at: exportedAt }).in("id", chunk);
    if (updateError) { ...; return NextResponse.json({...}, { status: 500 }); }
  }
  ```
  트랜잭션이 아니다. 301~600번째 행 청크에서 실패하면 **1~300번째 행은 이미
  `exported_at` 이 찍힌 상태**로 남고, 함수는 500 을 반환하며 파일은 전달하지 않는다.
- 왜 문제인가: `exported_at` 은 "미내보내기만" 필터(`lib/admin/filters.ts:42`,
  `lib/admin/leads.ts:99`)의 유일한 근거다. 즉 **파일로 받은 적 없는 300건이
  영구히 "이미 내보냄" 으로 분류**된다. 상담사에게 절대 배분되지 않고, 어드민 UI 에
  `exported_at` 을 되돌리는 수단도 없다. 리드 수집 사이트에서 이건 매출 손실이다.
  게다가 `access_logs` 에는 EXPORT 가 전체 건수로 이미 기록되어(`:81-93`) 감사 기록과
  실제 반출 사실도 어긋난다.
- 조치: ① `exported_at` 갱신을 단일 RPC 트랜잭션으로 옮긴다 —
  `create function mark_leads_exported(p_ids bigint[], p_at timestamptz)` 를 만들고
  한 번만 호출. ② 또는 최소 조치로, 실패 시 **이미 찍은 청크를 롤백**(`update ... set
  exported_at = null where id in (성공한 id들) and exported_at = exportedAt`)하는 보상 로직 추가.
  ③ 어드민 상세에 "내보냄 표시 해제" 버튼을 추가해 수동 복구 경로를 남길 것.

## C-13 [높음] `/api/admin/export` 가 상태를 바꾸는 GET 이고 `<a href>` 로 호출된다 — CSRF 로 전 건을 "내보냄" 처리할 수 있다

- 주장: `GOAL_PLAN.md:59` G3-5 `[x]`. CLAUDE.md 코딩 규칙 — "폼 제출은 Route Handler 로 받는다
  (Turnstile 검증·rate limit·감사로그를 한 곳에 모으기 위함)" — 안전성 설계 의도가 명시돼 있다.
- 실제: `app/api/admin/export/route.ts:35` `export async function GET(req)` 이고,
  그 안에서 `leads.exported_at` 을 **UPDATE** 한다(`:140-143`). 호출은
  `app/(admin)/admin/leads/page.tsx:80` 의 `exportHref` → `LeadFilterBar` 의 링크다.
  CSRF 토큰 검증도, `Sec-Fetch-Site` / `Origin` 확인도 없다.
- 왜 문제인가: 쿠키 `SameSite=Lax` 는 **최상위 GET 내비게이션에 쿠키를 보낸다.**
  로그인한 운영자가 외부 링크(메신저·메일)를 한 번 클릭하면
  `https://site/api/admin/export?period=custom&from=2020-01-01&to=2099-12-31` 이 실행되어
  **전 기간 모든 리드가 `exported_at` 으로 도장 찍히고**(C-12 대로 되돌릴 UI 없음),
  동시에 전체 개인정보가 담긴 xlsx 가 공격자가 유도한 다운로드로 내려간다.
  "기록 → 복호화" 순서를 지켜도 **호출 자체를 유도당하면 무의미**하다.
- 조치: ① 내보내기를 **POST** 로 바꾸고 `<a>` 대신 `<form method="post">` 로 호출.
  ② Route Handler 진입부에서 `req.headers.get("sec-fetch-site") === "same-origin"` 또는
  `Origin` 헤더 == 자기 도메인을 검증하고 아니면 403. 같은 검증을
  `api/admin/logout/route.ts:5`(현재 POST 지만 CSRF 검증 없음 — 강제 로그아웃 가능)와
  `api/admin/leads/[id]/route.ts`(PATCH)에도 적용.

## C-14 [높음] `/review` `/notice` 가 404 인데 헤더가 전 페이지에서 각각 2번씩 링크한다

- 주장: CLAUDE.md 진행상태 — "후기·공지 게시판 `[ ]`" (미완은 정직하게 적혀 있다).
  그러나 `Header` 는 완료된 것으로 간주되어 전 페이지에 배포됐다.
- 실제: 라우트 실측.
  ```
  /review  → 404        /notice  → 404
  ```
  `app/(site)/` 에 `review/` `notice/` 디렉터리가 없다.
  `curl localhost:3100` 의 href 집계: `href="/review"` **2건**, `href="/notice"` **2건**
  (데스크톱 내비 + 모바일 드로어). `/kt` 등 모든 페이지 동일(`(site)/layout.tsx:12`).
- 왜 문제인가: 메인 내비게이션의 2/6 항목이 404 다. 전환 직전에 404 를 만난 방문자는
  사이트를 신뢰하지 않는다. 검색엔진에도 내부 링크 → 404 가 전 페이지에서 반복 노출된다.
  갭 리포트가 "신뢰 축적 블록 0개"를 P0 로 지적했는데, 그 상태에서 **신뢰를 깎는 링크**를
  12개(페이지 수 × 2 × 2) 심어 둔 셈이다.
- 조치: 둘 중 하나. ① `Header` 의 게시판 메뉴 2개를 게시판 구현 전까지 제거
  (`components/sections/Header.tsx` 의 메뉴 배열에서 조건부 제외).
  ② 또는 `app/(site)/review/page.tsx` · `notice/page.tsx` 를 "준비 중 + `#consult` 유도"
  최소 페이지로 만든다. **①이 더 정직하다** — 빈 게시판은 C-05 의 "준비 중"과 같은 실수 반복이다.

## C-15 [높음] G2-4 가 미완인 `LiveFeed` 의 그리드가 390px 에서 이름 열을 ~22px 로 눌러버린다 (리드 5건 들어오는 순간 깨진다)

- 주장: `GOAL_PLAN.md:45` G2-4 `[ ]` 미완이지만, `LiveFeed` 자체는 CLAUDE.md 진행상태에서
  "메인 랜딩 퍼블리싱 1차 — 섹션(Hero·**LiveFeed**·…) `[x]`" 로 완료 처리됐다.
  `GOAL_PLAN.md:48` G2-7 "모바일 레이아웃 전수 점검 (현재 미검증)" — 미검증임을 인정.
- 실제: `FE/components/sections/LiveFeed.tsx:50` 과 `:70` 이 동일한 고정 트랙을 쓴다.
  `grid-cols-[4.5rem_3.5rem_1fr_5rem_4rem]` + `gap-2` + `px-4`.
  390px 뷰포트 산술:
  ```
  뷰포트 390 − section px-4(32) = 358   (카드 폭)
  카드 내부 px-4(32) 제외        = 326   (그리드 폭)
  고정 트랙 4.5+3.5+5+4 = 17rem  = 272
  gap-2 × 4                      =  32
  → 1fr (이름 열) = 326 − 272 − 32 = 22px
  ```
  `masked_name` 은 `left(name,1) || '**'`(001:211) = "김**" 3글자. 14px 글꼴에서 약 30px 필요.
  `font-bold`(`:84`) 에 `truncate` 도 없어 **글자가 트랙을 넘치고 그리드가 밀린다**.
  `sm:` 변형(`6rem 5rem 1fr 6rem 5rem` = 22rem = 352px)은 더 나쁘지만 ≥640px 이라 해당 없음.
- 왜 문제인가: 지금은 리드가 0건이라 섹션이 렌더되지 않아 **아무도 못 본다**.
  그래서 "모바일 점검 완료"로 넘어갈 위험이 크다. 실제 접수가 5건 들어오는 날
  모바일 메인에 가로 스크롤과 깨진 표가 동시에 등장한다. 이게 가장 나쁜 타이밍이다 —
  첫 리드가 들어온 날이 모바일 레이아웃이 깨지는 날이 된다.
- 조치: `LiveFeed.tsx:50,70` 을 **모바일에서 3열로** 줄인다 —
  기본 `grid-cols-[4rem_1fr_4.5rem]`(신청일/이름+통신사/상태), `sm:` 에서 현재 5열 복원.
  통신사 배지는 이름 셀 안에 인라인으로 넣고, 사은품 열은 `hidden sm:block`.
  더하여 **더미 데이터 없이 검증할 수 있게** `LiveFeed` 에 `items` prop 주입 경로를 열어
  로컬에서만 임시 배열로 레이아웃을 확인할 것 (DB 에 가짜 행을 넣는 건 규칙 1 위반이므로 금지).

## C-16 [높음] 요금 계산기가 "휴대폰 미포함" 이라고 쓰면서 휴대폰 1회선 결합이 전제된 금액을 보여준다 — 자기모순 + 이중계산

- 주장: `GOAL_PLAN.md` 최근 커밋 "feat: 요금 계산기 — 속도·TV·휴대폰 선택 시 즉시 합산",
  `lib/plans.ts:101` — "표에 없는 조합은 계산하지 않는다. 없는 값을 추정해 만들지 않기 위함".
- 실제: `/kt` 라이브 출력 실측.
  ```
  인터넷 + TV   39,600원
  휴대폰        미포함
  월 예상 요금  39,600원
  표시 금액은 36개월 약정 · 휴대폰 1회선 결합 할인 적용 · 부가세(VAT) 포함 기준입니다.
  ```
  `combos` 의 `monthly_fee` 는 시드 헤더(`plans_damoa_2026-10-08.sql:22-23`)대로
  **"3년 약정, 휴대폰 1회선 결합 할인 기준"** 금액이다. 그런데 화면은 같은 패널에서
  "휴대폰 미포함"이라고 선언한다. 그리고 `PlanCalculator.tsx:38-41`
  ```ts
  const total = combo?.monthly_fee != null ? combo.monthly_fee + (mobile?.monthly_fee ?? 0) : null;
  ```
  휴대폰을 고르면 **이미 결합 할인이 반영된 인터넷 요금 위에 휴대폰 요금을 그대로 더한다.**
- 왜 문제인가:
  1. "휴대폰 미포함 / 39,600원" 은 **결합 조건 없이 그 금액이 된다**는 뜻으로 읽힌다.
     실제로는 휴대폰 1회선을 결합해야 나오는 금액이다 → 실제 청구와 어긋난다(표시광고법).
  2. 휴대폰을 선택하면 결합 전제가 중복 계상돼 금액이 과대 표시된다. 어느 쪽을 골라도
     화면 숫자가 실제와 다르다.
  3. "없는 값을 추정해 만들지 않는다"는 원칙을 세워 뒀는데, **전제가 다른 두 숫자를 더하는 것**은
     바로 그 추정이다. 원칙은 `findCombo` 에만 적용되고 합산 지점에는 적용되지 않았다.
- 조치: ① 기본 상태 라벨을 "휴대폰 미포함" → **"휴대폰 1회선 결합 기준(필수)"** 으로 바꾸고,
  결합 없는 금액을 모른다면 그 선택지를 **아예 제공하지 않는다**.
  ② 휴대폰 선택 시 합산 로직은, 결합 할인 전 인터넷 단독가 + 휴대폰 요금으로 계산해야 맞다 —
  단독가는 다모아 시드가 `category='INTERNET'/'TV'` 로 보강해 뒀으니 그걸 쓰거나,
  근거가 없으면 **합산을 하지 말고 "휴대폰을 함께 결합하면 금액이 달라집니다 — 상담 시 안내"**
  로 끝낼 것. ③ 이 결정은 C-08(G1-4 교차검증)과 묶어서 처리해야 한다.

## C-17 [높음] G4-6 "대비비 검증 `[x]`" — 검증은 했지만 기준 미달 조합이 그대로 남아 있다

- 주장: `GOAL_PLAN.md:85` G4-6 `[x]` — "대비비 검증 — **흰 글자 on CTA 3.32~4.15:1**,
  초록 글자 on 흰 4.94:1 — 흰 글자/녹색 버튼 조합이 WCAG 기준을 넘는지".
  `app/globals.css:20` 은 스스로 `--brand` 에 대해 "**흰 글자를 얹지 말 것 — 대비 2.88:1 로
  기준 미달**" 이라고 적어 두었다.
- 실제: 토큰 값으로 직접 계산(흰색 대비, WCAG 2.1 상대휘도).
  | 조합 | 비율 | 판정 | 실제 사용처 |
  |---|---|---|---|
  | `#fff` on `--cta-from #0aa33e` | **3.32:1** | 18px bold = 13.5pt → **AA 미달(4.5 필요)** | `Button` `cta` `size="lg"` = `text-lg`(18px) — 메인 CTA 전부 |
  | `#fff` on `--brand #07b040` | **2.88:1** | **미달** | `components/ui/Button.tsx:12` `primary` 기본 변이 → `PartnerCard.tsx:30`(variant 미지정, "자세히 보기"), `app/(admin)/admin/login/LoginForm.tsx:125` |
  | `--brand` on `--brand-light #dff7e6` | **2.55:1** | **미달** | `LiveFeed.tsx:21` "진행중" 배지 |
  | `#fff` on `--brand` | 2.88:1 | **미달** | `LiveFeed.tsx:20` "완료" 배지 |
  | `#fff` on `--carrier-skylife #00a0e9` | **2.92:1** | **미달** | `LeadForm.tsx:120-125` 통신사 칩 선택 상태(13px bold) |
  | `#fff` on `--carrier-sk #ea5b0c` | **3.50:1** | **미달** | 동일 |
  | `#fff` on `--carrier-kt #e4002b` | 4.85:1 | 통과 | |
  | `#fff` on `--carrier-lg #e6007e` | 4.50:1 | 경계 통과 | |
  (`PlanCalculator.tsx:46` 과 `SectionHeading.tsx:24` 는 03:0x 시점에 이미
  `bg-brand-dark` / `text-brand-deep` 로 수정되어 **통과**한다.)
- 왜 문제인가: WCAG 2.1 AA 의 large text 기준은 18pt(24px) 또는 **14pt bold(18.66px)** 다.
  `text-lg` = 18px bold 는 13.5pt 로 **large text 가 아니다.** 즉 사이트의 주 CTA 버튼 글자가
  AA 미달이다. G4-6 은 "3.32:1 을 측정했다"에서 멈추고 **그 값이 미달이라는 판정을 하지 않았다.**
  측정했다는 사실이 통과했다는 뜻으로 체크박스에 들어갔다.
  실무적 귀결: 저시력·고령 사용자와 야외 밝은 화면에서 CTA 글자가 읽히지 않는다 —
  이 사이트의 전환은 그 버튼 하나에 달려 있다.
- 조치:
  1. `globals.css:28-29` 의 `--cta-from`/`--cta-to` 를 어둡게 조정해 **양 끝 모두 4.5:1** 이상으로.
     `--brand-dark #0a8230`(4.94:1) ~ `--brand-deep` 사이 범위가 안전하다.
     또는 `Button` `size="lg"` 를 `text-xl`(20px → 15pt bold, large text 성립)로 올려
     3:1 기준을 적용받게 하는 방법도 있으나, 글자 크기로 기준을 우회하는 쪽은 권하지 않는다.
  2. `Button.tsx:12` `primary` 를 `bg-brand-dark text-white` 로 교체 (또는 `primary` 를 폐기하고
     `cta`/`outline` 2종으로 축소 — `PartnerCard.tsx:30` 은 `variant="outline"` 이 더 맞다).
  3. `LiveFeed.tsx:19-23` `statusTone` 을 `bg-brand-dark text-white` / `bg-brand-light text-brand-deep` 로.
  4. `LeadForm.tsx:122` 선택 상태를 "통신사색 배경 + 흰 글자" 대신
     "흰 배경 + 통신사색 2px 테두리 + `text-foreground` 굵게 + 통신사색 점" 으로 바꾼다.
     통신사 색을 면으로 쓰지 않으면 대비 문제가 사라지고, G4 의 "색은 면이 아니라 점" 원칙에도 맞다.
  5. `GOAL_PLAN.md:85` 를 `[ ]` 로 되돌릴 것.

## C-18 [높음] 히어로·여정 카피에 근거 없는 약속과 FAQ 와 모순되는 문장이 라이브로 들어가 있다

- 주장: `GOAL_PLAN.md:102` G6-2 `[x]` — "**숫자를 한 글자도 쓰지 않아** 표시광고법 리스크가 없다".
  `site-config.ts:305-307` — "확인된 사실만 적는다 … 금액이 조건에 따라 달라지는 항목은
  '달라진다'고 쓰는 것이 정확한 서술이다".
- 실제: 라이브 메인 본문 실측 (`site-config.ts:73-98`, `:35-50`).
  1. `journey.steps[3].desc` — **"설치 완료 후 포함된 혜택은 바로 받아 보실 수 있습니다.
     상품 설치 직후에 문제 발생시 태산넷이 책임지고 수리합니다."**
     같은 페이지 아래 FAQ(`site-page` 03:04 실측)는 **"사은품은 설치가 확인된 뒤 지급합니다.
     품목과 지급 방식은 상품과 시기에 따라 달라지므로, 확정된 조건을 상담에서 안내해 드립니다."**
     → "바로 받아 보실 수 있습니다" vs "확인된 뒤 / 달라지므로" **직접 모순.**
     "태산넷이 책임지고 수리합니다"는 기간·범위·면책 없는 **무제한 수리 보증** 선언이다.
     이 사이트는 "계약을 처리하지 않는" 상담 창구인데(CLAUDE.md), 설치 하자 수리를 자기 책임으로
     공표하고 있다.
  2. `heroPitch.intro[1]` — "**지원금과 경품을 최대한 챙겨드리려고** 노력하고 있습니다."
     "최대한"은 수치가 없을 뿐 최상급 표현이다. 갭 리포트가 금지한 "최대 ○○만원" 과 같은 계열이다.
  3. `journey.steps[0]` — 제목 **"문자 받기"** / 설명 "원하는 상품과 정보 입력으로 신청을
     넣어주세요". 1단계에서 사용자가 하는 일은 **입력**이고 문자 받기가 아니다.
     제목과 설명이 다른 행동을 가리킨다.
  4. 브랜드명 혼용: `SITE.name = "TS-Net"`, 로고 `alt="TS-Net"`, `app/layout.tsx:26` 타이틀
     "TS-Net — 인터넷·TV 가입 상담센터" vs 히어로 "저희 **태산넷**은", 여정 "**태산넷**이 책임지고".
     한 화면에 두 상호가 섞여 있고, 푸터 상호는 `TODO 상호` 다(C-04).
- 왜 문제인가: G6-2 의 "리스크가 없다"는 **G6 산출물(홍보 이미지)에 대한 판단**인데,
  정작 같은 설정 파일의 히어로·여정 카피는 그 기준을 통과하지 않았다. 숫자를 쓰지 않았다고
  표시광고법을 벗어나지 않는다 — "최대한", "책임지고", "바로"는 전형적인 부당 표시 표현이다.
  그리고 **같은 페이지 안의 모순**(1번)은 분쟁 시 가장 불리하다: 소비자는 유리한 쪽 문장을 인용한다.
- 조치: `FE/lib/site-config.ts`
  - `:95` `journey.steps[3].desc` → "설치가 확인된 뒤 사은품을 지급합니다. 품목·지급 시기는
    상품에 따라 달라지며 상담에서 안내해 드립니다." (FAQ 와 같은 문장 구조로 맞춘다)
    수리 책임 문장은 **삭제**하거나, 실제 보증 범위·기간이 확정된 뒤에만 넣는다.
  - `:39` "지원금과 경품을 **최대한** 챙겨드리려고" → "지원금과 경품 조건을 함께 확인해 드립니다"
  - `:79` `journey.steps[0].title` "문자 받기" → "상담 신청"
  - 상호를 하나로 고정. 시안 PDF 가 "태산넷"이면 `SITE.name`·메타데이터·로고 alt 를 전부
    태산넷으로 맞추고, TS-Net 은 영문 표기로만 쓸 것.

## C-19 [높음] 이름·연락처 입력칸에 접근 가능한 이름이 없다 — placeholder 뿐이다

- 주장: `GOAL_PLAN.md:110` 품질 게이트, 그리고 `LeadForm.tsx:108` 주석 —
  "radio 로 구현해 키보드 화살표 이동과 **스크린리더 그룹 읽기가 살아 있다**" (접근성 의식은 있다).
- 실제: `FE/components/forms/LeadForm.tsx:162-182` — 이름 `<input type="text">` 와
  연락처 `<input type="tel">` 에 `<label for>` 도, `aria-label` 도, `aria-labelledby` 도 없다.
  `placeholder="이름을 입력해주세요."` 만 있다. 바로 위 `<select>`(`:148-153`)에는
  `aria-label="관심상품 선택"` 이 붙어 있어 **같은 폼 안에서 처리가 갈렸다.**
  라이브 HTML 에서도 두 input 에 접근 가능한 이름이 없음을 확인.
- 왜 문제인가: placeholder 는 접근 가능한 이름으로 신뢰할 수 없다 — 입력을 시작하면 사라지고,
  일부 스크린리더는 읽지 않는다. 음성 제어("이름 칸에 입력")도 동작하지 않는다.
  이 폼이 사이트의 전부이므로, 스크린리더 사용자는 **사이트를 전혀 쓸 수 없다**.
  또 `noValidate`(`:102`)로 브라우저 검증을 끈 상태라, 오류는 서버 왕복 뒤 폼 전체 상단의
  `role="alert"` 한 곳에만 뜨고 **어느 칸이 문제인지 입력칸과 연결되지 않는다**(`aria-invalid`,
  `aria-describedby` 없음).
- 조치: `Field.tsx` 에 `TextField` 래퍼를 만들어 `<label className="sr-only">` + `id` 연결을
  강제하고, `LeadForm.tsx:162-182` 와 `StickyConsultBar` 의 동일 입력칸을 모두 교체.
  오류 시 해당 input 에 `aria-invalid="true"` + `aria-describedby` 로 오류 문구를 묶을 것.

---

# C. 깨진 것 / 데이터 없을 때

## C-20 [중간] `access_logs` 의 목록·상세 조회 기록에 IP 가 빠진다 — 법정 기재항목 누락

- 주장: `lib/admin/audit.ts:24` — "Route Handler 에서 접속자 IP — **접속기록의 법정 기재항목**"
  (스스로 필수라고 적어 뒀다).
- 실제: IP 를 넘기는 곳은 Route Handler 4곳뿐이다 (`decrypt:49`, `export:92`,
  `leads/[id]:124`, `login/logout`). 반면 **개인정보가 실제로 화면에 뜨는 서버 컴포넌트 2곳**은
  `ip` 를 넘기지 않는다.
  - `app/(admin)/admin/leads/page.tsx:66-73` `logAccess({ ... })` — `ip` 없음
  - `app/(admin)/admin/leads/[id]/page.tsx:64` 동일
  → `access_logs.ip` 가 LIST/VIEW 행에서 NULL 로 남는다.
- 왜 문제인가: 개인정보 안전성 확보조치 기준 제8조는 접속기록에 **접속지 정보**를 포함하도록
  한다. 가장 빈번한 접근 유형(목록 조회)에서 그게 비어 있으면, 유출 사고 시 어느 경로로
  열람됐는지 추적이 안 된다. 코드가 "법정 기재항목"이라고 써 놓고 두 곳을 빠뜨린 게
  더 문제다 — 다음 사람이 이미 됐다고 믿는다.
- 조치: 두 페이지에서 `import { headers } from "next/headers"` 로 헤더를 받아
  `requestIp(await headers())` 를 `logAccess` 에 넘긴다. `requestIp` 는 `Headers` 를 받으므로
  그대로 재사용된다.

## C-21 [중간] 500 응답 본문이 비어 있어 클라이언트가 "네트워크 오류"로 오안내한다

- 주장: `useLeadSubmit.ts:98` — "네트워크 오류입니다. 잠시 후 다시 시도해 주세요".
- 실제: `useLeadSubmit.ts:90` 이 `await res.json()` 을 **무조건** 호출한다.
  C-06 에서 실측한 대로 `/api/leads` 의 500 은 본문이 비어 있어 `res.json()` 이 throw →
  `:97` catch → 사용자에게 네트워크 오류로 표시된다.
- 왜 문제인가: 사용자는 Wi-Fi 를 의심하고 재시도하다 이탈한다. 운영자는 "네트워크 오류 제보"를
  받고 서버 설정 문제를 찾지 못한다. 진단 비용이 그대로 손실이다.
- 조치: `:90` 을 방어적으로 고친다 —
  `const data = await res.json().catch(() => ({ ok: false } as const));`
  그리고 `!res.ok && !data.error` 일 때 `"일시적인 서버 오류입니다(코드 " + res.status + ")"` 로
  상태 코드를 노출해 제보가 진단에 쓸모 있게 만들 것. 서버 쪽은 C-06 조치로 JSON 을 보장한다.

## C-22 [중간] 어드민 목록이 DB 원본 오류 메시지를 화면에 그대로 출력한다

- 실제: `app/(admin)/admin/leads/page.tsx:76` `loadError = e instanceof Error ? e.message : "조회 실패"`
  → `:104` `목록을 표시할 수 없습니다 — {loadError}`.
  `lib/audit.ts:41` 은 `access_logs 기록 실패: ${error.message}` 를 그대로 throw 하므로
  Postgres/PostgREST 원문(정책명·컬럼명·스키마 구조)이 화면에 노출된다.
- 왜 문제인가: 어드민 화면이라 노출 범위는 좁지만, 스키마 정보가 화면·스크린샷·제보 채널로
  새 나간다. 또 운영자에게는 해석 불가능한 영문 메시지여서 실질적 도움도 안 된다.
- 조치: `:104` 는 고정 안내문 + "자세한 원인은 서버 로그" 로 바꾸고, 원문은
  `console.error` 로만 남긴다.

## C-23 [중간] `/api/admin/login` 에 rate limit 이 없다

- 실제: `app/api/admin/login/route.ts` 전체에 횟수 제한·지연·락아웃이 없다.
  `/api/leads` 는 IP 10분 3건 제한이 있는데(`route.ts:15-16`), **더 민감한 로그인에는 없다.**
  `logAccessSoft` 로 LOGIN_FAIL 을 기록하지만 기록만 하고 차단하지 않는다.
- 왜 문제인가: 계정 1개 + (C-11 대로) 2FA 가 조건부라서, 비밀번호 무제한 추측이 가능하면
  전체 리드 DB 가 노출된다. Cloudflare Rate limit 을 쓰기로 했지만(CLAUDE.md 확정사항)
  코드에 fail-closed 가 없으면 WAF 설정 누락 시 그대로 뚫린다.
- 조치: Supabase Auth 자체 제한에만 의존하지 말고, `admin_users` 또는 별도 테이블에
  `failed_count`/`locked_until` 을 두고 5회 실패 시 15분 락. 최소 조치로
  `logAccessSoft` 기록 뒤 `await new Promise(r => setTimeout(r, 1000))` 지연이라도 넣을 것.

## C-24 [중간] 메인 First Load JS 239kB / CSS 128kB — 전환 랜딩의 LCP 부담

- 실제: `npx next build` 결과.
  ```
  ○ /            6.21 kB   First Load JS 239 kB
  ● /[carrier]  38.4 kB    First Load JS 271 kB
  + shared      chunks/1a0e2010bb117d55.css  103 kB
                chunks/f59dfe28705d1f3f.css   25.2 kB
  ```
  CSS 128kB 의 대부분은 `Noto_Sans_KR` 의 `@font-face` 선언이다 — 서브셋 CSS 에
  **585개 `@font-face` 블록**이 있음을 실측(`grep -c "@font-face"`).
  (한글 유니코드 범위는 포함돼 있으니 `subsets:["latin"]` 이 한글을 깨뜨리지는 **않는다** —
  이건 확인했다.)
- 왜 문제인가: 렌더 차단 CSS 128kB 는 한국 모바일 3G/혼잡망에서 LCP 를 직접 밀어낸다.
  갭 리포트가 분량(2,939px → 8,819px)을 늘리라고 요구하는데, 그만큼 섹션을 추가하면
  JS/CSS 도 함께 늘어난다. 지금이 예산을 정할 시점이다.
- 조치: ① `app/layout.tsx:10` 의 `weight: ["400","500","700","900"]` 4종을 실제 사용 굵기로
  줄인다(`font-medium`/500 사용처를 grep 해 보고 불필요하면 제거 → @font-face 수가 비례 감소).
  ② `Jua`(`:17`)는 "포인트 전용"인데 실제 사용처가 있는지 확인 — `font-display` 토큰
  (`globals.css:77`) 사용처를 grep 해 0건이면 폰트를 통째로 제거(한 종 제거 = 수백 KB).
  ③ 런칭 전 Lighthouse 모바일 LCP 를 수치로 기록하고 GOAL_PLAN 에 예산으로 박을 것.

---

# D. 일관성

## C-25 [중간] `Reveal` 이 20개 섹션 중 1개에만 적용되어 있다 — 스크롤 등장이 일관되지 않다

- 주장: `GOAL_PLAN.md:46` G2-5 `[ ]` 미완이지만, `TAMNANET_GAP_ANALYSIS.md:971`
  검증 항목 "신규 섹션 전부 `<Reveal>` 적용 확인 (G-17)" 이 있다.
- 실제: import 그래프 전수 조사(03:04) —
  `Reveal` 을 import 하는 파일은 **`components/sections/CarrierHub.tsx` 단 1개**다.
  Hero / PromoBand / PriceCompare / Journey / ConsultGuide / Faq / PrivacyPromise /
  Reviews / LiveFeed / PlanTable / PlanCalculator / PlanCards / PlanNotice / PartnerCard —
  전부 미적용. 라이브 HTML 에 `data-reveal` **0건**(JS 가 붙이므로 정상).
- 왜 문제인가: 스크롤 내려갈 때 CarrierHub 만 페이드업하고 나머지는 즉시 보인다 →
  한 섹션만 "움직이는 섹션"이 되어 일관성이 깨지고, 오히려 그 섹션이 로딩 지연처럼 읽힌다.
  둘 중 하나로 정해야 한다: 전부 적용하거나 전부 제거.
- 조치: 전부 적용이 기본값이라면 `components/ui/Section.tsx` 같은 공통 래퍼를 만들어
  `<section>` + `<Reveal>` + 패딩(`py-16 md:py-20`)을 한 곳에서 주고, 모든 섹션을 그걸로 교체.
  (`Reveal.tsx` 자체 설계는 좋다 — JS 가 죽어도 내용이 남는 구조이고, 마운트 시 뷰포트 안이면
  연출을 건너뛴다. 이건 유지할 것.)

## C-26 [중간] 디자인 토큰 밖 하드코딩 색이 남아 있다

- 주장: `app/globals.css:4` — "디자인 토큰 — 색·그림자·라운드·모션의 **단일 출처**.
  여기만 바꾸면 전체가 따라온다."
- 실제: 전수 grep 결과 토큰 밖 색은 아래가 전부다 (양호하지만 0 은 아니다).
  - `components/sections/Footer.tsx:21-24` —
    `linear-gradient(90deg, #f3fcf6 0%, #e9f8ef 55%, #f3fcf6 100%)` **리터럴 3개**.
    `--brand-soft` 는 `#f2fcf5` 라 값이 미묘하게 다르다 → 브랜드 색을 바꾸면 푸터 밴드만 안 따라온다.
  - `components/sections/Hero.tsx:126-129` —
    `linear-gradient(180deg, #f7fafc 0%, #fdfefe 58%, #ffffff 100%)` 리터럴 3개.
    `--surface-muted` 는 `#f5f8fa` 로 역시 다르다.
  - `app/globals.css:224,230` `.select-chevron` 의 `stroke='%2307b040'` — `--brand` 하드코딩
    (data URI 안에서는 `var()` 를 쓸 수 없으므로 불가피하지만, **주석으로 명시**해야 한다.
    브랜드색 변경 시 여기 2곳을 반드시 같이 고쳐야 한다는 사실이 적혀 있지 않다).
  - `app/(admin)/admin/leads/page.tsx:160,169` 등 `bg-slate-100` 4곳 — 토큰 밖 Tailwind 팔레트.
    (`red-*`/`amber-*` 는 상태색이라 허용 범위로 본다.)
- 조치: Footer·Hero 그라데이션을 `--brand-soft`/`--brand-light`/`--surface-muted` 조합으로 교체.
  `globals.css:223` 블록에 "⚠ `--brand` 변경 시 아래 2개 data URI 의 `%2307b040` 도 함께 교체"
  주석 추가. `bg-slate-100` → `bg-surface-muted`.

## C-27 [낮음] 죽은 설정·에셋·미선언 의존

- `site-config.ts:100-106` `SITE.processSteps` — **사용처 0건**.
  `Process.tsx` 삭제(`GOAL_PLAN.md:122` `[x]` "Process 삭제, Journey 4단계로 단일화")와 함께
  제거해야 했는데 남았다. 갭 리포트 G-06 조치항목에도 "`site-config.ts:100-106` `processSteps`
  제거"가 명시돼 있다. → **미완.**
- `FE/public/{file,globe,next,vercel,window}.svg` 5개 — Next 템플릿 잔재.
- `scripts/build-brand-assets.mjs:15` 와 `scripts/build-promo-image.mjs:20` 이 `sharp` 를 import 하지만
  `package.json` 의 dependencies/devDependencies **어디에도 `sharp` 가 없다**.
  `npm ls sharp` → `next@15.5.25 → sharp@0.35.4` (전이 의존으로만 해결됨).
  → `GOAL_PLAN.md:84` G4-5 / `:103` G6-3 의 "재생성 가능" 은 **호이스팅 운에 의존**한다.
  pnpm/yarn 엄격 모드나 Next 가 sharp 의존을 끊는 날 깨진다.
- `package.json` scripts 에 브랜드/홍보 이미지 재생성 명령이 없다 — `node scripts/...` 를
  기억해야 한다.
- 조치: `processSteps` 삭제, 템플릿 svg 삭제, `npm i -D sharp`,
  `"assets": "node scripts/build-brand-assets.mjs"` / `"promo": "node scripts/build-promo-image.mjs"`
  스크립트 추가.

## C-28 [낮음] SEO 기반이 없다 (goal 미체크이므로 허위 주장은 아니다)

- 실제: `/robots.txt` → **404**, `/sitemap.xml` → **404**.
  `app/layout.tsx:24` `// TODO: ... metadataBase는 도메인 연결 시 설정` — `metadataBase` 없음,
  `openGraph`/`twitter`/`canonical` 없음. `.env.local` 의 `NEXT_PUBLIC_SITE_URL` 은 설정됨(21자).
  `Faq.tsx:22-23` 에 `FAQPage` JSON-LD 가 있는 것은 좋다.
- 조치: CLAUDE.md 진행상태의 "SEO·트래킹·도메인 연결 `[ ]`" 범위이므로 새 결함은 아니다.
  다만 **C-14 와 묶어서** 처리할 것 — `/review` `/notice` 404 를 남긴 채 sitemap 을 만들면
  404 를 색인에 등록하게 된다. 순서는 C-14 → SEO.

---

# E. 레퍼런스 대비 P0 12개 — 해소/미해소 판정

`docs/TAMNANET_GAP_ANALYSIS.md` 에서 `우선순위: **P0**` 로 표시된 항목(§9 체크리스트 기준).
판정 근거는 `curl localhost:3100` / `curl localhost:3100/kt` 실측(03:04).

| 항목 | 내용 | 판정 | 근거 |
|---|---|---|---|
| **0차-1** | 보유기간 고지 vs `purge_at` 불일치 | ❌ **미해소** | C-03. 003 미적용 실측(`lead_is_activated` 404) |
| **0차-3** | `SITE.tel` 자리표시자 교체 | ❌ **미해소** | C-07. `tel:1600-0000` 7곳 |
| **G-01** | 메인 분량 1/3 (13섹션 8,819px vs 5섹션 2,939px) | 🟡 **부분** | 섹션 수는 Hero·PromoBand·CarrierHub·CarrierMatrix·PriceCompare·Journey·PromoSlot·ConsultGuide·Faq·PrivacyPromise·Footer밴드 = **11블록**으로 늘었다(본문 텍스트 1,908자→**5,039자**). 다만 LiveFeed·Reviews 는 데이터 0 이라 미렌더이고, 신뢰 블록(G-04)은 여전히 0 |
| **G-02 / G-10** | 가격 비교 섹션 / 메인에 금액 없음 | ⚠️ **해소했으나 위험 도입** | `PriceCompare`+`PriceBars` 렌더 확인(37,400~48,400원). 단 C-08 — 미검증 금액 공표 |
| **G-03** | 사은품 섹션 부재 | ❌ **미해소** | `site-config.ts` 에 `GIFT_SECTION` 키 없음, `GiftShowcase.tsx` 없음. (근거 없는 금액을 안 넣은 건 규칙 6 준수로 올바름 — 자리·컴포넌트가 없는 것이 미해소) |
| **G-05** | 실시간 현황 5건 미만 대체 블록 | ❌ **미해소** | `LiveFeed.tsx:35` 여전히 `return null` 단독. 라이브 메인에 해당 자리 공백. 게다가 C-15 로 모바일 레이아웃도 깨짐 |
| **G-07** | 전 행 `-` 인 사은품 열 | ✅ **해소** | `/kt` 요금표 헤더가 `상품명 / 월 요금 / 할인 전 / 약정` 4열 — 사은품 열 미렌더 확인 |
| **G-08** | 추천 행 강조 없음 | 🟡 **부분/우회** | 표 안 행 강조는 여전히 없으나 `PlanCards` 추천 3장이 그 역할을 한다. 단 그 카드가 **C-02 의 복제 카피를 노출하는 바로 그 컴포넌트**다 |
| **G-09** | 모바일 760px 가로 스크롤, 신호 없음 | ✅ **해소** | `/kt` 에 `표를 좌우로 밀면 요금·약정 항목까지 볼 수 있습니다.` 힌트 텍스트 렌더 확인(그룹마다) |
| **G-12** | 약정·위약금·사은품 고지 부재 | ✅ **해소** | `PlanNotice` 렌더 확인 — 요금 표시 기준 / 달라지는 경우 / 설치비·장비 / 약정·중도해지 / 사은품 반환 5블록. `lib/legal-notices.ts` 분리도 적절 |
| **G-19** | 뉴트럴에서 초록기 제거 | ✅ **해소** | `globals.css:40-42` `--surface-muted:#f5f8fa` / `--line:#e4eaf0` / `--line-strong:#cbd5df` 한랭 뉴트럴 |
| **G-21** | 히어로 다크 면 없음 | ❌ **미해소(설계 변경됨)** | `Hero.tsx:95` `bg-white`, `:128` 은 `#f7fafc→#fff` 거의 흰 그라데이션. `SITE.hero.background` = `""`. G4-4 에서 "히어로 워시 제거"를 `[x]` 로 선택했으므로 **의도적 폐기**로 보이지만, 갭 리포트 P0 가 `[ ]` 로 남아 두 문서가 충돌한다 |
| **G-25** | 본문 중간 `#consult` 유도 부재 | 🟡 **부분** | 메인 `#consult` 링크 실측 **4건**(히어로 앵커 1 + PromoSlot 1 + Footer 밴드 1 + FAQ 꼬리 1). 갭 리포트 목표는 "600~700px 당 1개" — 본문 5,039자 분량 대비 여전히 희박하고, Journey/PriceCompare 직후 유도가 없다 |

**집계: 해소 4 / 부분 4 / 미해소 4 / 해소했으나 위험 도입 1.**
`GOAL_PLAN.md:41-42` 의 G2-1·G2-2 가 `[ ]` 로 남아 있는 것은 정직하다.
문제는 **P0 를 건너뛰고 P1 이하 작업(FAQ·ConsultGuide·PrivacyPromise 신설)이 먼저 들어간 것**이다.
그 세 섹션은 잘 만들어졌지만, G-03/G-05 가 비어 있고 G-21 이 미정인 상태에서
분량만 늘어나면 "길지만 설득되지 않는 페이지"가 된다.

---

# 치명·높음만 모은 실행 순서

의존 관계를 반영했다. **번호 순서대로** 처리할 것. 특히 1번을 2번보다 먼저 해야 한다.

### 즉시 (DB 조작 — 순서 엄수)

1. **C-01** `005` 마이그레이션 작성·적용 —
   `purge_expired_leads` / `purge_old_access_logs` 의 `execute` 를 anon·authenticated 에서 revoke.
   `live_feed` 에 `security_invoker = true` + anon revoke (**C-09** 동시 해결).
   → 이걸 먼저 하지 않고 3번(003 적용)을 하면 **공개 삭제 버튼이 활성화된다.**
2. **C-02** `psql -f BE/supabase/seed/plans_damoa_2026-10-08.sql` 적용.
   검증: `description=not.is.null` → 0행, `count` → 72. `/kt` 에서 복제 카피 3문구 소멸 확인.
   → 규칙 5 위반을 라이브에서 제거하는 작업. 가장 먼저 끝낼 수 있는 치명 항목이다.
3. **C-03** 보유기간 정합 — 운영 흐름 먼저 결정(14일 내 엑셀 반출이 가능한가?) →
   가능하면 `003` 적용 + `pg_cron` 등록, 불가능하면 `CONSENT.privacyDetail` ③ 문구 수정.
   둘 중 하나가 끝날 때까지 `PRIVACY_PROMISE.points[3]`("파기합니다") 문장은 내릴 것.

### 런칭 차단 해제 (운영자 입력 + 코드)

4. **C-06** `SUPABASE_SERVICE_ROLE_KEY` 기입 + `api/leads/route.ts:59` 를 try/catch 로 감싸
   JSON 500 보장. (**C-21** 의 클라이언트측 `res.json().catch()` 도 같이)
5. **C-07** `NEXT_PUBLIC_TEL` 기입 + `site-config.ts:15` 폴백 제거 + 미설정 시 전화 버튼 미렌더.
6. **C-04** `site-config.ts:17-24` 사업자정보 실제 값. 확정 전까지 `TODO` 시작 값은 미렌더 처리.
7. **C-05** `FE/content/privacy.mdx` 법정 9항목 작성(엑셀 배분 = 제3자 제공/위탁 반드시 기재) +
   `LegalLinks.tsx:63-73` 교체. `terms.mdx` 도 함께. "준비 중입니다" 문장 제거.

### 표시광고 리스크 차단

8. **C-08** `PriceCompare` 를 `enabled:false` 플래그로 내리거나, G1-4(통신사 공식요금 교차검증)
   완료 전까지 렌더 가드. 섹션 제목 "같은 조건" 삭제, 정렬을 금액순→통신사 고정순.
9. **C-16** 요금 계산기의 "휴대폰 미포함" 라벨·합산 로직 수정 (전제 중복 계상 제거).
10. **C-18** `site-config.ts` 카피 수정 — "바로 받아"·"책임지고 수리"·"최대한" 삭제,
    FAQ 와 문장 정합, `journey.steps[0].title` 교정, 상호 단일화.

### 어드민 보안·데이터 무결성

11. **C-11** `lib/admin/auth.ts:56-59` — TOTP 미등록 계정을 **거부**로 변경 (2FA 를 실제 필수로).
12. **C-13** `/api/admin/export` 를 POST 로 전환 + `Origin`/`Sec-Fetch-Site` 검증.
    같은 검증을 logout·PATCH 에도.
13. **C-12** `exported_at` 갱신을 단일 트랜잭션 RPC 로 이동 + "내보냄 표시 해제" 복구 경로.
14. **C-23** `/api/admin/login` 락아웃(5회/15분).

### 전환·접근성

15. **C-14** `Header` 의 `/review` `/notice` 메뉴를 게시판 구현 전까지 제거.
16. **C-19** 이름·연락처 입력칸에 `sr-only` label + `aria-invalid`/`aria-describedby` 연결.
17. **C-17** CTA·`primary`·배지·통신사 칩 대비비 교정 (`--cta-from` 조정 + `Button.primary` 폐기/교체).
    `GOAL_PLAN.md:85` G4-6 을 `[ ]` 로 되돌릴 것.
18. **C-15** `LiveFeed` 모바일 3열 전환 (리드 5건 도달 전에 처리 — 그 뒤엔 라이브에서 깨진다).
19. **C-09** 1번에서 처리되지 않았다면, 5건 게이트를 `live_feed` 뷰 안으로 이동.

### GOAL_PLAN 정정 (문서 작업이지만 빠뜨리면 같은 오판이 반복된다)

20. 아래 체크를 되돌리거나 쪼갤 것.
    - `G1-1`/`G1-6` → "시드 파일 작성 완료 / **DB 반영 미완**" 으로 분리 (C-02)
    - `G1-5` 의 블로커 사유를 삭제 — service_role 키와 무관하다 (C-02)
    - `G2-3` → `[ ]` — G1-4 미완 데이터를 공표 중 (C-08)
    - `G3-2` → `[ ]` — 조건부 2FA (C-11)
    - `G3-5` → `[ ]` — 부분 실패 시 데이터 유실 + CSRF (C-12, C-13)
    - `G4-6` → `[ ]` — 측정은 했으나 미달 판정 누락 (C-17)
    - `G6-2`/`G6-3` → 홍보 이미지 카피는 적합하나, 같은 파일의 히어로·여정 카피가
      같은 기준을 통과하지 않았다는 점을 명시 (C-18). `sharp` 미선언도 (C-27)
    - "메인 랜딩 퍼블리싱 1차 `[x]`" 의 잔여 항목에 **약관 전문 + 사업자정보**가 적혀 있는데
      둘 다 여전히 미완이다. 런칭 차단 항목이므로 블로커 섹션으로 올릴 것.

---

## 미확인으로 남긴 것 (추측하지 않았다)

1. **`live_feed` 뷰의 실제 anon 노출 여부** (C-09) — `leads` 가 0행이어서
   "RLS 차단"과 "데이터 없음"을 구분할 수 없었다. 리드 1건이 들어오면
   `GET /rest/v1/live_feed?select=*` 한 번으로 판정된다.
2. **어드민 화면 전체** — `SUPABASE_SERVICE_ROLE_KEY` 가 비어 있고 어드민 계정이 없어
   `/admin` 은 307 로 로그인으로 튕긴다. 목록·상세·엑셀의 **실행 경로를 한 번도 밟지 못했다.**
   코드 정독으로만 판단했다. `GOAL_PLAN.md:61` G3-6 `[ ]` 와 같은 상태다.
   → C-12/C-13 은 코드 근거가 명확하지만, 엑셀 서식·시트 분리·날짜 표시는 **미검증**이다.
3. **390px 실기기 렌더** — 마크업 산술로 판단했다(C-15). iOS Safari 의 `100vh`·safe-area,
   `env(safe-area-inset-bottom)` 실동작, 하단 고정바와 Turnstile(`bottom-24`)·
   BackToTop(`bottom-[11rem]`)의 실제 겹침은 실기기로 확인해야 한다.
   (산술상으로는 바 0~72px / Turnstile 96~160px / BackToTop 176~220px 로 겹치지 않는다.)
4. **Turnstile 운영 키 동작** — 현재 `TURNSTILE_SECRET_KEY` 가 35자로 Cloudflare
   테스트 시크릿(항상 통과) 길이와 같다. 운영 키로 교체한 뒤의 실패 경로
   (특히 `StickyConsultBar` 의 `engaged` 게이트 — 포커스 전에는 위젯이 마운트되지 않아
   첫 탭 제출이 토큰 없이 실패할 수 있다)는 검증하지 못했다.
5. **`/api/feed/live` 의 60초 캐시** — 빌드 결과에서 `○ /api/feed/live ... Revalidate 1m` 으로
   확인됐으므로 **프로덕션에서는 성립한다**. dev 응답에는 `Cache-Control` 헤더가 없었다(정상).
6. **`live_feed.applied_date` 표기** — 뷰가 `to_char(... at time zone 'Asia/Seoul', 'YY-MM-DD')`
   로 KST 를 보장한다(001:209). 프런트가 그대로 출력하므로 규칙 준수. 다만 실제 렌더를 보지 못했다.

---
---

# 추가분 (2차) — 조정자 지시 반영 + 모바일·접근성 전수

- 추가 작성: 2026-10-08 03:2x KST
- **사과 및 자기 신고 2건**
  1. 지시를 받기 전 `npx next build --turbopack` 을 3회 실행했다. dev 서버의 `.next` 를
     덮어써 사이트를 일시적으로 죽였을 수 있다. 이후 빌드는 돌리지 않았다.
     C-24(번들 크기)의 수치는 그 빌드 1회분 실측이며 **재검증하지 않았다.**
  2. `/api/leads` 수정 확인을 위해 **실제 접수 1건을 더 넣었다** — 이름 `검증`,
     번호 `010-9999-8888`, 통신사 SK, 상품 인터넷. 201 반환 확인.
     **C-35 와 함께 반드시 삭제해야 한다.** 현재 `leads` 에는 QA 행이 최소 2건이다
     (`테스트`, `검증`).

---

## C-09 → **[치명]으로 상향 · 미확인 해제** — `live_feed` 뷰가 anon 에 열려 있다 (실측 확정)

1차에서 "leads 0행이라 구분 불가"로 미확인 처리했던 항목이다. QA 행이 들어오면서 판정됐다.
브라우저 번들에 박히는 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 만으로:

```
GET /rest/v1/leads?select=id,name,phone_masked    → []        ← RLS 정상 차단
GET /rest/v1/leads?select=id (Prefer:count=exact) → */0       ← RLS 정상 차단
GET /rest/v1/live_feed?select=*
  → [{"applied_date":"26-10-08","carrier":"KT","masked_name":"테**",
      "status_label":"접수완료","gift_label":"확인중"}]        ← 뚫림
```

**같은 키로 `leads` 는 0행인데 `live_feed` 는 실제 행을 돌려준다.** 뷰가 기반 테이블의
RLS 를 우회한다 (`001_init_schema.sql:207` 에 `security_invoker` 없음, 마이그레이션 전체에
`revoke` 0건). 귀결 둘:

- **CLAUDE.md 절대조항 1의 "5건 미만 미노출" 게이트가 무력하다.** 게이트는
  `api/feed/live/route.ts:24` 한 곳에만 있고 DB 에는 없다. 지금 1~2건인데 외부에서 읽힌다.
- 접수일·통신사·이름 첫 글자·진행상태가 **상시 공개**다. 마스킹돼 있어도 일별 접수량은 영업정보다.

조치:
```sql
alter view live_feed set (security_invoker = true);
revoke all on live_feed from anon, authenticated;
```
그리고 5건 게이트를 뷰 정의 안으로 옮길 것 (어느 경로로 읽어도 규칙이 지켜진다).
**이제 추정이 아니라 확정된 구멍이다.**

## C-29 [치명] `--faint` 가 흰 배경에서 2.87:1 이다 — 푸터 법적 고지문 전체와 사업자정보 라벨이 그 색으로 12px 로 찍힌다

- 주장: 조정자 — "흰 글자 on `--brand`(2.88:1) 조합 **19곳**을 `bg-brand-dark`(4.94:1) 로
  일괄 교정했습니다." 확인했다 — `Button.tsx:12` `primary` 가 `bg-brand-dark text-white` 로
  바뀌었고 `PlanCalculator.tsx:46`·`SectionHeading.tsx:24` 도 통과한다.
  **브랜드 색은 정리됐다.** 그런데 스윕이 `--brand` 만 봤고 **뉴트럴은 안 봤다.**
- 실제: `app/globals.css:44` `--faint: #8e9aa6`. 흰 배경 대비 직접 계산 →
  상대휘도 0.31604 → `1.05 / (0.31604 + 0.05)` = **2.87:1**.
  `--brand`(2.88:1)와 **사실상 같은 수치**다. 19곳을 고치면서 이 색은 손대지 않았다.
  사용처 실측 (`grep -rn "text-faint"`):

  | 위치 | 내용 | 크기 |
  |---|---|---|
  | `Footer.tsx:84` | **푸터 법적 고지문 전문** ("본 사이트는 통신사 공식 대리점/판매점의…") | `text-xs` 12px |
  | `Footer.tsx:78` | **사업자정보 6종의 라벨** (`상호`/`사업자등록번호`/`통신판매업 신고번호` …) | `text-xs` 12px |
  | `Field.tsx:5` | `placeholder:text-faint` — **이름·연락처 입력칸의 유일한 라벨**(C-19) | `text-base` |
  | `Field.tsx:51` | 마케팅 동의의 `[선택]` 라벨 | 14px bold |
  | `PriceBars.tsx:68` | y축 금액 눈금 (`6만원`/`4만원`/`2만원`/`0원`) | `text-[11px]` |
  | `PriceBars.tsx:152` | TV 구성명 캡션 (`TV이코노미` 등) | **`text-[10px]`** |
  | `LiveFeed.tsx:72` | 신청일 | `text-xs` |
  | `Reviews.tsx:86` | 후기 작성일 | `text-xs` |
  | `PhoneReveal.tsx:71` | "번호 보기는 접속기록에 남습니다" 어드민 고지 | `text-[11px]` |

- 왜 문제인가:
  1. **법정 고지가 읽히지 않는 톤으로 찍히면 고지로서의 효력이 다퉈진다.**
     전자상거래법의 사업자정보 표시도, 푸터 면책 문구도 전부 2.87:1 × 12px 다.
     C-04 가 해결돼 실제 상호가 들어가도 **읽히지 않는 상태는 그대로 남는다.**
  2. 입력칸 라벨이 placeholder 뿐인데(C-19) 그 placeholder 색마저 미달이다 →
     저시력 사용자는 칸이 무엇인지 알 방법이 두 겹으로 막힌다.
  3. `PriceBars.tsx:152` 는 **10px** 다. 갭 리포트 G-12 조치항목이 명시한
     "본문 `text-sm text-muted`(**faint 금지**)" 를 신규 컴포넌트가 다시 위반했다.
  4. 비교로 `--muted #5b6670` 은 **5.86:1 로 통과**한다 → 교체 대상이 명확하다.
- 조치:
  1. `globals.css:44` `--faint` 를 **4.5:1 이상**으로 (약 `#6e7a86` 부근에서 성립).
     "장식적 보조색"이라는 역할 정의 자체가 위험했다 — 실제로는 법적 고지에 쓰였다.
  2. 그와 별개로 `Footer.tsx:78,84` 는 `text-faint` → **`text-muted`**,
     `text-xs` → `text-sm`. 법적 고지는 작게 쓰는 게 목적이 아니다.
  3. `PriceBars.tsx:152` `text-[10px]` → 최소 `text-[11px]`, 색은 `text-muted`.
  4. **`GOAL_PLAN` G4-6 을 "브랜드 색 대비 완료 / 뉴트럴 미검증" 으로 쪼갤 것.**
     "대비비 검증 `[x]`" 가 뉴트럴을 한 번도 보지 않은 채 체크된 것이 이 누락의 원인이다.

## C-30 [높음] `/api/leads` 레이트리밋 fail-open 평가 — **방향은 옳다. 지금 상태로 두면 안 된다.**

조정자 질문: "이 수정이 타당한지, 레이트리밋을 건너뛰는 fail-open 이 받아들일 만한지".
실측: `POST /api/leads` → **201 `{"ok":true}`**. 수정은 동작한다.

### 타당한 부분 (유지할 것)

1. **최소권한 분리가 맞다.** `001_init_schema.sql:242-244` `leads_public_insert` 가
   `anon` 의 조건부 INSERT(`consent_privacy = true`)를 이미 허용하므로, 접수 INSERT 에
   service_role 은 처음부터 불필요했다. 공개 엔드포인트가 RLS 전면 우회 키를 쥐고 있던
   구조(1차 C-06)가 제거된 것은 순수 개선이다.
2. **"부가 통제 때문에 본 기능이 죽는다"는 진단도 맞다.** 사이트의 유일한 목적이
   연락처 수집인데 보조 통제의 키 하나로 전면 500 이 되는 건 설계 오류였다.
3. 주석(`route.ts:60-71`)에 이유를 남긴 것도 옳다 — 다음 사람이 되돌리지 않는다.

### 받아들이면 안 되는 부분

4. **"남는 통제" 목록이 지금 거의 전부 허구다.** 주석(`:85-86`)은
   "Turnstile · honeypot · 당일 중복 unique index · Cloudflare Rate limit 이 남는다"고 적었다.
   실측하면:
   - **Turnstile 은 현재 모든 토큰을 통과시킨다.** `TURNSTILE_SECRET_KEY` 가 35자 —
     Cloudflare "항상 통과" 테스트 시크릿 길이다. 내가 보낸
     `"turnstileToken":"XXXX.DUMMY.TOKEN.XXXX"` 가 **그대로 통과해 201** 이 나왔다.
     봇 방지가 0 이다. (→ **C-34**)
   - **Cloudflare Rate limit 은 코드에 근거가 없다.** CLAUDE.md 확정사항에 적혀만 있고
     설정 여부를 코드·문서 어디서도 확인할 수 없다. 외부 의존을 fail-open 의 근거로
     쓰려면 "설정 완료" 증빙이 선행돼야 한다.
   - **당일 중복 index 는 다른 번호를 막지 않는다.** `phone_hash` + 날짜 유니크이므로
     같은 번호 2회만 막는다. 서로 다른 1,000개 번호에는 무효다.
   → **결론: 현재 상태의 fail-open 은 "다른 통제가 남아서 괜찮다"가 아니라
   "통제가 하나도 없다"에 가깝다.**
5. **degrade 가 조용하다.** 유일한 신호가 `console.warn`(`:88-90`)이다. Vercel 로그는
   아무도 상시 보지 않는다. 운영자는 레이트리밋이 켜진 줄 알고 운영한다 —
   C-11(조건부 2FA)과 **정확히 같은 실패 양식**이다: 보호가 조건부로 꺼지는데
   꺼진 사실이 화면에 나타나지 않는다.
6. **`if (ip && rateLimiter)`(`:92`) 의 `ip &&` 도 fail-open 이다.**
   `x-forwarded-for` 가 없으면(프리뷰·직접 접속·자체 호스팅) 제한이 통째로 사라지고
   이 경로는 경고조차 없다.
7. **보호 대상을 보면 fail-open 방향이 반대다.** 이 테이블은 (a) 개인정보를 담고,
   (b) 운영자가 상담 비용을 지출하는 대상이고, (c) **C-09 로 외부에 읽힌다.**
   → **C-32** 로 따로 적는다.

### 권고 — fail-open 딜레마를 없애는 쪽

레이트리밋이 service_role 을 필요로 하는 이유는 **anon 이 `leads` 를 SELECT 할 수 없기
때문**뿐이다. 그 SELECT 를 `security definer` 함수 하나로 바꾸면 의존이 사라지고
fail-open 선택 자체가 없어진다.

```sql
create or replace function lead_rate_count(p_ip inet, p_since timestamptz)
returns integer
language sql security definer set search_path = public, pg_temp
as $$ select count(*)::int from leads where ip = p_ip and created_at >= p_since; $$;

revoke all on function lead_rate_count(inet, timestamptz) from public;
grant execute on function lead_rate_count(inet, timestamptz) to anon;
```
- 반환이 **정수 하나**라 개인정보가 새지 않는다. (C-01 의 교훈대로 `grant` 를 **명시**한다)
- `route.ts:92-111` 을 `supabase.rpc("lead_rate_count", ...)` 로 바꾸면
  `rateLimiter`·`createAdminClient` 분기가 라우트에서 완전히 사라진다.
- 그러면 `/api/leads` 는 **anon 키 하나로 완결**된다. 이게 최소권한의 완성형이다.

임시 조치로는: `rateLimiter === null` 일 때 `/admin` 대시보드에 **경고 배너**를 띄워
환경변수 degrade 를 어드민에서 보이게 할 것. `TURNSTILE_SECRET_KEY` 가 테스트 키일 때도 같이.

## C-31 [높음] 대비 스윕이 놓친 위반 4종 — 흰 글자 on 통신사색, 막대 자체, 아이콘 칩

조정자 질문 2("놓친 대비 위반이 더 있는지")에 대한 답. C-29(뉴트럴) 외에 4건 더 있다.

1. **통신사 칩 선택 상태의 흰 글자 — 미수정.**
   `components/forms/LeadForm.tsx:120-125` — 선택 시 `"border-transparent text-white"` +
   `style={{ backgroundColor: 'var(--carrier-*)' }}`, 글자 `text-[0.8125rem]`(13px) bold.

   | 토큰 | 값 | 흰 글자 대비 | 13px bold 판정 |
   |---|---|---|---|
   | `--carrier-skylife` | `#00a0e9` | **2.92:1** | **미달** |
   | `--carrier-sk` | `#ea5b0c` | **3.50:1** | **미달** |
   | `--carrier-lg` | `#e6007e` | 4.50:1 | 경계 통과 |
   | `--carrier-kt` | `#e4002b` | 4.85:1 | 통과 |

   → KT스카이라이프·SK 를 고른 사용자는 **자기가 무엇을 골랐는지 읽을 수 없다.**
   히어로 폼의 첫 입력이다.
   조치: 선택 상태를 색면 대신 **흰 배경 + 통신사색 2px 테두리 + `text-foreground` 굵게 +
   통신사색 점**으로. G4 의 "초록은 면이 아니라 점" 원칙과도 맞고, 면으로 안 쓰면 4사 전부 안전해진다.
2. **`PriceBars.tsx:112` — 막대 자체가 비텍스트 대비 미달.**
   최저가 막대 `bg-brand`(`#07b040`) on 흰 = **2.88:1**, 나머지
   `bg-line-strong`(`#cbd5df`) = 약 **1.6:1**. WCAG 2.1 SC 1.4.11 은 **정보를 전달하는
   비텍스트 요소에 3:1** 을 요구하고, 차트 막대는 정의상 정보 전달 요소다.
   → 저대비 화면·야외에서 막대 높이 차이가 식별되지 않는다. 금액 비교 섹션인데.
   조치: `bg-brand` → `bg-brand-dark`(4.94:1), `bg-line-strong` → `bg-muted`(5.86:1),
   또는 막대에 `ring-1 ring-inset ring-line-strong` 로 윤곽.
3. **`app/(site)/[carrier]/page.tsx:62` — `bg-brand-light text-brand` 아이콘 칩 잔존.**
   `--brand` on `--brand-light`(`#dff7e6`) = **2.55:1**. 안의 `<Icon name="clipboard">` 는
   의미를 전달하는 그래픽이라 1.4.11 의 3:1 대상이다.
   (19곳 스윕이 `text-white` 패턴만 잡고 `text-brand` 패턴을 놓쳤다.) → `text-brand-deep`.
4. **닫기 버튼이 `text-faint`.** `Modal.tsx:50`, `StickyConsultBar.tsx:325` — 2.87:1(C-29).
   아이콘 전용 컨트롤이라 1.4.11 미달. → `text-muted`.

검증 권고: `scripts/check-contrast.mjs` 로 `--brand*/--muted/--faint/--line*/--accent*/
--carrier-*` 전 조합 비율을 출력하게 할 것.
**사람이 19곳을 눈으로 세는 방식이 이번에 5건을 놓쳤다.**

## C-32 [치명] 무제한 쓰기(C-30) + 공개 `live_feed`(C-09) = 메인 "실시간 신청현황"에 외부인이 내용을 써 넣을 수 있다

- 주장: CLAUDE.md 절대조항 1 — "실시간 신청현황은 **실제 `leads` 데이터만** 마스킹해서
  노출한다. 가짜 접수 데이터를 생성·시딩하는 코드를 짜지 않는다. **표시광고법 위반 소지.**"
- 실제: 세 사실을 겹치면 규칙이 형식적으로만 지켜진다.
  1. `POST /api/leads` 가 지금 **무제한**이다 — Turnstile 테스트 시크릿이 더미 토큰을
     통과시키고(C-34), service_role 이 없어 IP 제한이 꺼져 있고(C-30), 중복 index 는
     번호를 바꾸면 무효다. 실측으로 외부에서 2건을 넣었다.
  2. 들어간 행은 `live_feed` 뷰에 그대로 올라간다 —
     `masked_name = left(name,1) || '**'`(001:211), `carrier`, `status_label`.
  3. 그 뷰가 **anon 에 공개**다(C-09). 5건이 모이면 메인 섹션이 렌더된다.
- 왜 문제인가: 공격자가 `name` 과 `carrier` 를 골라 넣으면 **메인 페이지 사회적 증거 블록의
  내용을 외부에서 결정**할 수 있다. 데이터는 "실제 `leads`" 이므로 규칙 1의 문자는 지켜지지만,
  **규칙 1이 막으려던 것(허위 사회적 증거 = 표시광고법)은 그대로 발생**한다.
  규칙을 "코드로 가짜를 만들지 마라"로만 읽으면 이 경로가 통째로 빠진다.
- 조치: C-09(뷰 잠금) + C-30(레이트리밋 복구) + C-34(Turnstile 운영키)를 **한 묶음으로**.
  어느 하나만 고쳐도 경로가 닫히지만, 세 개가 모두 열린 현 상태는 단일 결함의 합이 아니라 곱이다.
  추가로 `live_feed` 에 `and name ~ '^[가-힣]{2,4}$'` 같은 형식 제한을 두면 장난 입력이
  화면에 올라오지 않는다.

## C-33 [높음] 방금 고친 것과 **같은 종류의 버그**가 암호화 호출에 그대로 남아 있다

- 주장: `route.ts:66-68` — "예전에는 라우트 첫 줄에서 `createAdminClient()` 를 불러
  키가 없으면 접수 자체가 500 으로 전면 중단됐다." → 그 패턴을 고쳤다.
- 실제: **똑같은 패턴이 두 줄 아래에 남아 있다.** `app/api/leads/route.ts:117-121`
  ```ts
  const { error } = await supabase.from("leads").insert({
    name: input.name,
    phone_enc: encryptPhone(phone),   // ENCRYPTION_KEY 없거나 64자 아니면 throw
    phone_hash: hashPhone(phone),     // PHONE_PEPPER  없으면 throw
  ```
  `lib/crypto.ts:17-19` 와 `:31` 이 각각 `throw` 한다. 이 두 호출은 **try/catch 밖**이다.
  → 두 키 중 하나라도 비면 1차 C-06 과 **완전히 동일한 증상**(본문 없는 HTTP 500,
  클라이언트는 "네트워크 오류"로 오안내)이 재현된다. 환경변수 하나 거리다.
- 왜 문제인가: service_role 사례는 "운영자가 키를 못 넣어서" 실제로 발생했다.
  `ENCRYPTION_KEY`·`PHONE_PEPPER` 는 `.env.example` 주석이 "자동 생성됨"이라 적혀 있어
  오히려 수동 확인을 건너뛰기 쉽다. CLAUDE.md 규칙 4 때문에 DB 백업으로 복구할 수도 없다 —
  분실 시 조용히 전면 장애가 된다.
- 조치: `route.ts:114-136` 을 try/catch 로 감싸고 catch 에서
  `console.error("[/api/leads] 암호화 실패 — ENCRYPTION_KEY/PHONE_PEPPER 확인")` + JSON 500.
  더 좋은 방법은 라우트 진입 직후 두 키의 존재를 검사해 설정 오류와 일시 장애를 로그에서
  구분하는 것. (1차 C-06 조치 3번과 함께)

## C-34 [높음] Turnstile 이 현재 모든 토큰을 통과시킨다 — 봇 방지가 사실상 비활성

- 주장: CLAUDE.md 확정사항 — "봇방지: Cloudflare Turnstile + honeypot 필드".
  `.env.example` 주석 — "운영 키 발급 전까지 Cloudflare 테스트 키 (항상 통과)".
  **문서는 정직하다.** 문제는 이 상태가 fail-open 의 근거로 인용됐다는 점이다(C-30).
- 실제: `TURNSTILE_SECRET_KEY` 길이 **35자** — Cloudflare "always passes" 테스트 시크릿
  (`1x0000000000000000000000000000000AA`)과 같다. 실측: 완전히 조작한 토큰
  `"XXXX.DUMMY.TOKEN.XXXX"` 로 `POST /api/leads` → **201**.
  즉 `lib/turnstile.ts:23` 의 `data.success === true` 가 더미 토큰에도 참이다.
- 왜 문제인가: honeypot(`route.ts:31-39`)만 남는데 그건 `website` 필드를 비워 두는 봇에 무효다.
  C-30 의 fail-open + C-09 의 공개 뷰와 겹쳐 C-32 가 된다.
  또 `GOAL_PLAN.md` 블로커 목록(129-134행)에 **Turnstile 운영키가 없다** — 런칭 차단 항목인데
  블로커로 승격되지 않았다.
- 조치: `GOAL_PLAN.md` 블로커에 "**4. Turnstile 운영 사이트키·시크릿 미발급 — 현재 테스트
  키로 모든 요청이 통과한다**" 추가. 코드에는 `lib/turnstile.ts` 에 시크릿이 `1x`/`2x`/`3x`
  로 시작하면(테스트 키 접두사) `console.warn` + 어드민 배너 노출 가드를 둘 것.

## C-35 [중간] QA 테스트 접수 행 — **"코드 위반 아님"에는 동의, "운영 전 삭제"에는 동의하지 않는다 (지금 노출 중이다)**

조정자 판단: "가짜 데이터를 생성하는 **코드**를 짜지 말라는 규칙이므로 수동 QA 1건은
위반이 아니나, 운영 전 삭제가 필요하다."

### 동의하는 부분

규칙 1의 금지 대상은 문자 그대로 **코드**다("가짜 접수 데이터를 생성·시딩하는 **코드**를
짜지 않는다"). 시드·스크립트·테스트 픽스처에 `leads` INSERT 가 **0건**임을 1차에서 확인했고
(C-10) 그 상태는 지금도 유지된다. 수동 QA 1건은 그 금지 조항의 위반이 아니다. 동의한다.

### 동의하지 않는 부분 — 시점

"**운영 전** 삭제"라는 판단은 규칙 1의 **목적 조항**을 놓쳤다. 규칙이 든 이유는
"표시광고법 위반 소지"다. 그 해악은 **가짜 접수가 사회적 증거로 보여질 때** 발생하고,
행을 코드가 만들었는지 사람이 만들었는지와 무관하다. 그리고 —

**그 행은 이미 외부에 노출돼 있다.** C-09 실측:
```
GET /rest/v1/live_feed?select=*   (공개 anon 키)
  → [{"applied_date":"26-10-08","carrier":"KT","masked_name":"테**", ...}]
```
UI 게이트(5건 미만 미렌더)는 Next 라우트에만 있고 뷰에는 없다.
즉 **"운영 전"이라는 유예가 성립하지 않는다.** 지금 조회 가능한 상태다.

부수 영향:
- 그 IP 의 레이트리밋 윈도우(10분 3건)를 소모한다.
- 해당 번호의 당일 중복 unique index 를 점유해 같은 번호 재테스트가 409 로 막힌다.
- 003 이 적용되면 `purge_at` 계산 대상에 들어가고, C-01 의 공개 파기 함수로 **외부에서
  지워질 수도 있다** (= 테스트 흔적이 소리 없이 사라져 추적이 어려워진다).
- **그리고 내가 2건째를 더 넣었다** (`검증` / `010-9999-8888`). 내 책임이다.

### 결론과 권고

- 판정: **규칙 1(코드 금지) 위반 아님. 다만 규칙 1의 목적(허위 사회적 증거) 관점에서는
  "현재 노출 중인 비실제 접수"이므로 즉시 삭제 대상이다.** "운영 전"이 아니라 "지금".
- 삭제: `leads` 에서 `name` 이 `테스트`·`검증` 인 2행을 제거한 뒤
  `GET /rest/v1/live_feed` 가 `[]` 인지 확인.
- **앞으로의 QA 규약 (본질적 해결):**
  `live_feed` 정의가 `where status not in ('CANCEL','SPAM')`(001:225) 다.
  → **QA 접수는 넣은 직후 `status='SPAM'` 으로 바꾼다.** 그러면 뷰가 구조적으로 배제하므로
  지우는 것을 잊어도 화면·공개 API 에 절대 올라오지 않는다. 제거보다 안전한 규약이다.
  더 깔끔한 쪽은 Supabase 브랜치(또는 별도 프로젝트)를 QA 전용으로 두는 것.
- `docs/` 에 "QA 로 넣은 행 목록"을 남기는 관행도 권한다. 지금은 이름으로 추측해야 한다.

---

# 추가분 — 모바일(390px) · 접근성 전수

별도 전수 조사를 내가 확인한 것이다. 각 항목 `file:line` 고정. 조정자 항목 3·4·5
(신규 섹션 4개 / 상세 고지 5블록 / 히어로 CTA·신뢰칩 / 홍보 슬롯)는 라이브 HTML 로
렌더를 확인했고 1차 E 섹션의 P0 판정표에 반영돼 있다.

## C-36 [높음] 화면 밖 컨트롤들이 탭 순서에 남아 있다 — 포커스가 보이지 않는 곳으로 간다

- `components/forms/StickyConsultBar.tsx:313` — 바가 `translate-y-full` 로 화면 밖인데
  `inert` 도 `aria-hidden` 도 없다. 스크롤 0 에서 Tab 을 누르면 전화 링크·상담 신청 버튼
  **2개에 포커스가 들어간다**(보이지 않는 상태로).
- `components/ui/BackToTop.tsx:33` — 숨김 상태가 `opacity-0 pointer-events-none translate-y-2`.
  `hidden`/`inert` 가 없어 모든 공개 페이지에서 "맨 위로" 버튼이 탭 순서에 상주한다.
  (`pointer-events-none` 은 탭 순서에 영향이 없다.)
- `components/sections/Header.tsx:178` — **더 나쁘다.** 닫힌 드로어 컨테이너에
  `aria-hidden={!open}` 을 걸었는데 그 안의 링크·버튼이 여전히 포커스 가능하다 →
  WCAG `aria-hidden-focus` **직접 위반**(숨겼다고 선언한 영역에 포커스가 들어간다).
- 왜 문제인가: 키보드 사용자는 Tab 을 누를 때마다 "포커스가 어디 갔는지 모르는" 구간을
  최소 3번 지난다. `globals.css:247` 이 `:focus-visible` 링을 제대로 넣어 둔 노력이
  보이지 않는 요소 위에서 무효화된다.
- 조치: 세 곳 모두 숨김 상태에 **`inert`** 추가. `aria-hidden` 만으로는 부족하다 —
  `inert` 가 포커스와 AT 를 동시에 끊는다.

## C-37 [높음] 모바일 바텀시트가 dialog 가 아니고, `Modal` 에도 포커스 트랩이 없다

- `components/forms/StickyConsultBar.tsx:315` — 전체 화면 스크림 + 하단 시트인데
  `role="dialog"` 없음, `aria-modal` 없음, 열 때 포커스 이동 없음, 트랩 없음,
  닫을 때 포커스 복귀 없음, **Escape 핸들러 없음**. 배경 본문도 스크롤된다.
- `components/forms/StickyConsultBar.tsx:307` — 스크림이 `<div onClick>` 이고
  `role`·`tabIndex`·키 핸들러가 없다 → 바깥 클릭 닫기가 마우스 전용.
- `components/ui/Modal.tsx:37` — `role="dialog" aria-modal="true"` 는 **선언했지만**
  포커스를 안으로 옮기지 않고 Tab 을 가두지 않으며 닫을 때 트리거로 되돌리지 않는다.
  Tab 이 스크림 뒤 본문으로 그대로 걸어 나간다. (Escape 는 동작한다.)
- `components/ui/Modal.tsx:41` — `max-h-[80vh] overflow-y-auto` 컨테이너에 `tabIndex={0}` 이
  없고 내부 포커스 가능 요소가 헤더 닫기 버튼 하나뿐이다 →
  **긴 약관 본문을 키보드로 스크롤할 수 없다.** C-05 를 고쳐 약관 전문을 넣으면
  그 전문을 키보드 사용자가 읽을 수 없게 된다. (순서 의존 — 실행순서 9번 참조)
- `components/sections/Header.tsx:188` — 드로어도 같다. Escape 는 닫지만(`:63`)
  포커스가 사라진 영역에 남는다.
- `components/forms/StickyConsultBar.tsx:383` — 동의 `<label>` **안에** `<button>`("자세히")
  이 들어 있다. 체크박스의 계산된 접근명이
  `"[필수] 개인정보 수집 및 이용에 동의합니다. 자세히"` 가 되고 중첩 컨트롤이 라벨 활성화
  대상이 된다. **필수 동의 체크박스에서 일어나면 안 되는 일이다** — 규칙 2의 "분리"가
  시각적으로는 지켜지지만 AT 에는 한 덩어리로 읽힌다.
- 조치: `Modal.tsx` 에 포커스 트랩 + 진입 포커스 + 복귀를 구현하고(약 30줄)
  바텀시트를 그 `Modal` 로 **교체**해 구현을 하나로 모을 것.
  스크롤 컨테이너에 `tabIndex={0}`. `:383` 의 "자세히" 버튼을 `<label>` **밖으로**.

## C-38 [높음] JS 가 실패하면 하단 상담바가 영구히 화면 밖이고, 홍보 밴드는 문장 조각만 남는다

- `components/forms/StickyConsultBar.tsx:110` — SSR HTML 에 `translate-y-full` 로 나가고
  `:55` 의 스크롤 리스너(`window.scrollY > innerHeight * 0.72`)만이 올려준다.
  번들이 깨지면 **주 전환 표면이 영구 오프스크린**이다.
- `components/sections/PromoBand.tsx:49` — 화면에 칠하는 건 `frames[index]` 한 장뿐이고
  `index` 는 `setInterval` 로만 증가한다. JS 가 죽으면 눈에 보이는 건
  **"인터넷 · TV 가입"** 조각 하나다. 완성 문장은 `:66` 의 `sr-only` 에만 있어
  **눈으로 보는 사람에게는 영원히 미완성 문장**이다.
- 대비: `components/ui/Reveal.tsx:8-11` 은 바로 이 함정을 피하려고 "감추는 일은 JS 가 한다"로
  설계됐고, `globals.css:186-190` 은 막대차트에 같은 원칙을 적용했다
  ("JS 가 죽든 애니메이션이 안 돌든 차트는 항상 올바른 높이로 보인다").
  **원칙은 있는데 이 두 컴포넌트에 적용되지 않았다.**
- 조치:
  - `StickyConsultBar` — SSR 기본 상태를 `translate-y-0`(보임)으로 두고 JS 마운트 후에
    숨김을 시작하게 뒤집는다(`Reveal` 과 같은 방향).
  - `PromoBand` — 기본 렌더를 **전체 문장 1장**으로 두고 JS 마운트 후에만 프레임 순환으로
    교체한다. 그러면 JS 실패 시 완성 문장이 남는다.
- 참고: `PromoBand.tsx:71` 은 `minHeight` 를 쓰는데 `:17` 주석은 고정 높이라고 적혀 있다 →
  프레임마다 줄바꿈이 달라지면 밴드 높이가 2.4초마다 변해 아래 전체가 밀린다.
  `PROMO_BAND.frames` 는 운영자 편집 대상(`site-config.ts:132`)이라 실제로 발생할 수 있다.

## C-39 [높음] 하단 고정바 실제 높이(~93px)가 레이아웃 예약(72px)보다 커서 푸터 마지막 줄을 가린다

- `app/(site)/layout.tsx:14` 가 `pb-[4.5rem]`(**72px**) / `lg:pb-[5.5rem]`(88px)을 예약한다.
- `components/forms/StickyConsultBar.tsx:420-423` 모바일 바는 `grid grid-cols-2` +
  `style={{ paddingBottom: "env(safe-area-inset-bottom)" }}` 이고, 각 셀이 `py-4`(32px) +
  폰트 16px × `line-height:1.7`(globals.css:159, 약 27px) ≈ **59px**, 여기에
  홈 인디케이터 safe-area ≈ 34px → **약 93px**.
- 왜 문제인가: 93 − 72 = **약 21px 만큼 푸터 마지막 줄이 가려진다.** 가려지는 내용이
  하필 `Footer.tsx:84` 의 법적 고지문(= C-29 로 이미 안 읽히는 그 문구)이다.
  고지가 안 읽히는 데다 잘린다.
- 조치: 예약값을 상수로 뽑아 바와 레이아웃이 **같은 값**을 쓰게 한다 —
  `layout.tsx:14` 를 `pb-[calc(5.75rem+env(safe-area-inset-bottom))]` 로, 또는 바 높이를
  CSS 변수(`--bar-h`)로 내보내고 레이아웃이 그걸 쓰게 할 것.
  (1차에서 산술상 겹치지 않는다고 본 Turnstile·BackToTop 스택은 그대로 유효하다 —
  문제는 바 자신의 높이였다.)

## C-40 [높음] `Reviews` 가 평점 NULL 을 **5점 만점**으로 꾸며낸다 — 규칙 1의 목적을 정면으로 어긴다

- 주장: CLAUDE.md 절대조항 1 — 가짜 데이터 금지, "표시광고법 위반 소지".
  `site-config.ts:305` — "**확인된 사실만 적는다**".
- 실제: `components/sections/Reviews.tsx:24-25`
  ```ts
  function Stars({ rating }: { rating: number | null }) {
    const r = rating ?? 5;
  ```
  `ReviewItem.rating` 은 `number | null`(`:9`)이고 DB 도
  `rating smallint check (rating between 1 and 5)` — **nullable**(001:168)이다.
  즉 평점을 남기지 않은 후기가 화면에서 **별 5개 꽉 찬 만점**으로 렌더되고,
  `:27` 의 `aria-label` 도 `"5점 만점에 5점"` 을 읽는다.
- 왜 문제인가: 이건 "가짜 데이터를 **생성**하는 코드"다 — 규칙 1이 금지한 바로 그것이
  `leads` 가 아니라 `reviews` 쪽에서 일어났다. **C-35 의 수동 QA 행보다 훨씬 명백한 위반**이다.
  없는 평점을 최고점으로 올리는 건 방향까지 유리한 쪽이라 변명 여지가 없다.
  `lib/plans.ts:224` 는 "값이 하나도 없으면 null (**0 으로 둘러대지 않는다**)" 로 같은 원칙을
  지켰는데 후기 쪽은 반대로 갔다.
- 조치: `Reviews.tsx:25` 를 삭제하고 **`rating == null` 이면 별을 아예 렌더하지 않는다**
  (`PlanTable` 이 `gift_amount` 전 행 NULL 일 때 열을 숨기는 것과 같은 처리 — G-07 해법 재사용).
  그리고 `?? ` 로 기본값을 채우는 모든 지점을 "둘러대기인가" 기준으로 점검 대상에 올릴 것.
  (같은 패턴 점검 결과 `formatWon`/`formatContract`/`minMonthlyFee` 는 깨끗하다.)
  **1줄 수정이라 가장 빨리 끝나는 치명급 항목이다.**

## C-41 [중간] `PriceBars` 가 빈 배열·0원·3개 결과에서 깨진다 + 섹션 카피가 "4사"로 고정이다

- `components/sections/PriceBars.tsx:55` — `Math.max(...items.map(...))` 는 빈 배열에서
  `-Infinity` 를 반환하고 `step`/`ticks`/막대 높이가 전부 음수·`-Infinity` 로 전파된다.
  유일한 가드가 **호출부**(`PriceCompare.tsx:22`)에 있어 다른 곳에서 재사용하면 터진다.
- `:93` — 모든 `monthly_fee` 가 0 이면 `h = Math.round((0/0)*TRACK)` = **`NaN`** 이
  `style={{height: NaN}}` 으로 나가고, `ticks` 4개가 모두 `0` 이 되어 `:72`/`:86` 에서
  **React key 중복**이 발생한다.
- `:79` 와 `:124` — `grid-cols-4` **하드코딩**. 호출부는 `items.length >= 3` 만 보장한다
  (`PriceCompare.tsx:22`). 한 통신사에 500M+TV 결합이 없으면 3개가 되어
  **막대 3개가 왼쪽 3/4 에 몰리고 네 번째 칸이 빈다.**
- `components/sections/PriceCompare.tsx:29` — 그 경우에도 설명이
  **"4사를 나란히 놓았습니다"** 로 고정이다. 3개를 보여주면서 4사라고 말한다
  (라이브에서 확인한 "같은 조건" 문제(C-08)와 같은 계열의 카피-데이터 불일치).
- 왜 문제인가: 지금은 4사 모두 500M 결합이 있어 우연히 4개다. 운영자가 `is_active=false` 로
  한 상품을 내리거나 **다모아 72행 시드를 적용하면(C-02) 조합이 바뀐다** —
  시드 교체가 이 버그의 방아쇠가 될 수 있으니 순서상 같이 봐야 한다.
- 조치: `:55` 에 `if (items.length === 0) return null;` 자체 가드, `:93` 에 `ceil > 0` 검사,
  `grid-cols-4` 를 `items.length` 기반 인라인 `gridTemplateColumns` 로,
  `PriceCompare.tsx:29` 문구를 `${items.length}사` 로 보간, `ticks` key 는 인덱스로.

## C-42 [중간] `PlanTable` 의 우측 페이드가 스크롤 컨테이너 **밖**에 있어 끝까지 밀어도 32px 를 계속 가린다

- `components/sections/PlanTable.tsx:153` — 페이드 레이어가 `overflow-x-auto` 컨테이너의
  **형제**다. 컨테이너 내부가 아니라 뷰포트 기준으로 고정돼 있어 오른쪽 끝까지 스크롤한
  뒤에도 **마지막 32px 이 흐려진 채 남는다.** 그 자리에 오는 값이 `약정`(+사은품 열이
  살아 있는 경우 그 값)이다.
- 왜 문제인가: G-09 를 "힌트 텍스트로 해소"(1차 판정 ✅)했는데 그 해법에 딸려 온 페이드가
  **읽어야 할 값을 영구히 가린다.** 390px(컨테이너 358px)에서 750px 표를 끝까지 밀어도
  마지막 열이 선명해지지 않는다.
- 조치: 페이드를 컨테이너 **안**으로 넣고 `position: sticky; right: 0` 로 붙이거나,
  `mask-image` 를 컨테이너 자신에 적용하고 끝에서 해제. 가장 단순한 해법은
  **페이드를 제거하고 힌트 텍스트만 남기는 것** — 힌트가 이미 있다.

## C-43 [중간] 바텀시트가 열린 상태에서 Turnstile 챌린지가 시트 위를 덮는다

- `components/forms/StickyConsultBar.tsx:121` — Turnstile 슬롯이
  `fixed right-4 bottom-24 z-50`(하단 96~161px 대역, 챌린지 렌더 시 약 300×65).
- `:315` — 열린 시트가 `z-40`.
- → `z-50 > z-40` 이므로 챌린지 박스가 시트의 **관심상품 셀렉트 / 이름 입력칸 위에 뜬다.**
- 왜 문제인가: 챌린지가 실제로 뜨는 건 봇 의심 시점, 즉 **정상 사용자도 한 번은 겪는 상황**이다.
  그때 입력칸이 가려져 접수가 중단된다. 현재는 테스트 시크릿(C-34)이라 챌린지가 안 떠서
  **발견되지 않는 결함**이다 — 운영키로 바꾸는 순간 드러난다.
- 조치: 시트가 열려 있을 때는 Turnstile 슬롯을 시트 **내부**(폼 하단)로 옮기거나
  `bottom` 값을 시트 높이 위로 올릴 것. z-index 를 낮추면 챌린지를 누를 수 없게 되므로
  위치를 옮기는 쪽이 맞다.

## C-44 [중간] 입력칸 접근명 누락이 `StickyConsultBar` 4곳에도 있다 (C-19 확장)

- `components/forms/StickyConsultBar.tsx:220`(데스크톱 이름), `:230`(데스크톱 연락처),
  `:349`(모바일 시트 이름), `:359`(모바일 시트 연락처) — 모두 `placeholder` 만 있고
  `<label>`/`aria-label`/`aria-labelledby` 가 없다.
- 즉 사이트의 **접수 입력칸 6개 전부**(`LeadForm` 2 + 여기 4)가 접근명이 없다.
  그 placeholder 색마저 `--faint` 2.87:1 이다(C-29).
- 조치: C-19 와 동일 — `Field.tsx` 에 `sr-only` 라벨을 강제하는 래퍼를 만들고 6곳 일괄 교체.
  **한 곳씩 고치면 또 빠진다** (이번에 `<select>` 만 `aria-label` 이 붙어 있던 것이 그 증거다).

## C-45 [중간] 요금 계산기의 금액 변경이 스크린리더에 알려지지 않는다

- `components/sections/PlanCalculator.tsx:162` — 칩을 누르면 합계 금액이 제자리에서
  교체되는데 `aria-live`/`role="status"` 영역이 없고 포커스도 움직이지 않는다.
- 왜 문제인가: 계산기의 전체 가치가 "고르면 즉시 금액이 바뀐다"인데 AT 사용자에게는
  **아무 일도 일어나지 않은 것과 구분되지 않는다.** 칩이 눌린 것만 알고 결과를 모른다.
- 조치: 결과 패널을 `<output role="status" aria-live="polite" aria-atomic="true">` 로 감쌀 것.
  (C-16 의 "휴대폰 미포함" 라벨 수정과 같은 커밋에서)

## C-46 [낮음] `Reviews` 카드의 제목·본문이 잘리는데 전문을 볼 경로가 없다

- `components/sections/Reviews.tsx:79` — 제목 `line-clamp-1`, `w-72` 카드(패딩 제외 248px)
  → 한글 약 15자에서 잘린다. `title` 속성도, 전문 링크도 없다.
- `:83` — 본문 `line-clamp-3`, 말줄임 단서나 "더보기" 가 없다.
- 왜 문제인가: "후기·공지 게시판 `[ ]`" 가 미완이라 상세 페이지가 없고(= C-14 의 `/review` 404)
  **잘린 텍스트의 전문을 볼 방법이 어디에도 없다.** 후기는 신뢰 블록인데 읽을 수 없는 신뢰 블록이다.
- 조치: 게시판 구현(C-14)과 묶어 카드 전체를 `/review/[id]` 로 링크. 그때까지는
  `line-clamp-3` → `line-clamp-4`, 제목 clamp 를 2줄로.

## 전수 조사에서 "깨끗함"으로 확인된 파일 (오탐 방지 기록)

`useLeadSubmit.ts`(C-21 외) / `CarrierHub.tsx` / `CarrierHero.tsx` / `PlanCards.tsx` /
`SectionHeading.tsx` / `Icon.tsx`(전 아이콘 `aria-hidden="true" focusable="false"` 일관,
아이콘 전용 컨트롤은 모두 자체 `aria-label` 보유) / `LegalLinks.tsx`(죽은 `<span>` 을
진짜 `<button type="button">` 으로 바꾼 것은 개선 — 약점은 `Modal` 쪽 C-37 뿐) /
`app/(site)/[carrier]/page.tsx`(`dynamicParams=false` + `generateStaticParams` 로 미등록 slug
404, 요금 0건 분기가 빈 표 대신 빈 상태를 렌더, `scroll-mt-24`(96px)가 모바일 헤더를 넘김,
h1→h2→h3 순서 유지) / `PlanTable.tsx`(C-42 외 — `<th scope="col">`, 행 라벨 `<th scope="row">`,
750px `minWidth` 를 `overflow-x-auto` 로 감싸고 힌트 제공, 네이티브 `<details>` 로 접힌 행도
DOM 에 남김) / `PriceBars` 의 막대 기하학(인라인 픽셀 높이 + `[data-bar-run="true"]`
오버레이로 JS 실패 안전 — 설계 의도대로 동작).

---

# 실행 순서 — 2차 반영 최종판 (치명·높음만)

1차 순서를 다음으로 **대체**한다. 신규·상향 항목을 반영했다.

### 0단계 — DB 잠금 (다른 어떤 것보다 먼저, 순서 엄수)

1. **C-01 + C-09** `005` 마이그레이션 —
   `purge_expired_leads`/`purge_old_access_logs` 의 execute 를 anon·authenticated·public 에서 회수,
   `live_feed` 에 `security_invoker = true` 설정 + anon·authenticated 회수.
   **C-09 는 이제 실측으로 확정된 구멍이다.** 5건 게이트도 뷰 안으로 옮길 것.
   → 이걸 먼저 하지 않고 003 을 적용하면 공개 파기 엔드포인트가 활성화된다.
2. **C-35** QA 행 2건(`테스트`, `검증`) 즉시 제거 + 앞으로 QA 는 `status='SPAM'` 규약.
   이후 `GET /rest/v1/live_feed` 가 `[]` 인지 확인.
3. **C-02** 다모아 시드 적용(복제 카피 12행 제거). 검증: `description=not.is.null` 0행, count 72.
   ⚠ 시드 교체가 **C-41**(막대 3개 케이스)의 방아쇠가 될 수 있으니 29번과 같이 본다.

### 1단계 — 봇·쓰기 통제 복구 (C-32 를 닫는 3종 묶음)

4. **C-34** Turnstile 운영 사이트키·시크릿 발급·기입. `GOAL_PLAN` 블로커에 추가.
   테스트 키 접두사 감지 경고를 `lib/turnstile.ts` 에 삽입.
5. **C-30** 레이트리밋을 `lead_rate_count(inet, timestamptz)` **security definer RPC** 로 이전
   → service_role 의존과 fail-open 자체를 제거. 그 전까지는 degrade 상태를
   `/admin` 대시보드 배너로 **보이게** 할 것(`console.warn` 불충분).
   `if (ip && ...)` 의 IP 부재 fail-open 도 같이 로깅.
6. **C-33** `route.ts:114-136` 을 try/catch 로 감싸 `ENCRYPTION_KEY`/`PHONE_PEPPER` 미설정 시
   본문 없는 500 이 나지 않게. (방금 고친 것과 같은 버그 종류다)
7. **C-43** Turnstile 슬롯을 바텀시트 내부로 — 4번을 하면 바로 드러나는 결함이다. 같이 처리.

### 2단계 — 법적 고지 (런칭 차단)

8. **C-03** 보유기간 정합(운영 흐름 결정 → 003 적용+cron, 또는 고지 문구 수정).
   그때까지 `PRIVACY_PROMISE.points[3]` 문장은 내릴 것.
9. **C-05** `content/privacy.mdx` 법정 9항목(엑셀 배분 = 제3자 제공/위탁 명시) + `terms.mdx`.
   ⚠ **C-37**(Modal 스크롤 컨테이너 `tabIndex` 없음)을 먼저 고치지 않으면
   약관 전문을 키보드로 읽을 수 없다. 같이 처리.
10. **C-04** 사업자정보 실제 값. + **C-29** 로 그 영역의 색·크기도 같이 올릴 것 —
    값만 넣고 2.87:1 / 12px 로 두면 "표시했으나 읽히지 않는" 상태가 남는다.
11. **C-07** `NEXT_PUBLIC_TEL` 기입 + 폴백 제거 + 미설정 시 전화 버튼 미렌더.
12. **C-29** `--faint` 토큰을 4.5:1 로 조정 + `Footer.tsx:78,84` 를 `text-muted`/`text-sm` 으로.
    `scripts/check-contrast.mjs` 로 전 토큰 조합 자동 검사(사람 눈 스윕이 5건을 놓쳤다).

### 3단계 — 표시광고 리스크

13. **C-40** `Reviews.tsx:25` `rating ?? 5` 제거 — 평점 NULL 이면 별 미렌더.
    **규칙 1이 금지한 "가짜 데이터 생성 코드"의 명백한 실례이고 1줄 수정이다. 가장 먼저 끝난다.**
14. **C-08** `PriceCompare` 를 G1-4 완료 전까지 렌더 가드(`PRICE_SOURCE.verified`),
    "같은 조건"/"4사" 카피 수정(**C-41** 과 동일 파일), 정렬을 금액순→통신사 고정순.
15. **C-16** 요금 계산기 "휴대폰 미포함" 라벨·합산 로직 수정 (+ **C-45** `aria-live` 동봉).
16. **C-18** 카피 수정 — "바로 받아"·"책임지고 수리"·"최대한" 제거, FAQ 와 정합, 상호 단일화.

### 4단계 — 어드민 보안·데이터 무결성

17. **C-11** TOTP 미등록 계정 **거부** (2FA 를 실제 필수로).
18. **C-13** `/api/admin/export` POST 전환 + `Origin`/`Sec-Fetch-Site` 검증(logout·PATCH 도).
19. **C-12** `exported_at` 갱신을 단일 트랜잭션 RPC 로 + "내보냄 표시 해제" 복구 경로.
20. **C-23** 로그인 락아웃(5회/15분).

### 5단계 — 전환·접근성

21. **C-14** 헤더의 `/review` `/notice` 메뉴 제거(또는 게시판 구현). SEO 보다 먼저.
22. **C-38** `StickyConsultBar`·`PromoBand` 기본 상태를 "보임"으로 뒤집기
    (`Reveal.tsx` 와 `globals.css:186-190` 에 이미 있는 원칙 적용).
23. **C-36** 오프스크린 컨트롤 3곳에 `inert`.
24. **C-37** `Modal` 포커스 트랩·진입·복귀 구현 → 바텀시트를 그 `Modal` 로 교체,
    `:383` 의 "자세히" 버튼을 `<label>` 밖으로.
25. **C-39** 하단바 실높이와 `layout.tsx:14` 예약값을 하나의 상수로 통일.
26. **C-19 + C-44** 입력칸 **6개 전부**에 `sr-only` 라벨 + `aria-invalid`/`aria-describedby`.
27. **C-31** 남은 대비 위반 4종 — 통신사 칩 흰 글자(선택 상태를 면 → 테두리로),
    `PriceBars` 막대(`bg-brand`→`bg-brand-dark`, `bg-line-strong`→`bg-muted`),
    `[carrier]/page.tsx:62` `text-brand`→`text-brand-deep`, 닫기 버튼 `text-faint`→`text-muted`.
28. **C-15** `LiveFeed` 모바일 3열 전환 — **리드 5건 도달 전에** 끝낼 것.
29. **C-41** `PriceBars` 빈배열/0원/3개 가드(3번 시드 교체와 함께 검증).
30. **C-42** `PlanTable` 페이드 제거 또는 sticky 전환.

### 6단계 — GOAL_PLAN 정정

31. 1차 20번 목록에 다음을 **추가**한다.
    - `G4-6` → "브랜드 색 대비 **완료** / **뉴트럴(`--faint`) 미검증**" 으로 쪼갤 것 (C-29).
      "19곳 일괄 교정"은 사실이고 성과지만, 검사 **범위**가 `--brand` 로 한정됐다는 것을
      문서에 남겨야 같은 누락이 반복되지 않는다.
    - `/api/leads` 항목 → "anon INSERT 로 전환해 201 동작 확인. 단 레이트리밋 fail-open
      (C-30)·암호화 키 미보호(C-33) 잔존" 으로 조건부 완료.
    - 블로커에 **"4. Turnstile 운영키 미발급 — 현재 모든 토큰 통과"** 추가 (C-34).
    - 블로커에 **"5. `live_feed` 뷰가 anon 에 공개 — 실측 확인"** 추가 (C-09).
    - "메인 랜딩 퍼블리싱 1차 `[x]`" 의 잔여(약관 전문·사업자정보)를 블로커로 승격.

---

## 2차에서 미확인으로 남긴 것

1. **어드민 실행 경로** — 여전히 밟지 못했다. `SUPABASE_SERVICE_ROLE_KEY` 가 비어 있고
   어드민 계정이 없다. C-12/C-13/C-20 은 코드 근거가 명확하지만 엑셀 서식·시트 분리·
   날짜 표시는 **미검증**이다.
2. **`next build` 수치** — 1회분 실측이며 지시에 따라 이후 빌드를 돌리지 않아 재검증하지
   않았다. C-24 의 239kB / 271kB / CSS 128kB 는 그 1회 값이다.
3. **390px 실기기** — 전부 마크업 산술 판단이다(C-15, C-39, C-41, C-42, C-43).
   특히 C-39 의 `env(safe-area-inset-bottom)` 실제 값은 기기별로 다르다.
4. **C-36/C-37 의 실제 포커스 이동** — 코드 정독 판단이다. 키보드로 Tab 을 눌러
   확인하지 않았다(브라우저 자동화 미사용).
5. **마이그레이션 003 적용 후의 동작** — 적용되지 않았으므로 트리거 정확성·백필 결과는
   미검증이다. 적용 시 C-01 선행이 필수라는 점만 확정이다.
6. **`--faint` 교체 후보값 `#6e7a86`** — 4.5:1 성립을 손계산으로 확인했으나
   실제 적용 후 디자인 인상 변화는 미검토다.
