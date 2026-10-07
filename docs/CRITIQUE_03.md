# 비평 3라운드 (docs/CRITIQUE_03.md)

작성: 2026-10-08 · 대상: `CRITIQUE_01.md` / `CRITIQUE_02.md` **이후에 바뀐 것**과
**아직 아무도 읽지 않은 파일**. 1·2라운드와 중복되는 지적은 일부러 넣지 않았다.

## 검증 방법 (실제로 한 것)

| 수단 | 결과 |
|---|---|
| `cd FE && npx tsc --noEmit` | 오류 0 |
| `cd FE && npx eslint .` | 오류 0 |
| `node FE/scripts/verify-goals.mjs` | 코드 31/31 통과 · 라이브 0/4 |
| `curl localhost:3100` — `/` `/kt` `/sk` `/lg` `/skylife` `/api/feed/live` | 전부 200 |
| `lib/admin/login-throttle.ts` 를 `tsc` 로 뽑아 **가짜 시계로 실행** | E-01·E-02 실측 |
| `node_modules/zod` 를 직접 불러 v4 오류 메시지 확인 | E-08 의 XSS 가설 반증 |
| 코드 정독 | 아래 전부 |

**쓰기는 한 건도 하지 않았다.** `npx next build` 미실행, `leads` INSERT 미실행,
Supabase 는 `verify-goals.mjs` 의 읽기(`GET` + `OPTIONS`)만.

---

## E-01 [치명] 외부인이 요청 30번으로 어드민 단일 계정을 잠그고, 15분마다 반복해 영구 봉쇄할 수 있다

- **주장**: `FE/lib/admin/login-throttle.ts:26-27` —
  "이메일 단독: 1시간 30회 — IP 를 아무리 회전해도 **계정당 총량**이 묶인다.
  **운영자가 정상적으로 도달할 수 없는 수준이라 서비스 거부로 쓰이기 어렵다.**"
- **실제**: 모듈을 떼어내 가짜 시계로 돌린 실측값.

  ```
  IP 회전 40회 (1초 간격): 허용 30 / 차단 10
  정상 운영자 통과 가능?   { allowed: false, retryAfter: 3560 }
  ```

  `app/api/admin/login/route.ts:48-65` 의 `checkLogin` 게이트는
  `signInWithPassword` **앞**에 있다. 즉 **비밀번호와 TOTP 가 모두 맞아도 429** 다.
  방어 논리가 거꾸로 섰다 — "운영자가 도달할 수 없는 수준"이 방어의 근거가 되려면
  *공격자도* 도달하기 어려워야 하는데, 공격자가 치르는 비용은 **HTTP 요청 30번**이다.
- **왜 문제인가**: 어드민은 **계정 1개**다(`CLAUDE.md` 확정사항). 우회 로그인 경로도,
  잠금 해제 수단도 없다.

  재현 입력 — 운영자 이메일만 알면 된다(`admin_users` 에 쓴 주소, 혹은 추측):
  ```bash
  for i in $(seq 1 30); do
    curl -s -X POST http://HOST/api/admin/login \
      -H 'Content-Type: application/json' \
      -H "X-Forwarded-For: 10.0.0.$i" \
      -d '{"email":"admin@example.com","password":"x"}' >/dev/null
  done
  # 이후 운영자가 올바른 자격증명으로 로그인 → 429
  ```
  이후 **15분마다 30회**(= 분당 2회)만 흘려 보내면 접수 데이터를 영구히 열 수 없다.
  D-07 이 지적한 "XFF 회전으로 IP 축이 뚫린다"를 막으려고 넣은 계정 축이,
  **같은 XFF 회전을 서비스 거부 수단으로 바꿔 놓았다.** 2라운드 대응이 만든 회귀다.
- **조치**:
  1. `login-throttle.ts` — 계정 축을 **하드 차단에서 지연(tarpit)으로** 바꾼다.
     `checkLogin` 이 `{allowed:false}` 대신 `{delayMs}` 를 돌려주고 라우트가
     `await sleep(delayMs)` 후 정상 인증을 진행하면, 대입 비용은 그대로 올리면서
     정당한 로그인은 막지 않는다.
  2. 식별자를 `x-forwarded-for[0]` 에서 **신뢰 가능한 값**으로 바꾼다 —
     Cloudflare 경유이므로 `cf-connecting-ip`(`lib/admin/audit.ts:25-28` 도 함께).
     신뢰 프록시 뒤에서 IP 축이 제대로 작동하면 계정 축의 하드 차단 자체가 불필요하다.
  3. 하드 차단을 유지하려면 **복구 경로**를 먼저 만든다(`BE/APPLY.md` 에 "잠금 해제 SQL"
     또는 운영자 IP 허용목록). 지금은 적으면 끝나는 절차조차 없다.

---

## E-02 [높음] `prune()` 이 모든 키를 15분에 지워, 문서화된 "1시간 30회" 상한이 실제로는 "15분 30회"다 — 그리고 429 안내 시간이 4배 과장된다

- **주장**: 같은 파일 `:26` "이메일 단독: **1시간** 30회".
  `:33-34` `ACCOUNT_WINDOW_MS = 60 * 60 * 1000` / `ACCOUNT_MAX_ATTEMPTS = 30`.
- **실제**: `FE/lib/admin/login-throttle.ts:41-43`

  ```ts
  function prune(now: number) {
    for (const [k, v] of attempts) {
      if (now - v.first > WINDOW_MS) attempts.delete(k);   // WINDOW_MS = 15분
    }
  ```

  `prune` 은 `acct:` 키와 `ip|email` 키를 구분하지 않고 **전부 15분 기준으로 삭제**한다.
  `checkLogin`(`:99`)이 `overLimit` 보다 먼저 `prune` 을 부르므로, 계정 축 엔트리는
  1시간을 못 버티고 15분에 사라진다. 실측:

  ```
  15분 경과 후 계정 축 잠김? { allowed: true, retryAfter: 0 }
  ```

  따라서 실효 상한은 **30회 / 15분 = 120회 / 시간** — 문서화된 값의 4배다.
- **왜 문제인가**: 두 방향 모두 틀린다.
  - 공격자 쪽: "IP 를 아무리 회전해도 계정당 총량이 묶인다"는 보증이 4배 느슨하다.
  - 운영자 쪽: `app/api/admin/login/route.ts:61` 이 `Math.ceil(3560/60)` = **"60분 후
    다시 시도해 주세요"** 를 띄우는데, 실제로 풀리는 시점은 15분이다. 운영자는
    45분을 헛되이 기다리거나, 안내를 믿지 않고 계속 눌러 자기 자신을 다시 잠근다.
- **조치**: `prune` 이 키 종류별 윈도를 쓰게 한다 —
  엔트리에 `window` 를 같이 저장(`{count, first, window}`)하고
  `if (now - v.first > v.window) delete` 로 바꾼다. `retryAfter` 계산도 같은 값을 쓴다.

