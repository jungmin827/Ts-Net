# 비평 5라운드 — 게시판 (2026-10-08)

대상: `96305b3` · `4b0dd7e` · `27d2d36` 3개 커밋이 만든 **후기·정보공유 게시판**.
`CRITIQUE_01~04` 지적은 제외.

> 검토 도중 메인 세션이 `d28b63f`(SEO — sitemap/robots/canonical)를 올려 HEAD 가 바뀌고,
> 이어서 `008_review_public_submit.sql` · `FE/app/api/reviews/` · `FE/lib/validation.ts`
> 가 작업 중 상태로 남았다. 둘 다 **범위 밖**이라 보지 않았다.
> 단 `d28b63f` 가 `review/page.tsx` · `notice/page.tsx` 를 건드렸으므로 그 두 파일의
> 줄번호는 **현재 워킹트리 기준**이고, 내가 처음 세운 지적 하나(`?page=999` 가 200 으로
> 마지막 페이지를 돌려주는 소프트 404 / 무한 URL 공간)는 `d28b63f` 의
> `robots: { index: false }` + `canonical` 로 **색인 측면은 닫혔다** — 그래서 보고하지 않는다.
> 애플리케이션이 범위 밖 페이지를 여전히 200 으로 응답하는 것 자체는 남아 있다.

**실행한 검증** — `npx tsc --noEmit` 0건 · `npx eslint .` 0건 ·
`node scripts/verify-goals.mjs` 39개 전부 통과 ·
`safeLikeTerm` 멱등성·`paginate`·`pageParam` 순수함수 실측 ·
**라이브 PostgREST 에 직접 질의해 `42703` 을 확증** ·
대비 21쌍 계산 · G0 검사 3종에 대한 반례 파일 작성·실행.
파일은 이 문서 외에 하나도 고치지 않았고 dev 서버도 띄우지 않았다
(검토 시작 시점에 이미 :3100 에 떠 있어 `verify-goals` 의 라이브 항목이 돌았다).

**브리핑 항목별 1차 답** —

| 의심 항목 | 결론 |
|---|---|
| 1. `paginate` clamp vs 실제 `range()` | **문제 없음.** `from`/`to` 가 clamp 된 `current` 에서 파생되므로 둘이 갈라질 수 없다. 건수 쿼리 vs 행 쿼리도 같은 `applySearch` 를 거쳐 일치한다 |
| 1. 건수 쿼리가 `selectWithOptional` 로 안 감싸져 있다 | **버그 아니다.** 건수 쿼리는 `select("id")` 뿐이고 필터도 `title`/`content`/`is_published` 라서 007 열이 닿지 않는다 — 42703 이 날 자리가 없다 |
| 1. `maybeSingle()` 제거 | **동작 변화 없다.** `id` 가 PK 라 2행이 맞을 수 없다. 0행도 `rows?.[0] ?? null` → `notFound()` 로 같다 |
| 1. `getNeighbors` 동일 `created_at` | **F-04.** 형제 글이 통째로 사라진다. 게다가 정보공유는 동일 시각이 아니어도 **항상** 어긋난다 |
| 2. `42703` 이 맞는 코드인가 | **맞다 — 실측으로 확증.** 아래 "확인했고 문제 없음" 첫 항목에 응답 원문 |
| 3. `safeLikeTerm` 충분한가 | 남은 문자(`*` `>` `<` `~` `!` 공백 전각기호)로 **DSL 을 깨는 경로는 없다**. 그러나 **멱등이 아니라서 조용한 오답을 만든다 → F-01** |
| 3. 브랜드 타입 구멍 | `as SafeLikeTerm` 은 `postgrest.ts` 안 2곳뿐이고 둘 다 정리 직후다. 다만 한 홉만 막는다 → F-09 |
| 4. 제목 위계 | `/review` `/notice` `/review/[id]` `/notice/[id]` 전부 h1 1개 + h2 만. 검색바·페이저는 제목을 만들지 않는다. **위반 없음** |
| 4. `aria-current` · `‹`/`›` · `…` · 포커스 | 전부 문제 없음 (아래 목록) |
| 5. 대비 | 글자 21쌍 전부 통과, `--brand` 위 흰 글자 0건. 그러나 **운영자 답글 패널이 면·테두리 모두 1.1:1 → F-02** |
| 6. `view_count` | 네 쿼리 전부에서 받아 오고 아무 데서도 안 쓴다 → F-11 |
| 6. 주석이 코드를 반증하는 곳 | F-03 · F-05 · F-10 · F-13 |
| 7. G0 검사 3종 | **셋 다 틀린 이유로 통과할 수 있다** — F-06 · F-07 · F-08. 반례를 만들어 실행해 확인했다 |

---

## F-01 [높음] `safeLikeTerm` 이 멱등이 아니다 — 검색 2페이지가 **다른 검색어**로 조회된다

- **주장**: `FE/lib/postgrest.ts:11-12` — "**이름에 쉼표나 점이 들어간 검색이 조용히 엉뚱한
  결과를 낸다.** 조용한 오답이 가장 나쁘다."
  `FE/components/ui/Pagination.tsx:29-31` — "이게 없으면 '검색 → 2페이지' 가 **검색어를 잃고
  전체 목록 2페이지**로 간다. … 사용자는 자기가 뭘 잘못 눌렀는지 알 수 없다."
- **실제**: `q` 를 잃지는 않는다. 대신 **매 페이지마다 조금씩 다른 값으로 변한다.**
  `postgrest.ts:43` 이 `%`·`_` 앞에 `\` 를 붙이는데, `:41` 이 그 `\` 를 다음 호출에서
  공백으로 지우고 `:44` 가 공백을 압축한다. 즉 정리 함수가 **자기 출력을 다시 먹으면
  다른 값을 낸다.** 실측 —

  ```
  "100% 할인"       → "100\% 할인"      → "100 \% 할인"   ← 2회차에서 공백 삽입
  "KT_1G"          → "KT\_1G"          → "KT \_1G"
  "전화번호_뒷자리"     → "전화번호\_뒷자리"    → "전화번호 \_뒷자리"
  ```

  그리고 그 1회차 출력이 **URL 에 다시 실려 나간다** —
  `app/(site)/review/page.tsx:107` · `notice/page.tsx:104` 가
  `params={{ q: q || undefined, … }}` 로 **정리된** `q` 를 페이저 링크에 넣고,
  `Pagination.tsx:39` 이 그대로 `?q=` 에 쓴다. 다음 페이지의 `:59` `sanitizeQuery(sp.q)` 가
  그 값을 **또 정리한다.**
- **왜 문제인가**: 재현 — `/review` 에서 `100% 할인` 으로 검색한다.
  1페이지는 `%100\% 할인%` 로 조회되어 정상 결과가 나온다.
  페이저의 `2` 는 `/review?q=100%5C%25+%ED%95%A0%EC%9D%B8&page=2` 로 가고,
  거기서 패턴은 `%100 \% 할인%` — **"100" 과 "%" 사이에 없던 공백이 끼어** 0건이 된다.
  `total` 이 0 이 되므로 `paginate` 가 `pages: 1` 을 내고 **페이저 자체가 사라진다**
  (`Pagination.tsx:35` `if (pages <= 1) return null`). 1페이지로 돌아갈 링크도 같이 없어진다.
  화면은 "제목+내용 에서 100 \% 할인 검색 — 0건" 이라고 적는데, 1페이지에서는 몇 건이
  있었다. 사용자는 2페이지에 결과가 없다고 배운다.
  같은 비멱등성이 **화면에도 새어 나온다** — `BoardSearch.tsx:72` `defaultValue={q}` 는
  검색창을 `100\% 할인` 로 채우고, `:93` 은 "100\% 할인 검색" 이라고 적는다.
  방문자는 자기가 입력하지 않은 백슬래시를 본다.
  `%` 는 통신 프로모션 게시판에서 드문 문자가 아니고(`최대 30% 할인`),
  `_` 는 운영자가 쓰는 식별자에 흔하다.
- **조치**: `FE/lib/postgrest.ts` 의 반환값을 **PostgREST 에 넘길 값과 화면·URL 에 쓸 값으로
  분리**한다.
  ① `safeLikeTerm` 이 `{ display: string; pattern: SafeLikeTerm }` 를 돌려주게 한다 —
     `display` 는 이스케이프 전(버리기만 적용), `pattern` 은 이스케이프 후.
  ② `Pagination` 의 `params.q` 와 `BoardSearch` 의 `defaultValue`·결과 문구는 `display` 를,
     `applySearch` 는 `pattern` 을 쓴다. 그러면 URL 에 들어가는 값이 다시 정리를 거쳐도
     같은 값으로 남는다.
  ③ 최소 수정으로 가려면 `:41` 의 버림 문자 집합에서 `\\` 를 빼고 `:43` 보다 **앞에**
     `.replace(/\\/g, "")` 를 둔다 — 그러면 2회차에서 `\%` → `%` → `\%` 로 되돌아
     멱등이 된다. 다만 화면에 `\` 가 보이는 문제는 남는다.
  ④ `FE/scripts/verify-goals.mjs` 에 `safeLikeTerm(safeLikeTerm(x)) === safeLikeTerm(x)` 를
     검사로 넣는다. 이 성질은 페이저가 값을 왕복시키는 구조가 유지되는 한 불변식이다.

---

## F-02 [높음] 운영자 답글 패널이 **흰 면 위에서 보이지 않는다** — 면 1.05:1 · 테두리 1.08:1

- **주장**: `27d2d36` 측정 블록 — "운영자 답글 블록 328 / 736 / 1120px",
  "360px / 768px / 1400px — **대비 위반 0** · 넘침 0".
  `CLAUDE.md:36-37` — "⚠ 요금 막대는 비문자 요소라 **3:1(SC 1.4.11)을 따로 따진다** —
  `--brand` 는 흰 배경 대비 2.88 로 미달이므로 막대에는 `--brand-dark` 를 쓴다."
  `CRITIQUE_04` F-04 는 같은 기준으로 `.cta-fill` 에 `inset 0 0 0 1px var(--brand-dark)`
  테두리를 받아냈고, 그 수정은 `globals.css:309` 에 지금 들어 있다.
- **실제**: 측정한 것은 **폭과 글자 대비**뿐이다. 패널이 바탕에서 구분되는지는 재지 않았다.
  `FE/components/sections/AdminReply.tsx:31` —

  ```
  border-2 border-brand-light bg-brand-soft
  ```

  | 축 | 색 | 바깥쪽(`BoardArticle` 의 `bg-white`) 대비 |
  |---|---|---|
  | 패널 면 | `--brand-soft #f2fcf5` | **1.05:1** |
  | 패널 테두리 2px | `--brand-light #dff7e6` | **1.13:1** |
  | 테두리 vs 패널 안쪽 | `#dff7e6` vs `#f2fcf5` | **1.08:1** |

  글자는 전부 통과한다 — `text-brand-deep` 8.95:1, `text-muted` 5.59:1, 본문 16.79:1.
  그래서 대비 감사기가 "위반 0" 을 낸다. **감사기는 글자만 재기 때문이다.**