---

## E-03 [높음] `/api/feed/live` 가 service_role 을 요구하고 실패를 **아무 로그 없이** 삼킨다 — 실시간 현황은 데이터가 쌓여도 영원히 뜨지 않는다

- **주장**: `app/api/leads/route.ts:83-93` — "공개 엔드포인트가 RLS 를 통째로 우회하는
  service_role 키를 쥘 이유가 없다. 예전에는 ... 키가 없으면 **접수 자체가 500 으로
  전면 중단**됐다." 접수 라우트는 그 교훈대로 `publicClient()` 로 옮겼다.
- **실제**: `FE/app/api/feed/live/route.ts:13` 은 여전히 `createAdminClient()` 다.
  `lib/supabase/admin.ts:10` 은 키가 없으면 `throw`.
  `FE/.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 는 **값이 0자**(측정값, `GOAL_PLAN.md:627` 도 동일 기록).
  그 예외는 `route.ts:25-27` 에서 잡히는데 —

  ```ts
  } catch {
    // 키 미설정(빌드 시점 포함)·일시 장애 — 섹션 미출력과 동일하게 처리
    return NextResponse.json({ items: [] });
  }
  ```

  **`console.error` 가 없다.** 바로 위 `if (error)` 분기(`:19`)는 로그를 남기는데
  이쪽만 비어 있다. 실측: `curl /api/feed/live` → `{"items":[]}`.
  그런데 같은 순간 `verify-goals.mjs` 의 LIVE 구간은 **공개 anon 키로** `live_feed` 를
  읽어 3행을 받아낸다. 즉 **anon 으로 충분히 읽히는 뷰**를 service_role 로 읽고 있다.
- **왜 문제인가**: 키를 넣지 않는 한, `BE/APPLY.md` 를 전부 수행하고 실접수가 5건을
  넘겨도 "실시간 신청 현황"은 **영구히 빈 배열**이다. 그리고 원인을 알려주는 로그가
  한 줄도 없어서, 운영자에게는 "데이터가 아직 안 쌓였다"와 구별이 되지 않는다.
  `GOAL_PLAN.md:146-148` 의 블로커 1은 service_role 미기입의 영향을
  "어드민 목록·상세·내보내기"로만 적어 **공개 페이지가 함께 죽는다는 사실을 놓쳤다.**
  E-04 와 겹치면 방문자에게 거짓말이 된다.
- **조치**:
  - `app/api/feed/live/route.ts:13` → `publicClient()` 로 교체. `null` 이면 로그 후 빈 배열.
    (5건 게이트는 라우트(`:24`)와 마이그레이션 003(`:66-68`) 양쪽에 이미 있다.)
  - `:25-27` catch 에 `console.error("[/api/feed/live] 예외:", ...)` 추가.
  - `GOAL_PLAN.md:146-148` 블로커 1에 "공개 페이지의 실시간 현황도 함께 막힌다" 추가.

---

## E-04 [높음] `DataPolicy` 는 SSR·크롤러·JS-off 에서 **항상** 렌더된다 — 접수가 5건을 넘겨도 "아직 공개할 만큼 쌓이지 않았습니다"가 HTML 에 남는다

- **주장**: `GOAL_PLAN.md:465-471` — "데이터 부족으로 영구 공백이었다. **비어 있다는
  사실 자체를 말하는** `DataPolicy` 섹션으로 교체했다."
- **실제**: `FE/components/sections/LiveFeed.tsx:28-38`

  ```ts
  const [items, setItems] = useState<FeedItem[]>([]);
  useEffect(() => { fetch("/api/feed/live") ... }, []);
  // 로딩 중과 '5건 미만'을 구분하지 않는다 — 어느 쪽이든 보여줄 실데이터가 없다
  if (items.length === 0) return <DataPolicy />;
  ```

  `items` 의 초기값이 `[]` 이므로 **서버 렌더 결과물에는 언제나 `DataPolicy` 가 들어간다.**
  실측: `curl http://localhost:3100/` → `아직 공개할 만큼` 1회, `실제 접수된 건만` 1회,
  `실제 접수된 상담`(LiveFeed 쪽 문구) 0회.
- **왜 문제인가**: 주석이 "구분하지 않는다"고 적은 것이 곧 결함이다. `DataPolicy.tsx:30` 은
  "아직 공개할 만큼 쌓이지 않았습니다"라는 **단정문**인데, 이 문장이 세 가지 서로 다른
  상태에 똑같이 붙는다.
  1. 진짜로 5건 미만 — 맞는 말
  2. **로딩 중** — 모든 방문자가 매 방문 첫 페인트에서 이 문장을 본다. 이어서 표로
     바뀌며 높이가 튄다(LiveFeed 는 `h-72` 롤링 패널, DataPolicy 는 `dl` 2열 패널).
  3. **API 실패** — E-03 때문에 지금이 이 상태다. 데이터가 5건을 넘겨도 거짓이 된다.

  재현: `SUPABASE_SERVICE_ROLE_KEY` 를 비운 채(현 상태) `leads` 에 실접수 10건을 넣으면,
  페이지 소스와 검색엔진이 보는 것은 "아직 공개할 만큼 쌓이지 않았습니다"다.
  JS 가 막힌 환경에서는 영구히 그 문장만 남는다.
- **조치**: 피드를 **서버에서** 가져온다. `app/(site)/page.tsx` 에서
  `live_feed` 를 직접 읽어(`revalidate = 60`) `items` 를 prop 으로 내려주고,
  `LiveFeed` 는 그 값으로 `LiveFeed`/`DataPolicy` 중 하나만 렌더한다.
  클라이언트 fetch 를 유지해야 한다면 `items: null`(미정) / `[]`(확정 공백) 을 구분해
  `null` 동안은 두 섹션 중 어느 문장도 쓰지 않는 자리표시자를 둔다.

---

## E-05 [높음] 메모만 고치면 변경 이력이 **조용히** 사라진다 — 세션 우선 쓰기 폴백이 만든 부분 실패

- **주장**: `app/api/admin/leads/[id]/route.ts:84-96` — "다만 마이그레이션 005 가 적용되기
  전에는 RLS 가 트리거의 INSERT 를 막아 **UPDATE 자체가 실패한다.** 그래서 실패하면
  service_role 로 물러난다."
- **실제**: 그 전제가 **memo 전용 수정에서는 성립하지 않는다.**
  `BE/supabase/migrations/001_init_schema.sql:121-134` 의 `log_lead_change()` 는

  ```sql
  if new.status is distinct from old.status then ... end if;
  if new.gift_status is distinct from old.gift_status then ... end if;
  ```

  status·gift_status 가 안 바뀌면 **`lead_logs` 에 INSERT 를 하지 않는다.**
  따라서 memo 만 담긴 PATCH 는 005 미적용 상태에서도 세션 UPDATE 가 **성공**하고,
  `writer` 는 세션 클라이언트로 남는다(`route.ts:97-116`). 그 다음 —

  ```ts
  // route.ts:124-131
  if (patch.memo !== undefined && patch.memo !== (before.memo ?? "")) {
    await writer.from("lead_logs").insert({ ... });   // ← 반환 error 를 보지 않는다
  }
  ```

  `001_init_schema.sql:252` 에 `lead_logs` 정책은 `logs_admin_select` **하나뿐**이다
  (INSERT 정책은 005 가 추가한다). 세션 클라이언트의 이 INSERT 는 RLS 에 막히고,
  **반환값을 아무도 보지 않으므로** 라우트는 그대로 `{ok:true}` 를 돌려준다.