- **왜 문제인가**: 재현 — `node scripts/preview-board.mjs` 로 띄운
  `http://localhost:3100/_preview/board.html` 의 상세 블록 하단(4번 후기에 `admin_reply` 가
  달려 있다). 또는 `admin_reply` 가 채워진 후기의 `/review/{id}`.
  이 패널은 **방문자의 글과 운영자의 글을 가르는 경계**다. `aside aria-label="운영자 답변"` 과
  "운영자 답변" 라벨 덕에 스크린리더에는 전달되지만, 눈으로 보는 쪽에는 1.05:1 짜리
  색차와 1.13:1 짜리 테두리밖에 없다 — 햇빛 아래 화면·흑백 인쇄·저시력에서 패널은
  사라지고, 운영자의 답변이 **방문자가 쓴 후기 본문의 연속**으로 읽힌다.
  후기 게시판에서 그 둘을 섞는 것은 단순한 미관 문제가 아니다.
  그리고 이 프로젝트는 이미 반대 해석을 택했다 — 요금 막대의 색을 바꿨고,
  `.cta-fill` 에 4.94:1 테두리를 넣었다. 같은 문서 안에서 장식 막대에는 3:1 을
  요구하고 **의미를 가른다고 선언한 패널**에는 1.08 을 허용하는 것은 기준이 아니다.
  레퍼런스 두 곳이 공통으로 투자한 **유일한** 상호작용이라고 적어 둔 블록이기도 하다.