- **왜 문제인가**: 재현 입력 — 005 미적용 상태(= 현재)에서 어드민 상세 화면을 열고
  **진행상태·사은품은 그대로 둔 채 메모만 고쳐 저장**한다.
  화면에는 "저장했습니다", 메모는 실제로 저장됨, **`lead_logs` 에는 아무것도 안 남음.**
  `access_logs` 의 `UPDATE` 행에는 `memo_changed: true` 만 있어 전후 길이조차 모른다.
  폴백 설계가 "실패하면 물러난다"로만 되어 있어, **실패하지 않은 채 일부만 빠지는 경로**를
  덮지 못한다. 이것이 정확히 "세션 우선 쓰기가 만드는 부분 실패"다.
- **조치**:
  1. `route.ts:125` 를 `const { error: logError } = await writer...insert(...)` 로 받고,
     실패하면 `createAdminClient()` 로 한 번 더 시도한 뒤에도 실패하면
     `logAccess` 실패와 같은 등급으로 응답한다(`{ok:false, error:"변경은 저장됐지만 이력 기록에 실패했습니다"}`).
  2. 또는 memo 도 트리거가 담당하게 한다 — 005 에
     `if new.memo is distinct from old.memo then insert ... end if` 를 추가하면
     라우트의 수동 INSERT 자체가 사라져 경로가 하나로 합쳐진다. (본문은 넣지 말고 길이만)

---

## E-06 [높음] 마이그레이션 재배열이 문서 두 곳에 **옛 번호**를 남겼다 — 운영자가 005 를 적용하고 "노출이 멈췄다"고 믿게 된다

- **주장**: `BE/APPLY.md:98-99` —
  "`live_feed` 뷰가 공개 조회 가능하므로 **005 적용 전까지는 외부에 보인다.**"
  `docs/GOAL_PLAN.md:177-178` —
  "마이그레이션 **005** 가 뷰 자체에 게이트를 심으므로 **005 를 적용하면 노출이 멈춘다.**"
- **실제**: 재배열 후 5건 게이트는 `BE/supabase/migrations/003_lock_down_functions.sql:44-70` 에 있다.
  `005_lead_logs_insert_policy.sql` 전체(30줄)에 `live_feed` 는 한 글자도 없다.
  재배열을 기록한 `GOAL_PLAN.md:446-462` 의 표는 맞게 고쳤지만, **산문 두 군데를 안 고쳤다.**
- **왜 문제인가**: 이 두 문장은 **QA 행 3건의 외부 노출**을 다루는 대목이다.
  운영자가 "일단 005 만"이라고 판단해 그것만 적용하면 노출은 그대로다.
  더구나 `GOAL_PLAN.md:151` 의 블로커 3번은 "마이그레이션 **003·004** 미적용"이라고 적어
  **005·006 두 개를 통째로 빠뜨린다.** 006 이 빠진 상태의 실제 결과는
  `app/api/leads/route.ts:111-119` 에 그대로 적혀 있다 — `lead_rate_count` 호출 실패 시
  **접수를 막지 않고 통과**시킨다. 즉 "블로커 2건"이라고 읽는 순간
  **접수 레이트리밋이 완전히 꺼져 있다는 사실이 목록에서 사라진다.**
- **조치**:
  - `BE/APPLY.md:98-99` 와 `docs/GOAL_PLAN.md:177-178` 의 `005` → `003`.
  - `docs/GOAL_PLAN.md:151` 블로커 3번을 "마이그레이션 **003·004·005·006** 미적용 —
    006 이 없는 동안 접수 레이트리밋은 동작하지 않는다"로 교체.
  - 번호를 산문에 쓰지 않는 쪽이 안전하다. 파일명(`003_lock_down_functions`)으로 적는다.

---

## E-07 [높음] "열린 결정 `[ ]`" 로 남은 D+14 파기가, 이미 `supabase db push` 한 번에 전 행 백필되는 마이그레이션이 되어 있다

- **주장**: `docs/GOAL_PLAN.md:133-136` — **"열린 결정 (사용자 확인 대기)"** 항목에
  `- [ ] 개인정보 보유기간 고지(D+1095/D+14) vs DB 파기 주기(일괄 2년) 불일치 → 마이그레이션 필요`.
  `BE/supabase/migrations/004_purge_at_by_status.sql:15` 자신도
  "14일이 운영에 맞지 않으면 **DB 를 늘리는 게 아니라 고지 문구를 먼저 고쳐야** 한다"고
  적어, 결정이 끝나지 않았음을 인정한다.
- **실제**: 그런데 `BE/APPLY.md:32-47` 의 1단계는 004 를 **아무 조건 없이** 포함한
  `supabase db push` 를 지시한다. 그리고 `004:60-73` 은 트리거만 거는 게 아니라
  **기존 전 행을 백필한다**:

  ```sql
  update leads set purge_at = (created_at + case when lead_is_activated(status)
    then interval '1095 days' else interval '14 days' end)::date
  where purge_at is distinct from ( ... );
  ```
- **왜 문제인가**: 운영자가 `BE/APPLY.md` 를 순서대로 따르면, **승인한 적 없는 보유기간
  정책이 즉시 전 데이터에 적용된다.** 재현 입력: 오늘 들어온 접수 1건(status `NEW`).
  004 적용 직후 `purge_at = 오늘 + 14일`. `BE/README.md:54` 절차대로 `pg_cron` 을 켜면
  `purge_expired_leads()` 가 **그 날짜에 행을 삭제한다.** 복구 수단은 없다
  (암호문도 함께 지워진다). 004 의 경고문은 파일 안에만 있고, 운영자가 읽는
  `APPLY.md` 의 표(`:35`)에는 "보유기간을 고지에 맞춤" 한 줄뿐이다.
  **열린 결정을 닫지 않은 채 실행 절차에 섞어 넣은 것**이 결함이다.
- **조치**:
  1. `BE/APPLY.md` 1단계에서 004 를 빼고, **"2단계: 운영자 승인 필요 — 보유기간 D+14"**
     로 분리한다. 승인 전에는 `supabase migration repair` 또는 파일을
     `_pending/` 하위로 옮겨 `db push` 대상에서 제외한다.
  2. `004` 의 백필 `update` 를 별도 파일(`004b_backfill_purge_at.sql`)로 떼어,
     트리거만 먼저 걸고 기존 행은 운영자가 날짜를 보고 실행하게 한다.
  3. `GOAL_PLAN.md:136` 에 "코드는 이미 004 로 준비됨 — **적용하면 되돌릴 수 없음**" 을 명기.

---

## E-08 [중간] `exportError` 가 URL 에서 그대로 어드민 화면의 공식 오류 배너로 찍힌다 (XSS 는 **아니다** — 내용 주입이다)

- **주장**: `app/api/admin/export/route.ts:59-66` — "목록으로 되돌리고 오류를 쿼리로
  넘겨 화면에서 보여준다."
- **실제**: 두 갈래를 나눠 확인했다.
  - **zod 경유 주입은 불가**(가설 반증). `exportFilterSchema` 의 메시지가 URL 에 실리지만
    (`route.ts:94-98`), zod v4 는 **받은 값을 메시지에 넣지 않는다.** 실측:
    ```
    {"carrier":"EVIL<b>"}  => "Invalid option: expected one of \"KT\"|\"SK\"|\"LG\"|\"SKYLIFE\""
    {"utm":"x".repeat(200)} => "Too big: expected string to have <=100 characters"
    ```
  - **XSS 도 불가**. `app/(admin)/admin/leads/page.tsx:97-104` 는 `{exportError}` 를
    JSX 텍스트로 넣으므로 React 가 이스케이프한다.
  - **남는 것은 직접 URL 을 통한 내용 주입이다.** `page.tsx:92-93` 은
    `raw.exportError` 를 **길이 제한도 허용목록도 없이** 받아
    `role="alert"` + 빨간 테두리 배너로 렌더한다.
- **왜 문제인가**: 재현 입력 — 로그인된 어드민이 아래 링크를 열면 끝이다.
  ```
  /admin/leads?exportError=세션이 만료되었습니다. https://evil.example/admin 에서 다시 로그인하세요
  ```
  사이트 자신의 어드민 셸 안에서, 자신의 오류 배너 스타일로, 임의 문장이 렌더된다.
  단일 계정 + 2FA 를 지키는 구조에서 **운영자를 속여 자격증명을 넘기게 하는 것**이
  가장 값싼 공격 경로인데, 그 경로를 새로 열어 줬다.
- **조치**: 문장을 URL 로 넘기지 않고 **코드만** 넘긴다.
  `export/route.ts:67-72` → `url.searchParams.set("exportError", "empty")` 처럼
  `empty | filter | query | audit | decrypt | update` 중 하나만 싣고,
  `page.tsx` 에 `Record<code, string>` 매핑을 두어 알 수 없는 값은 무시한다.

---

## E-09 [중간] export 실패 리다이렉트가 어드민의 필터를 **전부 버린다** — 가장 흔한 실패에서 매번

- **주장**: `app/api/admin/export/route.ts:59-65` — '"대상 0건" 같은 흔한 경우에도
  그렇게 된다. **목록으로 되돌리고** 오류를 쿼리로 넘겨 화면에서 보여준다.'
- **실제**: `route.ts:67-72`

  ```ts
  const url = new URL("/admin/leads", req.url);
  url.searchParams.set("exportError", message);
  return NextResponse.redirect(url, 303);
  ```

  `period` · `from` · `to` · `carrier` · `status` · `gift` · `exported` · `utm` · `q` 가
  **하나도 실리지 않는다.** 되돌아가는 곳은 사용자가 있던 목록이 아니라
  `parseLeadFilter({})` 의 기본값 목록(최근 30일 · 전체)이다.
- **왜 문제인가**: 재현 입력 — `/admin/leads?period=today&carrier=KT&exported=no` 에서
  "엑셀 내보내기" → 해당 조건에 0건(`route.ts:118-120`, 작성자 본인이 "가장 흔한 실패"로
  지목한 경우) → `/admin/leads?exportError=선택한%20기간...` 으로 착지.
  화면은 최근 30일 전체 목록, 필터 UI 도 전부 초기화. 매번 7개를 다시 입력해야 한다.
  오류 배너가 "선택한 기간·조건에 내보낼 접수 내역이 없습니다"라고 말하는데
  **그 '선택한 조건'은 이미 화면에서 사라진 뒤**라, 메시지와 화면이 어긋난다.
- **조치**: `backToList(req, message, filter)` 로 시그니처를 바꾸고
  `filterToQuery(filter)`(`lib/admin/filters.ts:101-121`)의 결과를 그대로 붙인다.
  `parseExportFilter` 가 실패한 경우에는 원본 쿼리스트링을 재사용한다.

---

## E-10 [중간] 대시보드가 5,000행에서 잘리는데, **같은 화면이 정확한 총계를 나란히 적는다**

- **주장**: `app/(admin)/admin/page.tsx:18-20` — "오늘/이번주/이번달 접수 건수 +
  상태 분포 + 유입경로별 건수."
- **실제**: `page.tsx:66-71` 이 이번달 행을 `.limit(5000)` 으로 가져오고,
  `:92-99` 가 **그 배열만으로** 상태·사은품·통신사·유입경로 분포를 센다.
  반면 `:148` 의 `총 {monthCount}건` 은 `countFor`(`:41-51`)가 가져온 **exact count** 다.
  잘렸다는 표시는 화면에도 로그에도 없다.
- **왜 문제인가**: 재현 입력 — 한 달 접수 5,001건.
  "유입경로별 접수 (이번달)" 헤더는 **총 5,001건**이라고 쓰는데, 그 아래 막대들의
  합은 5,000이다. 상태별·사은품·통신사 3개 패널도 전부 1건씩 모자라다.
  `GOAL_PLAN.md:18-19` 가 "유입경로가 광고비 판단 근거이므로 가장 크게 배치한다"고
  적은 바로 그 수치가, 임계치를 넘는 순간 조용히 틀리기 시작한다.
- **조치**: 분포를 클라이언트에서 세지 말고 DB 에서 센다.
  `group by` 집계용 `security definer` RPC 를 006 과 같은 방식으로 추가하거나,
  당장은 상태·사은품·통신사 각각에 `{ count: "exact", head: true }` 쿼리를 돌린다.
  유지한다면 `monthRows.length === 5000` 일 때 화면에 "5,000건까지만 집계" 를 띄운다.

---

## E-11 [중간] "이번주" 카드의 숫자와, 그 카드를 눌러 도착하는 목록이 서로 다른 집합이다

- **주장**: `app/(admin)/admin/page.tsx:132-141` — `SummaryCard` 는 라벨·숫자·링크를
  한 덩어리로 보여준다. 즉 "이 숫자를 누르면 이 건들을 본다"는 계약이다.
- **실제**: 숫자는 `countFor(weekStart, today)`(`:62`)로, `weekStart` 는
  `weekStartKst()`(`lib/kst.ts:85-91`) = **이번 주 월요일**.
  링크는 `/admin/leads?period=7d`(`:135`), 이는
  `resolvePeriod`(`lib/admin/filters.ts:87`)에서 `addDaysKst(today, -6) ~ today`
  = **최근 7일(롤링)** 이다. 두 구간은 화요일~일요일 내내 다르다.