- **조치**: 면은 지금의 옅은 틴트를 지키고(초록은 '점' — `CLAUDE.md`) **경계만 세운다.**
  `AdminReply.tsx:31` 의 `border-brand-light` → `border-brand-dark`
  (`#0a8230` vs 흰 배경 **4.94:1**, vs 패널 안쪽 `#f2fcf5` **4.71:1`). 2px 를 유지하면
  진초록 면적은 패널 둘레뿐이라 색면 비율에 영향이 거의 없다.
  `--brand`(2.88)는 쓰지 말 것 — 3:1 미달이다.
  그리고 측정 쪽을 고친다: `contrast-audit` 가 글자만 보는 한 "대비 위반 0" 은
  이 종류의 결함에 대해 **구조적으로 항상 참**이다(`CRITIQUE_04` F-03 과 같은 고장).
  패널·버튼의 **면/테두리 대비** 열을 따로 둔다.

---

## F-03 [중간] 검색 결과가 0건이면 "**아직 등록된 후기가 없습니다**" 라고 적는다 — 있는데 없다고 말한다

- **주장**: `FE/components/sections/BoardEmpty.tsx:4-8` —
  "목록이 비었을 때의 자리. **왜 비었는지에 따라 다른 말을 한다.**
  글이 없는 것과 못 읽은 것을 같은 문장으로 덮으면, DB 가 죽은 날에도 화면은
  '등록된 글이 없습니다' 라고 말한다 — 방문자에게 거짓이고 운영자에게는 장애를 숨기는
  표시다. LiveFeed 의 `DataPolicy` 와 같은 원칙이다."
- **실제**: 구분하는 축이 `state`(ok / unconfigured / error) **하나뿐**이고,
  "검색 결과가 없다" 는 세 번째 이유가 빠졌다. `BoardEmpty` 는 `q` 를 받지 않는다.

  `lib/board-data.ts:134` — 검색으로 0건이면 `state: "ok"` 로 돌아온다:

  ```
  if (total === 0) return { items: [], total: 0, pages: 1, current: 1, state: "ok" };
  ```

  `app/(site)/review/page.tsx:97` 이 그걸 받아 `<BoardEmpty state={state} noun="후기" />`
  → `BoardEmpty.tsx:20` → **"아직 등록된 후기가 없습니다."**
- **왜 문제인가**: 재현 — 후기가 30건 쌓인 뒤 `/review?q=존재하지않는단어`.
  화면이 **같은 섹션 안에서 스스로를 반박한다** —
  위에는 `BoardSearch.tsx:93-94` 의 "제목+내용 에서 존재하지않는단어 검색 — **0건**",
  아래에는 "**아직 등록된 후기가 없습니다**". 두 문장 중 하나는 거짓이다.
  이것은 `BoardEmpty` 의 docblock 이 "덮지 않겠다" 고 선언한 그 종류의 고장이고,
  `CRITIQUE_04` F-01(어드민 목록이 조건을 조용히 버린다)과 같은 계열이다 —
  **원인별로 다른 말을 하겠다고 적어 놓고 축을 하나 빼먹었다.**
  피해는 실적 과소 표시다. 방문자는 후기가 하나도 없는 업체로 읽고 떠난다.
- **조치**: `BoardEmpty` 에 `searching?: boolean` 을 더하고
  `state === "ok" && searching` 이면 `"'검색어'와 일치하는 ${noun}가 없습니다."` 를 쓴다.
  `review/page.tsx:97` · `notice/page.tsx:94` 에서 `searching={q !== ""}` 로 넘긴다
  (`q` 는 이미 그 자리에 있다). `BoardSearch` 의 "전체 보기" 링크가 이미 복구 경로를
  제공하므로 추가 UI 는 필요 없다.

---

## F-04 [중간] 이전글·다음글이 정보공유에서는 **항상** 목록 순서와 다르고, 동일 작성시각에서는 형제 글을 통째로 건너뛴다

- **주장**: `FE/lib/board-data.ts:229-233` —
  "`id ± 1` 로 구하면 … 조용히 건너뛰거나 존재하지 않는 글로 링크가 걸린다.
  **목록 순서와 같은 축(작성일)으로 구해야 '다음글' 이 목록에서 바로 아래 있던 글과
  일치한다.**"
  `FE/components/sections/BoardNav.tsx:9-10` 도 같은 말을 반복한다.
- **실제**: 두 가지가 틀렸다.

  **(1) 정보공유 목록의 축은 작성일이 아니다.** `board-data.ts:188-189` 는
  `is_pinned desc` → `created_at desc` **두 축**으로 정렬한다
  (001 의 `notices_pub_idx` 도 그 순서다). 그런데 `getNeighbors` (`:245-246`) 는
  `created_at` 만 본다. `is_pinned` 는 조건에도 정렬에도 없다.
  고정글이 하나라도 있으면 "다음글" 은 **목록에서 바로 아래 있던 글이 아니다.**
  이건 시각이 겹치지 않아도 **항상** 성립한다.

  **(2) 엄격 비교라 동일 `created_at` 을 전부 건너뛴다.** `:245-246` 은
  `gt` / `lt` 다. 001 의 `created_at timestamptz not null default now()` 에서
  `now()` 는 **트랜잭션 시각**이라, `insert into notices (…) values (…), (…), (…);`
  한 문장으로 들어간 행은 전부 **같은 `created_at`** 을 갖는다.
- **왜 문제인가**: 재현 — 지금 `reviews`·`notices` 의 공개 행은 **0건**이고
  (라이브 PostgREST 로 확인: `content-range: */0`), 시드 파일도 없고,
  **어드민에 글 작성 화면이 하나도 없다**(`app/(admin)/admin/` 에는
  `leads` · `login` · `enroll-2fa` 뿐). 즉 첫 글은 Supabase 대시보드의 SQL 또는
  표 편집기로 들어온다 — **여러 행을 한 문장으로 넣는 것이 가장 자연스러운 경로다.**
  그렇게 20건을 넣으면:
  - 20건 전부가 같은 시각 `T` 를 갖는다.
  - 각 글의 `gt T` 는 비어 있다 → 20건 **전부**가 "가장 최근 글입니다" 라고 적는다.
  - 각 글의 `lt T` 는 그 묶음 **밖**의 글을 가리킨다 → 19개의 형제 글이
    이전/다음 내비로는 **도달할 수 없다**.
  JS 가 막힌 환경에서 목록 페이저 다음으로 유일한 글 사이 이동 수단인데
  (그게 번호 페이저를 고른 이유로 적혀 있다) 그 경로가 끊긴다.
  그리고 `console.error` 도 안 찍힌다 — 쿼리는 성공하고 0행을 돌려주기 때문이다.
- **조치**:
  ① `getNeighbors` 의 시그니처를 `(table, row: { id, created_at, is_pinned? })` 로 바꿔
     **목록과 같은 정렬 키 전체**로 비교한다. 정보공유는
     `(is_pinned, created_at, id)` 사전식 비교가 필요하다 — PostgREST 로는
     `.or("is_pinned.lt.…,and(is_pinned.eq.…,created_at.lt.…)")` 로 표현되고,
     그 `.or()` 는 사용자 입력을 담지 않으므로 F-09 의 대상이 아니다.
  ② 동일 시각 처리는 `id` 를 **타이브레이커**로 넣어 닫는다
     (`created_at.lt.T` 또는 `created_at.eq.T` 이면서 `id.lt.N`).
  ③ `BoardNav.tsx:9-10` 과 `board-data.ts:229-233` 의 "목록 순서와 같은 축" 주석은
     실제로 같은 축을 쓰게 된 뒤에만 남긴다. 지금은 코드가 주석을 반증한다.

---

## F-05 [중간] 목록 정렬에 타이브레이커가 없다 — 같은 글이 두 페이지에 나오거나 어느 페이지에도 안 나온다

- **주장**: `FE/lib/board.ts:42-43` — "15 는 레퍼런스(탐나넷) 실측값이다 — 1페이지 15행,
  2페이지 15행, 총 55건에 페이저 4칸."
  `board-data.ts:117-118` — "검색 중이면 **검색 결과의** 건수여야 한다 — 전체 건수로
  페이지를 나누면 결과가 3건인데 페이저가 5페이지로 나오고, 2페이지는 빈 화면이 된다."
  페이지 분할의 정확성을 신경 쓴 흔적이 분명하다.
- **실제**: 정렬 키가 유일하지 않다.
  `board-data.ts:144` `.order("created_at", { ascending: false }).range(p.from, p.to)` —
  `reviews` 는 `created_at` 하나, `notices` 는 `(is_pinned, created_at)` 둘.
  어느 쪽도 유일하지 않다. PostgreSQL 의 `ORDER BY` 는 **동치 키 사이의 순서를
  보장하지 않고**, `LIMIT`/`OFFSET` 은 각 페이지마다 **독립적인 실행**이다.
  행이 수백 건 수준이면 플래너는 인덱스 스캔이 아니라 seq scan + top-N heapsort 를
  고르는데, heapsort 는 안정 정렬이 아니다.
- **왜 문제인가**: F-04 와 같은 전제다 — 다중행 `INSERT` 로 들어온 글은
  `now()` 가 트랜잭션 시각이라 **`created_at` 이 전부 같다.**
  재현: 한 문장으로 후기 20건을 넣고 `/review` 와 `/review?page=2` 를 연다.
  경계(15번째/16번째)에 걸린 동치 행들의 선택이 두 실행에서 일치할 보장이 없으므로
  같은 글이 양쪽에 보이거나, **어느 페이지에도 안 보인다.**
  "전체 20건" 이라고 적혀 있는데 1·2페이지를 합쳐 19건만 읽히는 상태가
  에러 없이 만들어진다 — 건수와 내용이 어긋나는데 아무 로그도 남지 않는다.
  `notices` 는 더 넓다: 고정글 3건이 전부 `is_pinned=true` + 같은 시각이면
  그 3건의 순서가 요청마다 바뀔 수 있다.
- **조치**: `board-data.ts:144` 와 `:188-190` 에 `.order("id", { ascending: false })` 를
  **마지막 축으로** 더한다. `id` 는 serial PK 라 유일하므로 전순서가 되고,
  `created_at` 이 같을 때의 순서가 "나중에 들어온 것이 위" 로 고정된다.
  F-04 ②의 `id` 타이브레이커와 **같은 키 순서**여야 한다 — 목록과 이전/다음글이
  다른 전순서를 쓰면 지금과 같은 어긋남이 다시 생긴다.
  001 의 인덱스에도 `id desc` 를 더하면 정렬이 인덱스만으로 끝난다(새 마이그레이션 파일로).

---

## F-06 [중간] G0b 의 `dangerouslySetInnerHTML` 검사는 **400자 근접**으로 면제한다 — JSON-LD 옆이면 원본 HTML 주입이 통과한다

- **주장**: `27d2d36` — "게시글 본문을 `dangerouslySetInnerHTML` 로 꽂는 곳 없음.
  … JSON-LD 는 예외지만 **`<` 이스케이프까지 같이 확인**한다 —
  ld+json 이라는 이유만으로 면제하면 이스케이프를 뺀 판이 통과한다."
  `verify-goals.mjs:226-231` 주석도 같은 말을 적는다.
- **실제**: 확인하는 것은 "이스케이프가 **그 주입에** 적용됐는지" 가 아니라
  "같은 파일의 앞 400자에 `application/ld+json` 이 있고 뒤 400자에 `replace(/</g` 가
  있는지" 다. `verify-goals.mjs:232-245` —

  ```js
  const before = src.slice(Math.max(0, i - 400), i);
  const after  = src.slice(i, i + 400);
  const jsonLd = /application\/ld\+json/.test(before) &&
                 /replace\(\s*\/<\/g/.test(after);
  if (!jsonLd) return true;
  ```

  이스케이프 표현식과 `__html` 에 들어가는 값 사이에 **아무 연결도 요구하지 않는다.**
  반례를 만들어 돌렸다 — `/tmp/g0t/a.tsx`:

  ```tsx
  <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />   // 이스케이프 없음
  <div dangerouslySetInnerHTML={{ __html: post.content }} />                 // 게시글 본문 생주입
  <span>{"x".replace(/</g, "&lt;")}</span>                                   // 무관한 이스케이프
  ```

  → **검사 결과 위반 0건.** 두 주입 모두 통과한다.
  첫 번째는 자기 뒤 400자 안에 `replace(/</g` 가 있어서, 두 번째는 자기 앞 400자 안에
  `application/ld+json` 이 있어서.
- **왜 문제인가**: 이 검사의 존재 이유는 커밋 메시지가 직접 적는다 —
  "어드민 계정이 하나뿐이라 그 계정이 털리면 **저장형 XSS 가 전 방문자에게 실행된다**".
  그 하나뿐인 방어선이 "근처에 JSON-LD 가 있으면 눈을 감는" 구조다.
  그리고 재현 조건이 인위적이지 않다 — 게시판 상세 페이지에
  `Article`/`BlogPosting` JSON-LD 를 넣는 것은 이 프로젝트가 당연히 할 다음 작업이고
  (`d28b63f` 가 방금 SEO 기반을 깔았다), 그러면 `BoardArticle.tsx` 안에
  ld+json 과 본문 렌더가 400자 안에 나란히 놓인다. 그 상태에서 누가
  "줄바꿈만으로는 서식이 부족하다" 며 본문을 HTML 로 바꾸면 **검사는 통과한다.**
  또 하나 — `verify-goals.mjs:224` 의 `strip` 은 **줄 머리의 `//`** 만 지운다
  (`/^\s*\/\/.*$/gm`). 코드 뒤에 붙은 `// dangerouslySetInnerHTML 금지` 같은 꼬리
  주석은 남아서 **위반으로 잡힌다**. 커밋 메시지가 "주석을 지우고 보도록 고쳤다" 고
  적은 문제가 절반만 고쳐져 있다(지금은 해당하는 꼬리 주석이 없어 증상이 없다).
- **조치**: 면제를 **구문 단위**로 좁힌다.
  `dangerouslySetInnerHTML` 의 `__html:` 뒤부터 그 객체 리터럴이 닫히는 곳까지를
  중괄호 깊이로 잘라낸 뒤, 그 **조각 안에서** `replace(/</g` 를 찾게 한다
  (`staticPath` 가 이미 같은 깊이 세기를 하고 있으니 그 유틸을 재사용한다).
  그러면 "이 주입의 값이 이스케이프를 거쳤는가" 를 실제로 묻게 된다.
  `before` 의 `application/ld+json` 도 같은 요소 안인지로 바꾼다
  (`<script` 부터 그 `dangerouslySetInnerHTML` 까지 사이에 `>` 가 없을 것).
  `strip` 은 꼬리 `//` 까지 보려면 `/(^|\s)\/\/.*$/gm` 으로 넓히고,
  문자열·정규식 안의 `//`·`/*` 때문에 코드가 날아가지 않는지
  **현재 101개 파일에 대해 strip 전후 길이 차이를 찍어** 확인한다.

---

## F-07 [중간] G0b 의 `.or()` 검사는 **파일 단위**라서, 이미 통과한 파일에 생문자열을 더하면 영원히 안 걸린다 (그리고 `.or (` 를 못 본다)

- **주장**: `27d2d36` — "`.or()` 쓰는 파일은 전부 `safeLikeTerm` 또는 `SafeLikeTerm` 경유."
  `verify-goals.mjs:260-266` — "허용 지점은 두 곳이다 … 둘 다 `safeLikeTerm` 을 거쳐야
  하므로, `.or(` 를 쓰면서 그 함수를 부르지 않는 파일은 전부 실패다."
- **실제**: `verify-goals.mjs:268-274` 는 **호출 지점**이 아니라 **파일**을 본다.

  ```js
  if (!/\.or\(/.test(src)) return false;
  return !/safeLikeTerm\(/.test(src) && !/SafeLikeTerm/.test(src);
  ```

  구멍 둘 —
  1. **`lib/board-data.ts` 는 `SafeLikeTerm` 이라는 글자가 import 문(`:9`)에 있다는
     이유로 통과한다.** 그 파일 안에 `query.or(\`title.ilike.%${anyRawString}%\`)` 를
     한 줄 더 넣어도 검사는 통과한다. `lib/admin/leads.ts` 도 같다 — `:121` 이
     정리된 `q` 를 쓰므로 통과 상태이고, 같은 파일에 정리 없는 `.or()` 를 더하면
     여전히 통과한다. **"어드민 쪽은 한동안 정리 없이 끼워 넣고 있었다" 는 바로 그
     사고가 같은 파일에서 재발하면 못 잡는다.**
  2. **공백을 못 본다.** `/\.or\(/` 는 `query .or (…)` 와 안 맞는다.
     반례 `/tmp/g0t/b.ts` — `return query .or (\`title.ilike.%${raw}%\`);`
     → **위반 0건으로 통과.** 적법한 JavaScript 이고 Prettier 가 그렇게 쓰지는
     않지만, `.or(\n  \`…\`\n)` 같은 줄바꿈 형태도 `.or(` 는 맞지만
     `filter((f) => …)` 가 **파일** 판정이라 1번과 합쳐지면 의미가 없다.

  (대조군으로 `/tmp/g0t/c.ts` — `safeLikeTerm` 이 없고 `.or(` 가 붙어 있는 파일은
   정상적으로 **잡힌다.** 검사가 완전히 죽은 것은 아니다.)
- **왜 문제인가**: 이 검사가 막겠다고 선언한 대상은 "조용한 오답" 이다
  (`postgrest.ts:11-12`). 그 오답은 **새 호출 지점**에서 생기는데 검사는 파일 단위다.
  그리고 `.or()` 를 쓰는 파일이 지금 **정확히 2개**뿐이라, 그 2개가 통과 상태로
  굳어진 순간 이 검사는 사실상 아무것도 보지 않는다 — 통과 메시지
  "검색어 정리를 안 거치는 `.or()` 없음" 은 "`.or()` 쓰는 파일 2개가 둘 다
  어딘가에서 `safeLikeTerm` 이라는 글자를 포함한다" 는 뜻이다.
- **조치**: 호출 지점 단위로 본다 — `/\.or\s*\(/g` 로 각 `.or(` 를 찾고,
  F-06 과 같은 중괄호/괄호 깊이 세기로 **그 호출의 인자 문자열**을 잘라낸 뒤,
  그 안의 `${…}` 보간 식별자가 `SafeLikeTerm` 타입 변수인지(또는
  같은 스코프에서 `safeLikeTerm(` 의 반환값인지)를 본다.
  거기까지 가기 어렵다면 최소한 **보간이 하나라도 있는 `.or()` 는 전부 신고**하고
  허용 목록을 `파일:줄` 로 적게 한다 — 줄이 움직이면 다시 봐야 하는 쪽이,
  파일이 영원히 통과하는 쪽보다 낫다.
  `applySearch` 처럼 `.or()` 를 한 함수에 가두는 구조라면,
  "`.or(` 는 `lib/board-data.ts` 의 `applySearch` 안에서만 나타난다" 를
  불변식으로 검사하는 쪽이 더 단단하다.

---

## F-08 [중간] G0 링크 검사 — 동적 디렉터리 폴백이 `/notice/latest` · `/review/0` 을 "존재하는 라우트" 로 통과시키고, `href=` 58곳 중 **7개만** 본다

- **주장**: `96305b3` — "'코드가 거는 내부 링크' ⊆ '존재하는 라우트' 를 데이터 상태와
  무관하게 본다. 템플릿 리터럴의 `${...}` 를 동적 구간(`:x`)으로 되살려 `[id]` 라우트까지
  확인한다 — 그냥 잘라 버리면 `/review/${r.id}` 가 `/review` 로 줄어 목록만 있어도
  통과한다. **정작 깨지는 건 `/review/1` 인데.**"
  통과 메시지는 "링크 7개 전부 라우트 존재".
- **실제**: 두 가지가 검사의 주장보다 좁다.

  **(1) 모든 미지 세그먼트가 `[id]` 로 해석된다.** `verify-goals.mjs:59-63` —

  ```js
  const hit = seg === ":x"
    ? names.find((n) => /^\[.+\]$/.test(n))
    : (names.find((n) => n === seg) ?? names.find((n) => /^\[.+\]$/.test(n)));
  ```

  정적 세그먼트가 안 맞으면 **아무 동적 디렉터리에나 붙인다.** 실측 —

  ```
  routeExists("/notice/latest") = true     ← parseId("latest") → notFound()
  routeExists("/review/abc")    = true     ← 같음
  routeExists("/review/0")      = true     ← parseId("0") → n > 0 실패 → notFound()
  routeExists("/notice/999999") = true     ← 행이 없으면 notFound()
  routeExists("/kt/foo")        = false    (이건 제대로 잡는다)
  ```

  즉 `href="/notice/latest"` 같은 **정적 오타 링크를 이 검사가 보증한다.**
  `parseId`(`review/[id]/page.tsx:17-20`, `notice/[id]/page.tsx:13-16`)가
  404 로 끊는다는 사실을 검사는 모른다 — 그런데 커밋이 막겠다고 적은 고장이
  바로 "데이터가 들어오면 404 가 노출된다" 다.

  **(2) 집합이 7개다.** `app` + `components` 전체에서 `href=` 는 **58번** 나오는데
  `:125` 의 정규식이 집는 것은 33개, 그중 라우트로 등록되는 것은 **7개**다 —
  `/admin` `/admin/leads` `/admin/leads/:x` `/notice` `/notice/:x`
  `/review` `/review/:x`. 빠지는 것들:
  - `href={href(n)}` — `Pagination.tsx:59,85,97`. **이번에 만든 페이저 링크 전부.**
  - `` href={`${base}/${item.id}`} `` — `BoardNav.tsx:36`. 선두가 보간이라
    `:129` 가 버린다. **이번에 만든 이전글/다음글 링크 전부.**
  - `href={`/${c.slug}`}` 계열 — 통신사 4페이지 링크 전부(같은 이유).
  - `action="/review"` — `BoardSearch.tsx:42`. 라우트를 가리키는 **폼 action** 인데
    정규식이 `href=` 만 본다.
  - `href={"/review"}`·단일 인용부호·삼항 — 문법이 안 맞아 통째로 누락.
- **왜 문제인가**: `/review` `/notice` 라우트의 부재는 확실히 잡는다 — 그건 제대로 됐고
  실제로 결함을 찾아냈다. 문제는 **통과 메시지가 그보다 넓은 것을 보증하는 것처럼
  읽힌다**는 점이다("링크 7개 전부 라우트 존재"는 7개가 전체라는 뜻으로 읽힌다).
  이번 커밋이 추가한 내부 링크 중 **상세→상세 이동(이전/다음글)과 목록 페이저는
  단 하나도 검사 범위에 없다.** 그리고 `[id]` 라우트 밑의 정적 링크는
  검사가 **적극적으로 잘못된 통과를 준다**.
  `CRITIQUE_04` F-16 이 지적한 "검사가 실패하지 않는다" 와 같은 고장 모드다.
- **조치**:
  ① `resolveIn` 의 동적 폴백을 `seg === ":x"` 일 때로 **한정**한다
     (`:62-63` 의 `?? names.find(dynamic)` 제거). 정적 세그먼트가 디렉터리로 없으면
     그건 깨진 링크다.
  ② `:x` 로 해석된 링크에 대해 **그 라우트의 `parseId` 가 받아들이는 모양인지**는
     정적으로 못 보지만, 반대로 정적 세그먼트(`/notice/latest`)는 ①로 걸린다.
  ③ 집합을 넓힌다 — `href=`/`action=` 둘 다, `{"…"}` 리터럴도, 그리고
     `base=`/`href=` 로 경로 문자열을 **prop 으로 받는 컴포넌트**(`Pagination`
     `BoardNav` `BoardArticle.breadcrumb`)의 인자를 같이 훑는다.
  ④ 통과 메시지에 "집은 것 / 전체 `href` 수" 를 같이 찍는다
     (지금은 `7` 만 보이고 `58` 은 안 보인다).

---

## F-09 [중간] 브랜드 타입은 **한 홉만** 막는다 — `applySearch` 안에서 패턴을 만드는 순간 보증이 끝난다

- **주장**: `27d2d36` — "전제를 주석으로 적는 걸로는 부족해서 **브랜드 타입(`SafeLikeTerm`)**
  으로 바꿨다 — 정리를 거치지 않은 문자열은 **컴파일이 거부한다.** 실제로 확인했다:
  `getReviewPage({ q: "x,phone_enc.ilike.*" })` → `TS2322`."
  `lib/board-data.ts:70-71` — "`SafeLikeTerm` 이라서 **`sanitizeQuery` 를 거치지 않은 값은
  타입 단계에서 들어올 수 없다.**"
- **실제**: 그 주장은 `BoardQuery.q` **경계에서만** 참이다. 실측으로 확인한 것 —
  `as SafeLikeTerm` 캐스트는 `postgrest.ts:36` 과 `:45` 두 곳뿐이고 둘 다 정리 직후다.
  `JSON.parse` 경유 생성 경로도 없다. 여기까지는 깔끔하다.
  그런데 `board-data.ts:94` 에서 —

  ```ts
  const pattern = `%${q}%`;                                        // 타입: string
  …
  return query.or(`title.ilike.${pattern},content.ilike.${pattern}`);  // 타입: string
  ```

  템플릿 리터럴의 결과는 **평범한 `string`** 이다. `.or()` 의 인자 타입은
  postgrest-js 가 `string` 으로 받으므로, 이 함수 안에서는 어떤 문자열이든
  `.or()` 에 들어간다. 브랜드 타입은 `applySearch` 의 **입구**를 지키고
  `.or()` 의 **입구**는 지키지 않는다.
  F-07 에서 본 대로 G0b 검사도 같은 파일을 파일 단위로 통과시키므로,
  `lib/board-data.ts` 안에서 생문자열을 `.or()` 에 넣는 변경은
  **타입 검사와 G0 둘 다 통과한다.**
- **왜 문제인가**: 지금 결함은 없다 — 코드가 실제로 정리된 값만 쓴다.
  문제는 **커밋 메시지와 주석이 보증 범위를 실제보다 넓게 적어 둔 것**이고,
  그걸 읽은 다음 사람은 "이 파일에서는 타입이 지켜 준다" 고 믿는다.
  `.or()` 가 사용자 입력을 담는 유일한 자리가 이 파일이라 믿음의 대상이 정확히
  틀린 곳을 가리킨다.
  (`.or()` 자체가 위험하다는 뜻은 아니다. F-04 ①처럼 사용자 입력이 없는 `.or()` 는
   안전하고, 그 둘을 타입으로 구분할 수단이 지금 없다.)
- **조치**: 보증을 `.or()` 입구까지 끌고 간다 —
  `lib/postgrest.ts` 에 `likePattern(q: SafeLikeTerm): SafeLikePattern` 과
  `orFilter(...parts: SafeLikePattern[]): SafeFilter` 를 두고,
  `.or()` 호출을 `SafeFilter` 만 받는 얇은 래퍼(`safeOr(query, filter)`)로 감싼다.
  그러면 템플릿 리터럴이 중간에 끼어들 자리가 없어진다.
  그게 과하다면, 최소한 `board-data.ts:70-71` 과 `:84-86` 의 주석을
  "`BoardQuery.q` 경계까지만 타입이 지킨다 — `applySearch` 안에서 패턴을 조립하는
  구간은 사람이 본다" 로 **정확하게** 고친다.

---

## F-10 [중간] 미리보기 하네스가 "구조적으로 불가능하게 했다" 던 손베끼기를 **통신사 뱃지에서 그대로 하고 있다** — 사고를 일으킨 그 요소에서

- **주장**: `FE/scripts/preview-board.mjs:67-69` —
  "상세는 **페이지와 같은 `BoardArticle`** 을 쓴다. 손으로 베껴 쓴 적이 있고 그때
  **통신사 뱃지 클래스를 틀려(`bg-kt-ink`) 대비 1.00 짜리 거짓 위반**을 만들었다 —
  하네스와 제품이 갈라지면 측정이 제품을 말해 주지 않는다."
  `4b0dd7e` 커밋 메시지도 "`BoardArticle` 로 합쳐 그 어긋남을 **구조적으로 불가능하게
  했다**" 고 적는다.
  `components/sections/BoardArticle.tsx:7-13` 에도 같은 서술이 있다.
- **실제**: `BoardArticle` 은 뱃지를 **`badge?: React.ReactNode` prop 으로 받는다**
  (`BoardArticle.tsx:29`). 즉 뱃지 마크업은 컴포넌트 안에 없고 **호출부마다 따로** 있다.
  그리고 `preview-board.mjs:75` 가 그걸 **손으로 다시 적는다** —

  ```
  preview-board.mjs:75   ["mb-3 inline-block rounded-md px-2 py-0.5 text-[11px] font-black text-white",
                          CARRIER_COLOR[row.carrier] ?? "bg-muted"].join(" ")
  review/[id]/page.tsx:52 `mb-3 inline-block rounded-md px-2 py-0.5 text-[11px] font-black text-white
                           ${CARRIER_COLOR[review.carrier] ?? "bg-muted"}`
  ```

  **사고를 일으킨 바로 그 요소가 유일하게 공유되지 않은 요소다.**
  지금은 클래스 문자열이 우연히 일치한다(글자 단위로 대조해 확인했다). 그러나
  라벨은 이미 갈라져 있다 —

  | | 뱃지 글자 |
  |---|---|
  | 제품 `review/[id]/page.tsx:54` | `carrier?.label ?? review.carrier` → **"KT스카이라이프"**(7자) |
  | 하네스 `preview-board.mjs:76` | `{row.carrier}` → **"SKYLIFE"**(7자, 다른 문자폭) |

- **왜 문제인가**: 재현 — `node scripts/preview-board.mjs` 로 만든 상세 블록의
  통신사 뱃지를 제품의 `/review/{id}`(carrier=SKYLIFE) 와 비교하면 글자가 다르다.
  뱃지는 **폭이 가장 쉽게 넘치는 요소**(`inline-block` + 좁은 패딩)이고,
  한글 7자와 라틴 7자의 렌더 폭은 거의 두 배 차이다.
  "360px 넘침 0" 이라는 측정은 **라틴 7자로 재서 얻은 값**이다.
  더 나쁜 것은 주석이다 — 다음 사람은 "뱃지도 이제 공유된다" 고 읽고
  `review/[id]/page.tsx:52` 의 클래스를 고칠 때 하네스를 고치지 않는다.
  그러면 `b9cddf9` 때와 **정확히 같은 거짓 측정**이 돌아온다
  (`bg-kt-ink` 오타 → 대비 1.00). 구조적으로 불가능해지지 않았다.
- **조치**: 뱃지를 `components/ui/CarrierBadge.tsx` 로 뽑고
  `review/[id]/page.tsx:50-57` · `ReviewList.tsx:25-30` · `preview-board.mjs:75`
  세 곳이 같이 쓴다(목록 뱃지는 `mb-2.5 w-fit` + `"SKY"` 축약이라 `size`/`short`
  prop 으로 갈라 둔다). 그러면 클래스와 라벨이 한 곳에서 온다.
  뽑기 전에는 `BoardArticle.tsx:7-13` 과 `preview-board.mjs:67-69` 의
  "구조적으로 불가능해졌다" 를 **"본문·헤더는 공유하고 뱃지는 여전히 두 곳에 있다"**
  로 고친다. 지금 그 주석은 읽는 사람을 틀린 안심으로 데려간다.

---

## F-11 [중간] 홍보 이미지에 `alt=""` — "`content` 가 대체 텍스트" 는 강제되지도, 연결되지도 않는다

- **주장**: `BE/supabase/migrations/007_board_reply_and_images.sql:21-23` —
  "`content` 를 비울 수는 없게 둔다(not null 유지) — 이미지만 올리면 스크린리더
  사용자와 검색엔진에게 그 글은 **빈 글**이다. **대체 텍스트를 강제하는 자리가
  `content` 다.**"
  `FE/components/sections/BoardArticle.tsx:74-76` — "`alt=""` 는 의도적이다 —
  이 이미지들의 내용은 아래 `content` 가 글로 말한다(007 이 `content` 를 not null 로
  남겨 둔 이유가 그것이다)."
- **실제**: 세 가지가 어긋난다.
  1. **`content`(001:195)는 `text not null` 이지만 빈 문자열을 막지 않는다.**
     007 은 `admin_reply` 에는 `btrim(...) <> ''` 제약(`:45-46`)을 걸었는데
     `content` 에는 걸지 않았다. `insert into notices (title, content, …) values ('…', '', …)`
     가 통과한다. 그러면 `alt=""` 이미지 N장 + 본문 0자 = **스크린리더에 아무것도
     없는 글**이고, 007 주석이 막겠다고 선언한 그 상태다.
  2. **not null 은 "존재" 를 강제하지 `content` 가 이미지를 **설명한다**는 것을
     강제하지 않는다.** 운영자가 `content` 에 "10월 프로모션" 한 줄을 쓰고
     금액·조건을 전부 이미지에 담으면, 그 금액은 스크린리더 사용자에게 존재하지 않는다.
     레퍼런스 실측이 "텍스트 0자, PNG 6장" 이었다는 것은 **운영자가 실제로 그렇게
     한다**는 근거다.
  3. **`alt=""` 는 "이 이미지는 아무 정보도 전달하지 않는다" 는 적극적 선언이다**
     (WCAG 1.1.1 / H67). 본문이 이미지를 설명하더라도, 둘을 묶는 마크업이 없으면
     (`figure`/`figcaption`, `aria-describedby` 등) AT 는 그 관계를 모른다.
     "글 본문이 곧 이미지 설명" 이라는 전제는 사람의 약속이고 코드에 없다.
- **왜 문제인가**: 재현 — `notices` 에 `content` 를 한 줄짜리 제목 반복으로 두고
  `image_urls` 에 상세페이지 컷 3장을 넣은 뒤 `/notice/{id}` 를 스크린리더로 읽는다.
  이미지 3장은 **한 번도 언급되지 않고**, 글은 한 줄로 끝난다.
  이 게시판은 "**홍보 이미지 채널**" 로 운영하겠다고 007 과 `BoardArticle` 양쪽에
  적어 둔 자리다 — 즉 **정보의 본체가 이미지에 있는 것이 정상 운용**이고,
  그 전제에서 `alt=""` 는 거의 항상 틀린 선언이 된다.
  "파일명이나 추측한 설명을 읽히는 쪽이 더 나쁘다"(`:76`)는 맞는 판단이지만,
  선택지가 그 둘뿐인 것은 **스키마가 대체 텍스트 칸을 만들지 않았기 때문**이다.
- **조치**:
  ① 새 마이그레이션으로 `notices.image_alts text[]` 를 더하고
     `array_length(image_alts,1) = array_length(image_urls,1)` 를 제약으로 건다
     (`image_urls` 가 null 이면 둘 다 null). 장수와 설명 수가 어긋나면 DB 가 막는다.
     `BoardArticle` 의 `images` prop 을 `{ url, alt }[]` 로 바꾼다.
  ② 그 전까지는 `content` 에 `btrim(content) <> ''` 제약을 더해
     007 주석이 선언한 "대체 텍스트 강제" 를 **실제로** 강제한다
     (`admin_reply` 에는 이미 같은 제약이 있다 — 같은 이유에서).
  ③ `BoardArticle.tsx:70-91` 의 이미지들을 `<figure>` 로 감싸고
     본문을 `<figcaption>` 또는 `aria-describedby` 로 연결한다. 그러면
     "본문이 이미지를 설명한다" 가 마크업으로 표현된다.
  ④ `BoardArticle.tsx:74-76` 의 주석에서 "007 이 `content` 를 not null 로 남겨 둔
     이유가 그것이다" 는 ②가 들어간 뒤에만 사실이 된다.

---

## F-12 [중간] 목록 쿼리가 **쓰지도 않는** 007 열을 받아 온다 — 그래서 지금 라이브에서 목록마다 왕복 2회 + 에러 로그 1줄

- **주장**: `FE/lib/board-data.ts:22-29` — "열이 없으면 PostgREST 가
  `42703 undefined column` 을 내고, 그대로 두면 목록 전체가 '불러오지 못했습니다' 가
  된다 — **답글 하나 때문에 게시판이 통째로 죽는다.** 열이 없으면 그 열만 빼고 다시
  조회하고, 어느 마이그레이션이 빠졌는지 로그에 이름으로 찍는다."
- **실제**: 폴백은 정확히 동작한다(실측 — 아래 "확인했고 문제 없음" 참고).
  문제는 **목록 경로에 그 폴백이 필요한 이유가 없다는 것**이다.

  | 쿼리 | 추가로 받는 007 열 | 그 열을 쓰는 곳 |
  |---|---|---|
  | `getReviewPage` `:146` | `admin_reply, admin_reply_at` | `ReviewList.tsx` — **없음** |
  | `getNoticePage` `:191` | `image_urls` | `NoticeList.tsx` — **없음** |
  | `getReview` `:207` | `admin_reply, admin_reply_at` | `review/[id]/page.tsx:76` ✓ |
  | `getNotice` `:221` | `image_urls` | `notice/[id]/page.tsx:54` ✓ |

  `ReviewList` 는 `carrier` `title` `rating` `content` `created_at` 만 읽고
  (`ReviewList.tsx:24-40`), `NoticeList` 는 `is_pinned` `title` `content` `created_at`
  만 읽는다(`NoticeList.tsx:23-39`). 답글 유무 표시도 없다.

  그리고 **007 은 지금 라이브에 적용되어 있지 않다.** 라이브 PostgREST 실측 —

  ```
  GET /rest/v1/reviews?select=id,admin_reply   → 400 {"code":"42703","message":"column reviews.admin_reply does not exist"}
  GET /rest/v1/notices?select=id,image_urls    → 400 {"code":"42703","message":"column notices.image_urls does not exist"}
  ```

  즉 `/review` · `/notice` 목록은 **매 렌더마다**
  (1) 건수 쿼리 → (2) 400 으로 실패하는 전체 열 쿼리 → (3) 축소 쿼리
  = **3회 왕복** + `console.error` 1줄을 쓴다. 쓰이지 않는 두 열 때문에.
- **왜 문제인가**: 재현 — `/review` 를 열고 서버 로그를 본다.
  `[review] 007_board_reply_and_images.sql 가 적용되지 않았습니다 …` 가 **요청마다**
  찍힌다. `BE/APPLY.md:64-65` 는 운영자에게 "적용 후 로그에서 이 줄이 없는지 확인할 것"
  이라고 적어 뒀는데, 그 줄은 **007 을 적용해야 할 이유가 없는 경로에서도** 나온다.
  `review/page.tsx:14` 가 `revalidate = 300` 이지만 이 페이지는 `searchParams` 를
  읽어 동적이므로(F-14) 캐시가 그 왕복을 흡수하지 않는다 —
  방문자 수 × 3 회 왕복, 방문자 수만큼의 에러 로그다.
  더 중요한 건 설계 신호다. 폴백은 "답글 하나 때문에 게시판이 통째로 죽는 걸 막는다"
  는 목적으로 들어왔는데, **목록이 죽을 이유가 애초에 없었다** — 목록은 007 열을
  쓰지 않는다. 필요 없는 실패 경로를 만들고 그 실패를 복구하는 코드를 붙인 셈이다.
- **조치**: `board-data.ts:146` 에서 `, admin_reply, admin_reply_at` 를,
  `:191` 에서 `, image_urls` 를 **지운다.** 그러면 목록 두 경로는
  `selectWithOptional` 이 아니라 평범한 단일 쿼리가 되고
  (`BASE` 열은 001 에 전부 있으므로 42703 이 날 수 없다),
  폴백은 **상세 2곳**(`getReview` `getNotice`)에만 남는다 — 거기서는 실제로 필요하다.
  목록에서 "답글 있음" 표시를 나중에 넣고 싶으면 그때
  `admin_reply` 가 아니라 `admin_reply_at` 만(또는 `admin_reply is not null` 계산열로)
  받으면 된다 — 답글 본문 15건을 목록에서 받을 이유는 그때도 없다.

---

## F-13 [낮음] `pageParam` 의 주석이 `page=1e9` 를 1 로 떨어뜨린다고 적는데, 실제로는 **1000000000** 을 돌려준다

- **주장**: `FE/lib/board.ts:96-99` — "쿼리는 누구나 손으로 고칠 수 있으므로
  `page=-1` `page=abc` **`page=1e9`** 가 와도 **1 로 떨어뜨린다.**"
- **실제**: `:104` 의 조건은 `Number.isSafeInteger(n) && n >= 1` 이다.
  `Number("1e9")` 는 `1000000000` 이고 안전 정수라 **그대로 통과한다.** 실측 —

  ```
  "1"                → 1          "abc"      → 1
  "-1"               → 1          "1.5"      → 1
  "1e9"              → 1000000000   ← 주석이 1 이라고 적은 값
  "9007199254740991" → 9007199254740991
  "0x10"             → 16           ← 16진수도 통과
  " 3 "              → 3            ← 앞뒤 공백도 통과
  ```

- **왜 문제인가**: 실제 피해는 없다 — `paginate`(`:82-93`)가 `current` 를 `pages` 로
  clamp 하고 `from`/`to` 를 그 clamp 된 값에서 뽑기 때문에
  `/review?page=1e9` 는 마지막 페이지를 돌려준다(실측 확인).
  문제는 주석이 **구체적인 입력값을 들어 거짓 보증을 한다**는 점이다.
  다음 사람이 `pageParam` 의 출력에 상한이 걸려 있다고 믿고 그 값을
  clamp 없이 쓰는 코드를 쓰면(예: 사이트맵 페이저, `aria-label`, 로깅)
  거기서 `1e9` 가 나온다. 세 줄짜리 순수 함수라 **주석을 쓴 자리에서 바로
  확인할 수 있었던** 종류의 오류다.
  (`0x10` → 16, `" 3 "` → 3 도 같은 계열이다. `Number()` 가 받아들이는 문법이
   `?page=` 로 올 숫자보다 넓다.)
- **조치**: 주석을 코드에 맞추거나 코드를 주석에 맞춘다. 후자가 낫다 —

  ```ts
  if (typeof raw !== "string" || !/^[1-9]\d{0,5}$/.test(raw)) return 1;
  return Number(raw);
  ```

  (최대 999,999 페이지 = 15,000,000건. `leads` 가 아닌 게시판에 그보다 많은 글이
  쌓이는 일은 없고, 넘치면 1 로 떨어지는 게 지금 동작과 같다.)
  `verify-goals.mjs` 에 `pageParam` 케이스로 `1e9` `0x10` `" 3 "` 를 넣는다 —
  순수 함수라 DB 없이 바로 돌 수 있다(`CRITIQUE_04` F-01 의 교훈).

---

## F-14 [낮음] `revalidate = 300` 주석이 목록 두 페이지에는 적용되지 않는다

- **주장**: `app/(site)/review/page.tsx:13` · `notice/page.tsx:13` —
  `// 게시판은 5분 재생성 (CLAUDE.md 코딩 규칙)` + `export const revalidate = 300;`
  `app/sitemap.ts:8-9` — "5분마다 다시 만든다 — **게시판이 `revalidate = 300`** 이라
  사이트맵이 더 오래 묶여 있으면 '글은 있는데 사이트맵엔 없는' 구간이 생긴다."
  `CLAUDE.md` 코딩 규칙 — "랜딩은 SSG, 게시판은 `revalidate = 300`".
- **실제**: `/review` 와 `/notice` 는 `searchParams` 를 await 한다
  (`review/page.tsx:58`, `notice/page.tsx:57`). Next.js 15 App Router 에서
  `searchParams` 를 읽는 페이지는 **정적 프리렌더 대상이 아니고 요청마다 동적으로
  렌더된다**(PPR 미사용). 그러면 `revalidate = 300` 이 지키는 HTML 캐시 항목이
  존재하지 않는다 — 5분 재생성이 아니라 **매 요청 렌더**다.
  `/review/[id]` · `/notice/[id]` 는 `params` 만 쓰므로 ISR 300 이 정상 적용된다.
  즉 "게시판은 5분 재생성" 은 **상세에만** 참이다.
- **왜 문제인가**: F-12 와 합쳐 보면 비용이 드러난다 — 007 미적용 상태에서
  목록 1회 요청당 Supabase 왕복 **3회** + 에러 로그 1줄이고,
  그것이 방문자 수만큼 그대로 간다(캐시 흡수 0). Vercel 함수 호출·Supabase
  요청 한도에 직접 비례한다.
  그리고 `sitemap.ts:8-9` 의 근거("게시판과 같은 주기")가 기대고 있는 전제가
  목록에 대해서는 성립하지 않는다 — 사이트맵은 상세 URL 목록이므로 결론은
  우연히 맞지만, 적어 둔 이유가 틀렸다.
- **확인 못 한 것**: `next build` 를 돌리지 않았다(지시대로 빌드·dev 서버를
  건드리지 않았다). 확정하려면 `next build` 의 라우트 표에서
  `/review` `/notice` 가 `ƒ (Dynamic)` 로, `/review/[id]` `/notice/[id]` 가
  `● (SSG)` 또는 `ISR` 로 찍히는지 보면 된다. 한 번만 보면 끝난다.
- **조치**: 빌드 표로 확인한 뒤, 사실에 맞게 적는다 —
  목록 두 파일의 주석을 "검색·페이지 파라미터를 읽으므로 이 라우트는 동적이다.
  `revalidate` 는 상세(`[id]`)에만 적용된다" 로 고치고,
  `sitemap.ts:8-9` 의 근거를 "게시판 **상세**가 `revalidate = 300`" 로 고친다.
  목록의 DB 부하를 줄이려면 `unstable_cache`(또는 `cache: "force-cache"` +
  `next: { revalidate: 300 }`)로 **쿼리 단위**로 캐시한다 —
  `q`·`page` 를 키에 넣으면 검색 없는 1페이지(대부분의 트래픽)가 캐시를 탄다.

---

## F-15 [낮음] `view_count` 를 네 쿼리 전부에서 받아 오고 어디에도 쓰지 않는다

- **주장**: `app/(site)/review/[id]/page.tsx:62-67` —
  "조회수는 **공개 화면에 띄우지 않는다.** anon 키는 RLS 로 쓰기가 막혀 있어 조회할 때
  숫자를 올릴 수 없고, 그러면 모든 글이 영구히 '조회 0' 으로 보인다. … **증가 경로가
  생기면 그때 켠다.**" (`notice/[id]/page.tsx:49` 도 같은 주석을 가리킨다.)
  판단 자체는 맞다 — CLAUDE.md 규칙 1("없는 실적을 있는 것처럼 보이지 말 것")과 같은 결이다.
- **실제**: 띄우지 않기로 한 값을 **네 쿼리 전부가 받아 온다.**
  `lib/board-data.ts:136` · `:179` · `:203` · `:217` 의 `BASE` 문자열에
  `view_count` 가 들어 있고, `lib/board.ts:17` · `:33` 이
  `view_count?: number` 로 타입에 남겨 둔다.
  렌더하는 곳은 0곳이다(`grep` 확인: `view_count` 는 위 6곳과 001 스키마에만 나온다).
  타입이 `?`(옵셔널)인 것도 사실과 다르다 — 001:187 · :198 이
  `integer not null default 0` 이라 **항상 온다.** 007 열처럼 없을 수가 없다.
- **왜 문제인가**: 피해는 작다(정수 하나 × 15행). 문제는 **읽는 사람에게 주는 신호**다.
  `SELECT` 목록에 있는 열은 "이 화면이 쓰는 데이터" 로 읽힌다. 다음 사람은
  "조회수를 받아 오는데 왜 안 보여주지?" 를 거쳐야 주석을 찾고,
  반대로 "이미 받아 오니까 띄우면 되겠네" 로 가면 **주석이 막겠다고 한 거짓 표시**
  ("모든 글이 영구히 조회 0")가 바로 만들어진다. 옵셔널 타입은 그 오해를 한 번 더
  돕는다 — 007 열과 같은 모양이라 "적용 안 되면 없는 열" 로 보인다.
- **조치**: `BASE` 네 곳에서 `view_count` 를 지우고, `ReviewRow`/`NoticeRow` 의
  필드도 지운다. 어드민이 조회수를 볼 날이 오면 그 쿼리에서 받으면 된다
  (공개 쿼리와 어드민 쿼리는 이미 분리돼 있다).
  "증가 경로가 생기면 그때 켠다" 는 주석은 **타입에 남겨 두는 것보다 주석으로
  남기는 쪽이** 그 뜻에 맞다.

---

## F-16 [낮음] 정리로 **전부** 날아간 검색어를 조용히 버린다 — 입력했는데 전체 목록이 나온다

- **주장**: `FE/lib/postgrest.ts:10-12` — "**이름에 쉼표나 점이 들어간 검색이 조용히
  엉뚱한 결과를 낸다.** 조용한 오답이 가장 나쁘다."
  `BoardSearch.tsx:28-35` 는 `total` 과 `state` 를 따로 받는 이유까지 적어 가며
  "원인을 두 가지로 설명했다 / 둘 중 하나는 틀린 말이다" 를 피하려 한다.
- **실제**: 정리 결과가 빈 문자열이 되는 입력이 **아무 표시 없이 '검색 안 함' 으로
  취급된다.** `postgrest.ts:41` 이 `, ( ) . " ' : \ *` 를 공백으로 바꾸고 `:45` 가
  `trim()` 하므로, 그 문자만으로 이루어진 검색어는 `""` 가 된다.
  그러면 `board-data.ts:93` `if (!q) return query` 로 필터가 빠지고,
  `review/page.tsx:80` 의 `q === ""` 가 참이 되어 **"전체 N건" 이 다시 나타나고**,
  `BoardSearch.tsx:86` 의 `q !== ""` 가 거짓이 되어 **"검색 — N건" 줄과 "전체 보기"
  링크가 사라지고**, `:72` `defaultValue={q}` 로 **검색창이 비어 버린다.**
- **왜 문제인가**: 재현 — `/review` 에서 `***` 또는 `...` 또는 `,,,` 로 검색한다.
  주소창에는 `?q=***` 가 남아 있는데, 화면은 검색을 한 적이 없는 것처럼 보인다 —
  전체 목록, 빈 검색창, 전체 건수. 사용자는 **엔터가 안 먹었다고 생각하고 다시 누른다.**
  `*` 는 와일드카드 검색을 시도하는 사람이 가장 먼저 쓰는 문자이고
  (`설치*`, `*지연*`), 그 입력이 통째로 사라지면 "이 검색창은 와일드카드를 안 받는다"
  가 아니라 "이 검색창은 고장났다" 로 읽힌다.
  `CRITIQUE_04` F-01 이 어드민 목록에 대해 지적한 것과 같은 고장이다 —
  **입력이 거부됐다는 사실 자체가 화면에 없다.**
- **조치**: `sanitizeQuery` 가 원본이 비어 있지 않았는지를 같이 돌려주게 한다
  (`{ term, dropped: boolean }` — F-01 의 `display`/`pattern` 분리와 같은 반환값에
  얹으면 된다). `BoardSearch` 는 `dropped` 가 참이면
  "검색에 쓸 수 없는 문자만 입력되었습니다 (`, . ( ) * " ' :` 는 제외됩니다)" 를
  `role="status"` 로 띄우고, 검색창에는 **원본**을 되돌려 놓는다
  (지금은 정리된 값을 넣어서 입력이 지워진다 — F-01 과 같은 뿌리다).

---

## F-17 [낮음] 이미지 `src` 를 trim 하지 않는다 — 공백이 섞인 URL 한 개로 상세 페이지가 개발 모드에서 500 이 된다

- **실제**: `FE/components/sections/BoardArticle.tsx:44-46` —

  ```ts
  // null·빈 문자열을 걸러낸다. 빈 `src` 는 브라우저가 현재 페이지를 다시
  // 요청하게 만들어 서버 로그에 유령 요청이 쌓인다.
  const pics = (images ?? []).filter((u): u is string => !!u && u.trim() !== "");
  ```

  `trim()` 으로 **판정은 하는데** `:83` 은 `src={url}`(원본)을 넘긴다.
  `next/image` 는 `src` 가 공백·제어문자로 시작하거나 끝나면 **throw** 한다
  (`node_modules/next/dist/shared/lib/get-img-props.js:352-362`,
  에러 코드 `E176`/`E21`, "cannot start with a space or control character").
- **왜 문제인가**: 재현 — `notices.image_urls` 에
  `'{" https://…/promo.png"}'` 처럼 **앞에 공백 하나가 붙은** URL을 넣고
  `/notice/{id}` 를 연다. 운영자가 Supabase 대시보드나 Storage 화면에서 URL 을
  복사·붙여넣을 때 가장 흔하게 생기는 형태다.
  판정 함수가 `trim()` 을 부른 것은 작성자가 공백을 **생각했다**는 증거인데,
  막는 데만 쓰고 넘기는 값에는 쓰지 않았다.
  다만 그 검증 블록 전체가 `if (process.env.NODE_ENV !== 'production')`
  (`get-img-props.js:274`) 안에 있어서 **운영 빌드에서는 throw 하지 않는다** —
  브라우저가 URL 속성의 앞뒤 공백을 떼므로 이미지도 대체로 뜬다.
  그래서 심각도는 낮다. 그러나 개발·프리뷰에서 상세 페이지가 통째로 500 이 되고,
  원인이 "DB 문자열에 공백 하나" 라서 추적이 길다.
- **조치**: 한 줄이다 — 판정과 사용을 같은 값으로 만든다.

  ```ts
  const pics = (images ?? [])
    .map((u) => (u ?? "").trim())
    .filter((u) => u !== "");
  ```

---

## 결함이 아닌 것 (확인하고 넘김)

- **`42703` 이 맞는 코드다 — 실측 확증.** 라이브 Supabase(`yrqfnj…`)에
  anon 키로 직접 질의했다:

  ```
  GET /rest/v1/reviews?select=id,zz_nope&limit=1
    → 400 {"code":"42703","details":null,"hint":null,"message":"column reviews.zz_nope does not exist"}
  GET /rest/v1/reviews?select=id,admin_reply&limit=1
    → 400 {"code":"42703", … "column reviews.admin_reply does not exist"}
  GET /rest/v1/notices?select=id,image_urls&limit=1
    → 400 {"code":"42703", … "column notices.image_urls does not exist"}
  ```

  `PGRST204`("Column 'x' of relation 'y' does not exist")는 **insert/update 본문**의
  미지 열에 쓰이는 코드로 `select` 경로와 다르다. `board-data.ts:31` 의
  `MISSING_COLUMN = "42703"` 과 `:41` 의 문자열 비교가 정확하다.
  **그리고 007 은 지금 라이브에 적용되어 있지 않다** — 폴백이 현재 동작 중인
  경로다(그 부작용은 F-12).
  덧붙여 `select` 문자열의 **쉼표 뒤 공백도 문제없다**:
  `?select=id,%20title` → `200 []`. postgrest-js 가 인용부호 밖 공백을 제거한다.
- **건수 쿼리를 `selectWithOptional` 로 감싸지 않은 것** — 버그가 아니다.
  `board-data.ts:119-126` · `:162-169` 의 건수 쿼리는 `select("id", {count:"exact", head:true})`
  뿐이고, 필터는 `is_published`(001:186/197) · `title` · `content`(001:180-181/194-195)
  로 전부 001 열이다. 007 열이 닿는 자리가 없어 42703 이 날 수 없다.
  감싸면 코드만 늘어난다.
- **`paginate` clamp 와 실제 `range()` 의 불일치** — 없다.
  `board.ts:84-89` 가 `from`/`to` 를 **clamp 된 `current`** 에서 뽑으므로
  둘이 갈라질 구조가 아니다. 실측 — `paginate(55, 999)` →
  `{pages:4, current:4, from:45, to:59}`. `?page=999` 는 마지막 페이지를 돌려주고
  페이저도 4를 현재로 칠한다. 범위 밖 페이지가 200 으로 응답하는 것 자체는 남지만,
  색인 측면은 범위 밖 커밋 `d28b63f` 가 `robots:{index:false}` + `canonical` 로 닫았다.
- **건수 쿼리와 행 쿼리의 조건 불일치** — 없다. 둘 다 같은 `applySearch`(`:88-98`)와
  같은 `.eq("is_published", true)` 를 거친다. 검색 중 건수가 전체 건수로 새는 경로는 없다.
- **`maybeSingle()` 제거** — 동작이 바뀌지 않는다. `getReview`/`getNotice` 는
  `.eq("id", id)`(`:206` `:220`)이고 `id` 는 serial **primary key**(001:179/193)라
  2행이 맞을 수 없다. 0행은 `rows?.[0] ?? null` → `null` → 호출부 `notFound()` 로
  `maybeSingle()` 때와 같다. `.limit(1)` 이 없는 것도 PK 조회라 무해하다.
- **브랜드 타입을 우회하는 생성 경로** — `BoardQuery.q` 경계까지는 구멍이 없다.
  `as SafeLikeTerm` 캐스트는 `postgrest.ts:36`(빈 문자열)·`:45`(정리 직후) 두 곳뿐,
  `JSON.parse`·`as unknown as`·선언 병합 경로 0건, `tsc --noEmit` 통과.
  경계 **안쪽**의 한계는 F-09.
- **`safeLikeTerm` 이 PostgREST 필터 문법을 깨는가** — 안 깬다.
  남는 문자들을 하나씩 봤다: `*` 는 버려지고(`:41`), `>` `<` 는 PostgREST 연산자가
  아니며(연산자는 `gt`/`lt` 같은 이름), `~` 는 `like`/`ilike` 값에서 의미가 없고,
  `!` 는 **연산자 앞**에서만 부정을 뜻해 값 위치에서는 리터럴이다.
  `,` `(` `)` `.` `:` `"` `'` `\` 는 전부 버려지므로 조건 추가·중첩·다른 열 지시 경로가 없다.
  공백은 `or=(…)` 안의 값으로 안전하다(실측: `?select=id,%20title` 200).
  전각 `，` `％` `＊` 는 PostgREST 가 DSL 문자로 보지 않아 리터럴로만 쓰인다.
  `%`/`_` 이스케이프의 `\` 는 PostgreSQL `LIKE` 의 기본 이스케이프 문자라
  의도대로 리터럴 매칭이 된다. **남은 문제는 보안이 아니라 멱등성(F-01)이다.**
- **제목 위계(SC 1.3.1)** — 네 페이지 전부 정상.
  `/review` `/notice`: `PageHero.tsx:20` h1 1개 → `ReviewList.tsx:31` 카드별 h2 →
  `SectionHeading.tsx:33`(ConsultSection) h2. 건너뜀 없음.
  `NoticeList` 가 제목에 heading 을 안 쓰는 것은 한 줄 목록이라 맞다(`ul`/`li` 가 구조를 준다).
  `/review/[id]` `/notice/[id]`: `BoardArticle.tsx:62` h1 1개 → ConsultSection h2.
  `AdminReply` 와 `BoardNav` 는 heading 을 만들지 않고 `aria-label` 로 이름을 갖는다
  (`aside aria-label="운영자 답변"` `nav aria-label="글 사이 이동"`) — 둘 다
  `aside`/`nav` 는 `aria-label` 이 허용되는 역할이라 `CRITIQUE_04` F-09(generic 위의
  `aria-label`)와 다른 상황이다. `BoardSearch` 는 heading 을 만들지 않는다.
- **`Stars` 의 `role="img"`** — `CRITIQUE_04` F-09 의 조치가 들어가 있다
  (`Stars.tsx:26`, 주석 `:23-25` 까지). `aria-label` 이 적법하고 이름이 보장된다.
  `rating === null || rating <= 0` 이면 아무것도 안 그린다(`:20`) — `?? 5` 재발 없음.
  별 색 `--star #a86700` 은 흰 배경 4.56:1 / 빈 별 3.07:1 로 주장대로다.
- **페이저의 `‹` `›` `…` 와 `aria-current`** — 전부 문제없다.
  `Pagination.tsx:61` `:99` 가 `aria-label="이전 페이지"` / `"다음 페이지"` 를 주므로
  접근 이름이 글리프가 아니다(SC 2.4.4 / 4.1.2 충족). `rel="prev"`/`rel="next"` 도 맞다.
  `…`(`:72`)는 `aria-hidden="true"` 이고 `text-faint #687380` = 흰 배경 **4.82:1** 로
  보이는 쪽에도 1.4.3 을 넘는다.
  `aria-current="page"`(`:78`)는 `<span>` 에 붙지만 `aria-current` 는 **글로벌 속성**이라
  generic 역할에서도 금지되지 않는다(`aria-label` 과 다른 경우다).
  현재 페이지를 링크가 아닌 `span` 으로 두는 것도 맞다 — 자기 자신으로 가는 링크가 없다.
  `size-11` = 44×44 로 SC 2.5.8 충족.
- **포커스 가시성** — `globals.css:412-414` 의 `:focus-visible { outline: 2px solid
  var(--brand-dark); outline-offset: 2px }` 이 전역이라 새 컨트롤 전부에 적용된다.
  `BoardSearch.tsx:80` 의 검색 버튼은 `bg-brand-dark` 라서 "같은 색 링" 을 의심했는데,
  `outline-offset: 2px` 때문에 링이 **버튼 밖**(`PageHero` 의 `bg-white`)에 그려진다 —
  `#0a8230` vs 흰 배경 **4.94:1** 로 SC 2.4.11 통과. 문제없다.
- **새 색 조합 21쌍 — 글자 대비 전부 통과, `--brand` 위 흰 글자 0건.**

  | 조합 | 자리 | 대비 |
  |---|---|---|
  | `text-brand-deep` / `bg-brand-soft` | `AdminReply.tsx:34` | 8.95 ✓ |
  | `text-muted` / `bg-brand-soft` | `AdminReply.tsx:35` | 5.59 ✓ |
  | 본문(`--foreground`) / `bg-brand-soft` | `AdminReply.tsx:39` | 16.79 ✓ |
  | `text-muted` / `bg-surface-muted` | `BoardEmpty.tsx:27` | 5.50 ✓ (`--faint` 였으면 미달 — `globals.css:88` 경고대로 `--muted` 를 썼다) |
  | `text-white` / `bg-brand-dark` | `BoardSearch.tsx:80` · `Pagination.tsx:79` | 4.94 ✓ |
  | `text-white` / `hover:bg-brand-deep` | `BoardSearch.tsx:80` | 9.39 ✓ |
  | `text-brand-deep` / `bg-brand-light` | `NoticeList.tsx:24` · `notice/[id]:42` | 8.31 ✓ |
  | `text-muted` / 흰 배경 | `Pagination.tsx:87` · 날짜·발췌 전부 | 5.87 ✓ |
  | `text-white` / `bg-muted`(미등록 통신사 폴백) | `ReviewList.tsx:26` | 5.87 ✓ |
  | `bg-brand` 눈금(장식, `aria-hidden`) | `PageHero.tsx:26` | 2.88 — **글자를 얹지 않아 해당 없음**, 주석(`:23-25`)이 그 이유까지 적는다 |

  `--brand` 위 흰 글자는 **한 곳도 없다**(`grep` + 조합 검토). CLAUDE.md 표를 지켰다.
- **"초록은 면이 아니라 점"** — 지켜졌다. 새 진초록 **면**은
  검색 버튼 1개(약 70×44)와 현재 페이지 칸 1개(44×44)뿐이고,
  `PageHero`(`:18` `bg-white`) · `BoardArticle`(`:48` `bg-white`) ·
  목록 섹션(`bg-white`) · `ConsultSection`(`:33` `bg-surface-muted`)은 전부 흰 면 또는
  옅은 틴트다. 진초록 풀블리드 0건. `AdminReply` 의 면은 `--brand-soft`(가장 옅은 틴트)로
  규칙 쪽은 맞고, 그 결과가 F-02 다(옅게 가는 건 맞는데 경계를 안 세웠다).
- **본문 XSS** — 없다. `BoardArticle.tsx:93-95` 가 `{content}` 를 그대로 렌더해
  React 가 이스케이프하고, `whitespace-pre-wrap` 으로 줄바꿈만 살린다.
  `dangerouslySetInnerHTML` 은 저장소 전체에서 `Faq.tsx:89` 한 곳뿐이고
  정적 JSON-LD + `.replace(/</g, "\\u003c")` 로 안전하다. 검사 자체의 한계는 F-06.
- **미리보기 산출물의 격리** — `CRITIQUE_04` F-15 조치가 들어가 있다.
  `preview-board.mjs:25` 가 `public/_preview/board.html` 로 쓰고,
  `FE/.gitignore:47` 이 `/public/_preview/`(디렉터리 단위 — 파일명 열거가 아니다),
  `package.json:10` 의 `"prebuild": "rm -rf public/_preview"` 가 지우고,
  `app/robots.ts:29` 가 `/_preview/` 를 수집에서 막는다. 네 겹이다.
  임시 번들도 PID 로 구분되고 `try/finally`(`:138-140`)로 반드시 지운다.
  **가짜 데이터를 DB 에 넣지 않는다**(`:13-14` 선언 + 코드 확인) — CLAUDE.md 규칙 1 준수.
- **`BoardEmpty` 의 `unconfigured` / `error` 분기** — 맞다.
  `board-data.ts:114` 가 키 없음을 `unconfigured` 로, `:127-130` 이 조회 실패를
  `error` 로 **구분해서** 돌려주고, `BoardSearch.tsx:28-37` 이 그 둘을 `total` 과
  따로 받는 이유를 적어 뒀다. `LiveFeed` 의 `DataPolicy` 와 같은 원칙이고
  "조회에 성공했을 때만 숫자를 쓴다"(`review/page.tsx:80` `state === "ok"`)도 지켜진다.
  빠진 축은 "검색 결과 없음" 하나다(F-03).
- **`ReviewList` 카드 링크의 접근 이름이 길다** — 결함은 아니다.
  `<a>` 가 뱃지+제목+별 라벨+발췌+날짜를 감싸므로 이름이
  "KT 설치까지 이틀 걸렸습니다 5점 만점에 5점 … 26. 10. 01." 처럼 길어진다.
  SC 2.4.4 는 충족하고(목적이 분명하다), `<a>` 안의 `<h2>`(`:31`)도 적법하다
  (`a` 는 transparent content). 상세(`BoardArticle`)에서는 별이 링크 밖이라
  두 화면의 낭독이 다르지만, 어느 쪽도 위반이 아니다.
- **`excerpt` 를 메타 설명으로 쓰는 것** — `review/[id]/page.tsx:30` ·
  `notice/[id]/page.tsx:23` 의 `excerpt(content, 80)`. `CRITIQUE_04` F-07 이 지적한
  "플레이스홀더 `tagline` 을 검색 스니펫으로 승격" 과는 다르다 — 여기 들어가는 것은
  운영자가 쓴 실제 글의 발췌이고, 우월성 서술을 코드가 만들어 붙이지 않는다.
- **`Pagination` 의 번호 창 계산** — 정확하다. `:44-47` 이 `{1, pages} ∪ [current-2, current+2]`
  를 범위 내로 추려 정렬하고, `:71` 이 `n - nums[i-1] > 1` 일 때만 `…` 를 넣는다.
  `pages=7, current=2` → `[1,2,3,4,7]` + 4·7 사이 생략 1개. `pages=1` 은 `:35` 에서
  렌더 자체를 멈춘다. `href(n)`(`:37-43`)이 `n === 1` 에 `page` 를 안 붙이는 것도
  정본 주소(목록 첫 페이지)와 일치한다.
- **`BoardNav` 가 한쪽 글이 없을 때 줄을 지우지 않는 것** — 의도대로 맞다
  (`BoardNav.tsx:12-14`, `:42-46`). "이전글/다음글" 의 세로 위치가 글마다 바뀌지 않는다.
- **`Image` 의 `height={0}`** — `next/image` 는 `isNaN(height)` 만 막으므로
  (`get-img-props.js:345`) 0 은 통과한다. `w-full h-auto`(`BoardArticle.tsx:89`)와 함께
  쓰는 알려진 패턴이고, 세로로 긴 상세페이지 컷을 `object-cover` 로 자르지 않겠다는
  `:78-80` 의 이유도 타당하다. (대신 `width/height` 로 종횡비를 못 주므로 로드 시
  리플로가 생긴다 — 비율을 모르는 외부 이미지라 피할 수 없다.)
- **`reviews.carrier` 에 CHECK 가 없다** — 결함으로 세지 않는다.
  001:185 가 `varchar(20)` 뿐이라 `"kt"` 같은 오타가 들어오면
  `ReviewList.tsx:26` 이 `bg-muted` 폴백(흰 글자 5.87:1 — 대비는 통과)에
  `:28` 이 **원문을 그대로** 띄운다. 다만 `reviews` 에 쓰는 주체가
  운영자(단일 계정) 하나이고 작성 화면 자체가 아직 없어, 지금 단계에서
  스키마 제약을 요구하기엔 이르다. 작성 UI 를 만들 때 `carrier` 를
  `check (carrier is null or carrier in ('KT','SK','LG','SKYLIFE'))` 로 묶으면 끝난다.
- **게시판에 작성 경로가 없다** — 범위 판단.
  `app/(admin)/admin/` 에는 `leads` · `login` · `enroll-2fa` 뿐이고 글·답글을
  쓰는 화면이 없다. CLAUDE.md 진행상태가 이번에 게시판을 `[x]` 로 올렸지만
  어드민 작성 화면은 별도 항목이라 "미완" 이지 "결함" 은 아니다.
  다만 007 주석 `:33` 의 "애플리케이션 코드에 맡기면 **어드민 UI 를 고칠 때마다
  깨진다**" 와 `AdminReply.tsx:23-25` 의 "그 제약이 적용되기 전에 들어간 행이
  있을 수 있어" 는 **존재하지 않는 UI 와 존재하지 않는 기존 행**을 전제한다.
  제약을 거는 판단은 옳으니 이유만 "운영자가 SQL 로 직접 넣으므로" 로 고치면 된다.
- **`.env.local` 자격증명** — 범위 밖이지만, PostgREST 응답 확인에 anon 키를
  읽기 전용 GET 으로만 썼다. 키 값은 이 문서에 남기지 않았고
  service_role 키는 건드리지 않았다.

---

# 실행 순서

치명 0건. 높음 2건.

1. **F-02** `AdminReply.tsx:31` `border-brand-light` → `border-brand-dark`.
   한 단어로 패널 경계가 1.08 → 4.71~4.94:1 이 된다. 면은 그대로 둬서
   "초록은 점" 과 색면 비율을 건드리지 않는다.
   그리고 `contrast-audit` 에 **면/테두리 대비** 열을 추가한다 —
   글자만 재는 한 "대비 위반 0" 은 이 결함에 대해 영원히 참이다.
2. **F-01** `FE/lib/postgrest.ts` 의 반환값을 `display` / `pattern` 으로 쪼개고
   페이저·검색창·결과 문구는 `display` 를, `applySearch` 는 `pattern` 을 쓴다.
   `verify-goals.mjs` 에 `safeLikeTerm∘safeLikeTerm === safeLikeTerm` 를 넣는다.
   같은 수정이 F-16(정리로 다 날아간 검색어)의 기반도 만든다.

그다음 묶음(중간) —
**F-12**(목록에서 안 쓰는 007 열 제거 — 지금 라이브에서 매 요청 왕복 3회)
→ **F-05 · F-04**(정렬 타이브레이커와 이전/다음글을 **같은 전순서**로. 둘은 한 작업이다)
→ **F-03**(검색 0건 문구)
→ **F-06 · F-07 · F-08**(G0 검사 3종. 지금은 셋 다 틀린 이유로 통과할 수 있다)
→ **F-10**(뱃지 컴포넌트화 — 안 하면 `b9cddf9` 의 거짓 측정이 그대로 돌아온다)
→ **F-11**(`image_alts` 또는 최소한 `content` 공백 제약)
→ **F-09**(보증 범위를 `.or()` 입구까지, 또는 주석을 사실대로).

낮음은 F-13 · F-17 이 각각 한 줄 수정이라 위 묶음에 끼워 넣으면 된다.