- **왜 문제인가**: 재현 입력 — 화요일에 `/admin` 접속.
  카드 라벨 "이번주 (2026-10-05 ~)" / 값 2건 → 클릭 → 목록 상단 "총 11건 · 2026-09-30 ~ 2026-10-06".
  카드가 2를 보여줬는데 목록은 11을 보여준다. 운영자가 어느 쪽을 보고 배분해야 하는지
  알 수 없고, 주간 실적을 세는 근거가 두 개로 갈린다.
- **조치**: 링크를 `/admin/leads?period=custom&from=${weekStart}&to=${today}` 로 바꾼다.
  (`filters.ts:91-96` 의 custom 경로가 그대로 받는다.)
  또는 `PERIODS` 에 `week` 를 추가하고 `resolvePeriod` 에서 `weekStartKst()` 를 쓰게 한다.

---

## E-12 [중간] `verify-goals.mjs` 의 G5 체크는 **반증 불가능**하고, 출력 숫자도 틀렸다 — 문서는 그 숫자를 조용히 고쳐 적었다

- **주장**: `FE/scripts/verify-goals.mjs:1-8` — "**주장이 아니라 확인된 사실**만 출력한다."
  출력 라벨: `슬롯 정의 = 삽입 지점`. `GOAL_PLAN.md:599` — "G5 슬롯 구조 5/5 — **슬롯 5곳**".
- **실제**: `verify-goals.mjs:137-140`

  ```js
  const slots = (cfg.match(/^\s+\| "after|^\s+\| "before/gm) ?? []).length;   // = 5
  const used  = (page.match(/<PromoSlot slot=/g) ?? []).length;               // = 5
  check("G5", "슬롯 정의 = 삽입 지점", slots + 1 === used || used >= 5, `정의 ${slots + 1} · 삽입 ${used}`);
  ```

  `lib/site-config.ts:269-274` 의 `PromoSlotName` 은 5개다(`afterHero` · `afterPromoBand` ·
  `afterCarrierHub` · `afterJourney` · `beforeFooter`). `app/(site)/page.tsx` 의
  `<PromoSlot slot=` 도 5개(47·51·65·70·84행). 즉 **5 = 5 로 맞는데**,
  스크립트는 `slots + 1` 때문에 **"정의 6 · 삽입 5"** 라는 틀린 숫자를 출력하고,
  `|| used >= 5` 때문에 **정의와 삽입이 실제로 어긋나도 통과**한다.
  그리고 `GOAL_PLAN.md:599` 은 이 출력을 "슬롯 5곳"으로 **문서에서만 교정**했다 —
  스크립트는 그대로 두고.
- **왜 문제인가**: 이 스크립트의 존재 이유가 `GOAL_PLAN.md:578-586` 에 적혀 있다 —
  "그동안 '완료'를 반복해서 과대 표기했다 ... 스크립트가 두 구간을 분리해서 센다."
  그런데 코드 구간의 체크 하나가 **항상 참**이고 출력 숫자가 틀렸으며,
  그 틀린 숫자를 문서가 손으로 덮었다. 과대 표기를 막으려는 장치 안에서
  과대 표기가 한 번 더 일어난 셈이라, 다음 라운드가 "31/31 통과"를 믿을 근거가 깎인다.
  (`:111` 의 `보안 차단이 첫 마이그레이션` 도 같은 종류다 — 단언은 `migs[2]` 즉 **세 번째**를
   보는데 라벨은 "첫"이라고 적는다. 단언 자체는 맞다.)
- **조치**: `:140` 을 `check("G5", "슬롯 정의 = 삽입 지점", slots === used, \`정의 ${slots} · 삽입 ${used}\`)`
  로 바꾼다. `:111` 라벨을 "보안 차단이 004 보다 먼저"로 고친다.

---

## E-13 [중간] G1 "표시 금액이 **전부** 다모아 게시값에 존재" 는 다섯 자리 금액만 본다

- **주장**: `verify-goals.mjs:62-63` 라벨 — "표시 금액이 **전부** 다모아 게시값에 존재",
  출력 "표시 66개 · 불일치 0개". `GOAL_PLAN.md:595` 이 그대로 인용.
- **실제**: `verify-goals.mjs:58`

  ```js
  const ours = [...new Set(strip(text).match(/\d{2},\d{3}(?=원)/g) ?? [])];
  ```

  `NN,NNN원` 만 잡는다. **`9,900원` · `6,050원` 같은 네 자리와 `100,000원` 같은
  여섯 자리는 아예 보지 않는다.** 그리고 새 시드
  `BE/supabase/seed/plans_damoa_2026-10-08.sql:120-121,146-148,170-171,196-197` 의
  `description` 에는 그 금액이 들어 있다("TV 추가 1대당 월 **9,900원**" / "**6,050원**").
  `DAMOA` 집합(`verify-goals.mjs:38-45`)에 `9,900` 도 `6,050` 도 없다.
  현재 `lib/plans.ts:49` 의 `SUPPRESS_PLAN_DESCRIPTION = true` 때문에 그 문자열이
  화면에 안 나와서 통과하고 있을 뿐이다.
- **왜 문제인가**: `BE/APPLY.md:93` 은 재시드 후 **그 스위치를 `false` 로 되돌리라고
  지시한다.** 되돌리는 순간 `9,900원`·`6,050원`·`10,670원` 이 4개 서브페이지에 나오는데,
  검증 스크립트는 여전히 "불일치 0개 · 전부 존재"를 출력한다.
  G1 은 이 프로젝트에서 **표시광고 리스크를 막는 유일한 자동 장치**인데,
  정규식 한 줄이 그 범위를 조용히 좁혀 놓았다.
- **조치**:
  - `:58` → `/(?<![\d,])\d{1,3}(?:,\d{3})+(?=원)/g`
  - `DAMOA` 집합에 `9,900` · `6,050` · `10,670` 을 **출처와 함께** 추가하거나,
    실패하면 실패한 채로 두고 시드의 해당 값을 재확인한다.

---

## E-14 [중간] `GOAL_PLAN.md` 에 "현재 수치" 표가 셋이고, 전부 다른 값이다

- **주장**: 같은 문서 안에서 모두 "**현재**" 라고 적힌 수치.
- **실제**:

  | 위치 | 메인 높이 | 섹션 수 | 전환 수단 |
  |---|---|---|---|
  | `:113-122` "## 현재 수치 (2026-10-08)" | **7,328px** | 11 | — |
  | `:473` (G2 추가 작업 말미) | **8,367px** | — | — |
  | `:559-565` "## 현재 수치" | **10,234px** | **14** | **11** |
  | `verify-goals.mjs` 실행 결과(`:593-600`) | — | **15** | **13** |

  어느 것이 현재인지 문서가 스스로 판정하지 못한다. 세 표 중 어느 것에도
  "구 기록" 표시가 없다.
- **왜 문제인가**: 이 문서는 명시적으로 **다음 라운드의 판단 근거**다
  (`CRITIQUE_02` D-10 이 "문서가 자기 자신과 모순된다"를 이미 한 번 지적했고,
  그 뒤 표가 두 개 더 늘었다). 비평자가 `:117` 을 읽으면 "레퍼런스 8,819px 에
  7,328px — 83%" 로, `:563` 을 읽으면 "10,234px — 레퍼런스를 16% 초과" 로 판단한다.
  정반대 결론이 같은 파일에서 나온다.
- **조치**: "현재 수치" 표를 **문서 맨 앞 하나만** 남기고, 나머지는
  `## 수치 기록 (2026-10-08 G2 라운드 종료 시점)` 처럼 **시점 라벨**을 붙여 과거형으로 내린다.
  섹션 수는 세는 기준(`main` 직계 vs 전체 `<section>`)을 표에 명시한다.

---

## E-15 [중간] `DataPolicy` 가 절대 규칙 1의 **문장**과 어긋난다 — 규칙을 고치든 섹션을 고치든 하나는 해야 한다

- **주장**: `CLAUDE.md:74` — "건수가 5건 미만이면 **섹션 자체를 렌더링하지 않는다.**"
- **실제**: `components/sections/LiveFeed.tsx:38` 은 5건 미만일 때 섹션을 **렌더링한다** —
  `DataPolicy.tsx:21-26` 은 `<section>` 이고, `SectionHeading` 의 제목이
  **"실시간 신청 현황"** 으로 LiveFeed 와 동일하다. 설명문만
  "실제 접수된 건만 마스킹해 공개합니다" 로 다르다.
  실측(`curl /`): `실시간 신청 현황` 1회 + `아직 공개할 만큼` 1회.
- **왜 문제인가**: 규칙 1 의 **취지**(없는 실적을 있는 것처럼 보이게 하지 말 것)는
  지켜진다 — 가짜 데이터가 없고, 비어 있다고 명시한다. 그 판단에는 동의한다.
  문제는 **규칙 문장이 안 바뀌었다**는 것이다. 지금 상태로는
  (a) 다음 비평 라운드가 "규칙 1 위반"으로 다시 올리거나,
  (b) 나중에 누군가 규칙 문장을 근거로 `DataPolicy` 를 지워 `GOAL_PLAN.md:465-471` 가
  해소했다고 적은 "700px 영구 공백"이 되살아난다.
  규칙과 코드가 어긋난 채 둘 다 "맞다"고 주장하는 상태가 결함이다.
- **조치**: `CLAUDE.md:72-74` 규칙 1 을 개정한다 —
  "건수가 5건 미만이면 **접수 내역을 한 건도 렌더링하지 않는다.** 그 자리에는
  데이터가 없다는 사실을 밝히는 안내(`DataPolicy`)만 둘 수 있고, 건수·금액·가상 내역을
  암시하는 어떤 표현도 쓰지 않는다." 그리고 `DataPolicy` 의 제목이 LiveFeed 와
  동일한 점도 함께 결정한다(동일 유지 / "실시간 신청 현황 안내" 로 분리).

---

## E-16 [중간] 추천 카드와 요금표의 "겹치지 않는다" 보장이 **한쪽에만** 있다

- **주장**: `docs/GOAL_PLAN.md:476-495` — 갭 항목 G-08 을 구현하지 않는 근거로
  "`PlanTable` 은 `tableRows()` 로 그 행을 **의도적으로 제외**한다 ...
  추천 섹션과 요금표가 둘 다 존재하면서 **겹치지 않는다**."
- **실제**: 제외는 표 쪽에만 있다.
  - `lib/plans.ts:58-60` `tableRows()` → `sort_order >= TABLE_SORT_MIN(10)` 만 통과.
  - `components/sections/PlanCards.tsx:20` → `const top = plans.slice(0, 3);`
    **`sort_order` 조건이 없다.** `getPlansByCarrier`(`plans.ts:74-75`)가
    `sort_order asc, monthly_fee asc` 로 돌려주므로 "앞 3개"일 뿐이다.
- **왜 문제인가**: 현재 시드(`plans_damoa_2026-10-08.sql`)는 4사 모두 추천행이
  **정확히 3개**(`sort_order` 1·2·3)라서 우연히 맞는다. 운영자가 한 통신사의 추천을
  2개로 줄이거나 `is_active = false` 로 하나를 내리는 순간,
  `slice(0,3)` 이 **결합표 첫 행(`sort_order` 10)을 끌어온다.**
  그러면 같은 상품이 추천 카드와 요금표에 동시에 나오고,
  `plans.ts:30-33` 이 막으려던 "같은 금액이 두 이름으로 보이는" 상태가 그대로 재현된다.
  문서가 "구조적으로 겹치지 않는다"고 단언했기 때문에, 그때 아무도 여기를 보지 않는다.
- **조치**: `PlanCards.tsx:20` →
  `const top = plans.filter((p) => (p.sort_order ?? 0) < TABLE_SORT_MIN).slice(0, 3);`
  축을 `tableRows()` 와 **같은 상수**로 묶는다.

---

## E-17 [낮음] `/api/admin/logout` 에만 교차출처 방어가 없다 — 폼 POST 한 줄로 어드민을 강제 로그아웃시킬 수 있다

- **주장**: `app/api/admin/export/route.ts:35-45` — "이 엔드포인트는 **부수효과가 있다** ...
  `POST` 로 바꾸고 `Sec-Fetch-Site` / `Origin` 을 함께 본다."
- **실제**: `isSameOrigin`(`export/route.ts:46-57`)은 export 라우트 안에만 있다.
  `app/api/admin/logout/route.ts` 는 23줄 전체에 Origin·Sec-Fetch-Site 검증이 없고,
  `app/(admin)/admin/layout.tsx:53` 의 호출부는 `<form action="/api/admin/logout" method="post">` —
  **외부 페이지가 똑같이 흉내 낼 수 있는 단순 폼 전송**이다.
  (`PATCH /api/admin/leads/[id]` 는 `Content-Type: application/json` 이라 프리플라이트가
   걸려 안전하고, `decrypt` 는 D-36 에서 이미 지적됐다.)
- **왜 문제인가**: 재현 입력 — 공격 페이지에 아래를 두고 어드민에게 열게 한다.
  ```html
  <form action="https://HOST/api/admin/logout" method="post" id="f"></form>
  <script>f.submit()</script>
  ```
  세션이 끊기고 `/admin/login` 으로 303. 피해는 가용성뿐이지만,
  E-01 의 잠금과 묶으면 "로그아웃시킨 뒤 계정 축을 채워 재로그인을 막는" 조합이 된다.
- **조치**: `isSameOrigin` 을 `lib/admin/auth.ts` 로 옮겨 공용화하고
  `logout` · `decrypt` · `leads/[id]` 세 라우트에 모두 적용한다.

---

## E-18 [낮음] 대시보드가 count 만 필요한데 행을 세 번 받아온다

- **실제**: `app/(admin)/admin/page.tsx:41-51` 의 `countFor` 가
  `buildLeadQuery(supabase, "id", ...)`(`lib/admin/leads.ts:88-92`)를 그대로 `await` 한다.
  `:90` 의 `.select(columns, { count: "exact" })` 에 **`head: true` 가 없고**,
  호출부에도 `.limit`/`.range` 가 없다.
- **왜 문제인가**: `/admin` 1회 로드마다 `id` 목록 조회가 3번
  (PostgREST 기본 상한까지) 일어난다. 월 수천 건이면 매번 수천 개의 id 를 버리려고 받는다.
- **조치**: `buildLeadQuery` 의 `options` 에 `head?: boolean` 을 추가해
  `.select(columns, { count: "exact", head: true })` 로 보낸다.

---

## E-19 [낮음] 재배열·복원 뒤 남은 주석 세 줄이 현재 코드와 반대를 말한다

- `lib/site-config.ts:130` — "`tone` 은 프레임 배경. `"brand"` = **남색** 면".
  남색(`#2b50c8`)은 `CLAUDE.md:17` 기준 **두 번 폐기된** 색이고,
  `PromoBand.tsx:56-59` 는 이제 색면이 아니라 옅은 틴트 유무만 가른다.
- `components/sections/LiveFeed.tsx:19-20` — "완료 계열은 **남색**".
  실제 클래스는 `bg-brand-dark`(`#0a8230`, 초록).
- `components/sections/Header.tsx:131` — "**헤더 CTA 를 걷어내** 자리가 생겼으므로
  대표번호는 lg 부터 그대로 보인다". 2라운드 이후 `:150` 에 CTA 가 **복원**됐다.
- **왜 문제인가**: 색 결정은 이 프로젝트에서 두 번 뒤집혔고(`CLAUDE.md:17`),
  그때마다 비평이 색 관련 지적을 냈다. 주석이 폐기된 결정을 계속 들고 있으면
  다음 작업자가 "남색 면"을 되살릴 근거로 읽는다.
- **조치**: 세 줄 교체. (`CLAUDE.md` 자체는 `#07b040` 으로 최신이며, 코드와 일치함을 확인했다.)

---

## E-20 [낮음] `CLAUDE.md` 의 "진초록 풀블리드는 푸터 CTA 밴드 한 곳만" 이 코드와 정반대다

- **주장**: `CLAUDE.md:35-37` — "진초록 풀블리드는 **푸터 CTA 밴드 한 곳**만 남긴다 —
  스크롤 끝의 마침표." 그런데 같은 문서 `:31` 은 "**유일한 색면은 CTA 버튼**" 이라고 적는다.
  문서 자체가 두 문장으로 갈린다.
- **실제**: `components/sections/Footer.tsx:25-35` 는 푸터 CTA 밴드를
  **옅은 틴트**(`#f3fcf6 → #e9f8ef`)로 바꿨고, 주석이 그 이유를 적고 있다.
  즉 푸터에 진초록 풀블리드는 **없다**.
  반대로 진초록 풀블리드는 `components/forms/StickyConsultBar.tsx:148` 의
  접수완료 바(`bg-brand-deep`)에 **있다** — 문서가 허용한 적 없는 자리다.
- **왜 문제인가**: 규칙과 코드가 **서로 자리를 바꿔** 있어, 어느 쪽을 믿어도 틀린다.
  `G4-4`(`GOAL_PLAN.md:87`)가 "초록 색면 27.3% → 1.22%" 를 성과로 적었는데,
  그 작업이 `CLAUDE.md:35-37` 을 무효화했다는 기록이 없다.
- **조치**: `CLAUDE.md:35-37` 을 "진초록 풀블리드는 쓰지 않는다. 유일한 예외는
  접수 완료 직후의 확인 바(`StickyConsultBar` done 상태)다" 로 교체하거나,
  그 바도 흰 면으로 내리고 예외를 0으로 만든다.

---

## 확인했고 **결함이 아닌 것** (오탐 방지 기록)

이번 라운드에서 지정된 "아직 아무도 안 본 영역"을 전수로 읽었다. 아래는 깨끗하다.

- **`FE/lib/crypto.ts`** — AES-256-GCM, 12B 랜덤 IV, authTag 분리 저장, 키 길이(64 hex) 검증,
  `PHONE_PEPPER` 미설정 시 throw. 평문이 로그로 흐르는 경로 없음.
  `ENCRYPTION_KEY`·`PHONE_PEPPER` 모두 env 전용(규칙 4 준수).
- **`FE/lib/turnstile.ts`** — `!res.ok` · `success !== true` · 네트워크 예외를 전부
  `false` 로 떨어뜨린다(fail-closed). 토큰이 통과하는 건 **테스트 키** 때문이고
  (`BE/APPLY.md:121-126`) 코드 결함이 아니다(C-34/D-06 중복이라 재지적하지 않음).
- **`FE/lib/kst.ts`** — `todayKst` / `monthStartKst` / `weekStartKst` / `addDaysKst` /
  `kstRangeToUtc` / `toExcelKstDate` 를 손으로 재검산했고 전부 일치.
  `weekStartKst` 의 일요일 보정(`dow === 0 ? 6 : dow - 1`)도 맞다.
- **`FE/middleware.ts`** — Supabase 키가 없을 때 **열지 않고** 로그인으로 보낸다(`:17-21`).
  `matcher`(`:59`)가 공개 사이트를 건드리지 않는다. `getUser()` 로 토큰을 서버 검증한다.
- **`FE/components/sections/PlanCalculator.tsx` 의 조합 커버리지** —
  `buildCalcMatrix`(`lib/plans.ts:124-141`)가 만드는 속도×TV 격자를 새 시드로 전수 대조:
  KT 3×2=6행 전부 존재 / SK 3×3=9 전부 / LG 3×2=6 전부 / SKYLIFE 4×2=8 전부.
  기본 선택 조합(`speeds[0]`, `tvOptions[0]`)이 비는 통신사는 없다.
  (금액 합산 자체의 이중계산 문제는 C-16/D-13 이며 **미해결**이지만 중복이라 다시 세지 않았다.)
- **`lib/admin/filters.ts:28-31` 의 `searchTerm`** — PostgREST `or()` 를 깨는 문자
  (`,` `.` `(` `)` `*` `:`)를 애초에 제거하므로 `buildLeadQuery:103` 의 `.or()` 주입 불가.
- **`isSameOrigin`(export)** — `Sec-Fetch-Site` 우선, 없으면 `Origin`, 둘 다 없으면 거부.
  `same-site`(서브도메인)도 거부하는 엄격한 구현. `verify-goals` 의 405/403/401 도 재현됨.
- **마이그레이션 003 의 `revoke is_admin() from anon` 이 접수를 깨지 않는다** —
  `001_init_schema.sql:242-251` 의 정책이 전부 역할 한정(`to anon` / `to authenticated`)이고,
  `/api/leads:132` 의 INSERT 는 `.select()` 를 붙이지 않아 SELECT 정책이 평가되지 않는다.
- **마이그레이션 번호 재배열이 적용된 DB 와 충돌하지 않는다** — `supabase_migrations` 에
  기록될 수 있는 건 `001`·`002` 뿐이고(`BE/README.md:9-10`), `003~006` 은 한 번도
  적용된 적이 없어 번호를 바꿔도 재적용·충돌이 생기지 않는다. `db push` 의 파일명 순
  적용 순서도 `003 → 004` 로 의도대로 선다. (문서 쪽 잔재는 E-06.)
- **zod v4 는 받은 값을 오류 메시지에 넣지 않는다** — 실측으로 확인(E-08).
- `npx tsc --noEmit` 0건, `npx eslint .` 0건.

---

## 미확인으로 남긴 것 (추측하지 않았다)

1. **트리거 함수 EXECUTE 회수의 영향.**
   `003_lock_down_functions.sql:36-37` 이 `touch_updated_at()` · `log_lead_change()` 의
   EXECUTE 를 `anon` · `authenticated` 에서 회수한다. PostgreSQL 은 트리거 함수의
   EXECUTE 권한을 `CREATE TRIGGER` 시점에만 검사하는 것으로 알고 있어 anon INSERT 는
   계속 통과할 것으로 보이지만, **적용된 DB 에서 실제로 확인하지 못했다**(자격증명 없음).
   003 적용 직후 **접수 1건을 반드시 통과시켜 볼 것.** 실패한다면 접수가 전면 중단된다.
2. **어드민 화면의 런타임 동작.** service_role 키와 어드민 계정이 없어 `/admin/*` 을
   실제로 열지 못했다. **E-05 · E-08 · E-09 · E-10 · E-11 은 코드 정독 판정**이며
   런타임 재현은 하지 않았다.
3. **`export const revalidate = 60`** 이 프로덕션에서 `/api/feed/live` 를 실제로
   캐시하는지. dev 서버에서는 캐시되지 않아 확인 불가. (`npx next build` 금지 지시 준수)
4. **`X-Forwarded-For` 에 유효 CIDR(`1.2.3.0/24` 등)을 넣는 경로.**
   `leads.ip` 가 `inet` 이고 `lead_rate_count(p_ip inet)` 가 `ip = p_ip` 로 비교하므로
   마스크 길이만 바꿔도 서로 다른 키가 되어 IPv4 33개·IPv6 129개의 무료 슬롯이 생긴다.
   D-07(XFF 회전)의 변종이라 **별건으로 세지 않았다.** 잘못된 문자열(`foo`)은
   INSERT 가 `22P02` 로 실패하므로 우회는 되지 않는다(코드 판정, 런타임 미확인).
5. **전자상거래법 §10 의 호스팅사업자 표기 의무**가 이 사이트 형태에 적용되는 범위.
   `SITE.business`(`lib/site-config.ts:23-30`)에는 6종만 있고 **전화번호·전자우편주소·
   호스팅사업자 필드가 없으며**, `hasTel()` 이 false 라 전화번호는 화면에 0곳이다.
   `Footer.tsx:7` 의 "6종 표기는 법적 필수"라는 전제가 완전한지는 **법률 판단이 필요**해
   결함으로 단정하지 않았다. 운영자 확인 항목으로만 적는다.

---

## 치명·높음만 모은 실행 순서

코드만으로 가능한 것(1~5)을 먼저, DB 자격증명이 필요한 것(6~7)을 뒤에 둔다.

| # | 항목 | 파일 | 왜 이 순서인가 |
|---|---|---|---|
| 1 | **E-01** 계정 축을 하드 차단 → 지연으로. IP 출처를 `cf-connecting-ip` 로 | `FE/lib/admin/login-throttle.ts` · `FE/app/api/admin/login/route.ts:48-65` · `FE/lib/admin/audit.ts:25-28` | 요청 30번으로 **어드민이 영구히 잠긴다.** 다른 어떤 수정도 어드민에 못 들어가면 검증할 수 없다 |
| 2 | **E-02** `prune` 을 키별 윈도로. `retryAfter` 안내 시간 교정 | `FE/lib/admin/login-throttle.ts:41-43` | 1과 같은 파일이므로 한 번에. 안 고치면 1의 수정 결과도 잘못된 시간으로 안내된다 |
| 3 | **E-07** `BE/APPLY.md` 1단계에서 **004 분리**, 백필을 별도 파일로 | `BE/APPLY.md:32-47` · `BE/supabase/migrations/004_purge_at_by_status.sql:60-73` | 6번(DB 적용)보다 **반드시 먼저.** 승인 안 된 D+14 파기가 전 행에 백필되면 되돌릴 수 없다 |
| 4 | **E-06** `005` → `003` 산문 교정, 블로커 목록을 003~006 네 개로 | `BE/APPLY.md:98-99` · `docs/GOAL_PLAN.md:151,177-178` | 역시 6번 전에. 운영자가 잘못된 번호를 보고 부분 적용하는 것을 막는다 |
| 5 | **E-03 + E-04** feed 라우트를 `publicClient()` 로, catch 에 로그 추가, 피드를 서버에서 가져와 prop 으로 | `FE/app/api/feed/live/route.ts:13,25-27` · `FE/components/sections/LiveFeed.tsx:28-38` · `FE/app/(site)/page.tsx:53` | 둘이 합쳐져 **공개 페이지가 거짓을 말한다.** 한 쪽만 고치면 증상이 남는다 |
| 6 | **E-05** `lead_logs` INSERT 오류를 받아 처리 (또는 005 에 memo 트리거 추가) | `FE/app/api/admin/leads/[id]/route.ts:124-131` · `BE/supabase/migrations/005_lead_logs_insert_policy.sql` | 005 를 손볼 거면 DB 적용 **전에** 고쳐야 한 번에 끝난다 |
| 7 | **(DB)** `BE/APPLY.md` 실행 → 직후 **접수 1건 통과 확인**(미확인 1번) → `node FE/scripts/verify-goals.mjs` | — | 003 의 트리거 함수 권한 회수가 접수를 깨지 않는지 확인하기 전에는 운영 전환 불가 |

중간 이하는 위 7개가 끝난 뒤 **E-12 · E-13**(검증 스크립트 자체의 신뢰도) →
**E-09 · E-11 · E-10**(어드민 사용성·정확성) → **E-14 · E-15 · E-20**(문서 정합) 순을 권한다.
E-12·E-13 을 먼저 두는 이유는, 그게 틀린 상태에서는 나머지 수정의 "통과"를 믿을 수 없기 때문이다.
