# 프로젝트 컨텍스트

## 무엇을 만드는가

국내 통신(인터넷·IPTV) 가입 인바운드 **DB수집 랜딩 사이트**.
방문자가 프로모션 문구를 보고 이름·연락처를 남기면, 운영자가 어드민에서 확인하고
엑셀로 내보내 상담사들에게 배분한다. 사이트 자체가 계약을 처리하지는 않는다.

레퍼런스: `인터넷다모아`(https://www.xn--t60bv5ao1noylqucs0u.com/), `탐나넷`(https://www.tamnanet.com/).
구조와 기능 범위를 따른다. 구조 분석·시안은 `docs/DESIGN.md` 참고.

디자인 확정사항:
- **본문은 오프화이트 + 블랙, 초록은 로고와 상단 메뉴바에만.** (2026-10-14 사용자 결정)
  `:root` 토큰이 `--background #fafaf8` · `--brand #141414`(이름은 brand 지만 검정)이고,
  헤더·모바일 메뉴에 붙은 `.brand-scope` 만 `--brand #07b040` 등 초록을 되살린다.
  주 CTA(`.cta-fill`)는 본문에서 검정 면 + 흰 글자, 헤더에서 초록 면 + 진한 글자
  (`--cta-ink` 가 갈라준다). 초록 면 위 흰 글자 금지(2.88:1)는 헤더 안에서 여전히 유효.
  네이버 그린(146°)과는 색상각을 벌려 둔다(우리 140°).
  (이전의 "쨍한 그린 CTA·초록 포인트" 규칙과 색면 비율 실측은 이 결정으로 폐기)
- **통신사색은 쓰지 않는다.** 헤더 띠·배지·카드 띠 전부 없앴고 토큰도 지웠다.
  통신사는 글자와 테두리 배지(`CarrierBadge`)로만 구분한다. 오류 표시의 빨강만 예외.
- **메인은 레퍼런스(인터넷다모아) 밀도로 둔다.** 히어로(메인 포스터 + 폼) · 포스터 3장
  (통신사 — 상담폼 배경 · 상담 방식 · 가입 절차) · 후기 · 실시간 현황(5건 이상일 때만) · 푸터. 요금표·계산기는 통신사 상세에만.
  포스터는 운영자 제작 이미지(2026-10-25)로, 경로·alt 는 `SITE.hero.poster` 와 `PROMO_IMAGES` 에만 있다.
  포스터 안의 초록은 위 "초록은 헤더만" 규칙의 예외다 — 규칙은 코드로 그리는 UI 에 적용된다.
  섹션을 더하려면 하나를 빼고 더할 것. 현황·계획은 `docs/work/` (도메인별 짧은 문서)
- **카피는 상담원 말투.** "~드릴게요/~요" 체, 선언문·설명문 금지. 문구는 `lib/site-config.ts`
- **첫 화면은 메인 포스터, 상담폼은 두 번째(통신사) 포스터 위 오른쪽에 반투명 카드로 얹는다.**
  (2026-10-25 사용자 결정 — 이전의 "히어로가 곧 퍼스트뷰 상담폼" 2단 배치를 대체)
  포스터 4장은 모두 16:9 계열이고 같은 폭(페이지 컨테이너 1120px)에 깔린다. 폼 카드 높이는
  통신사 포스터 높이(553px)에 실측으로 맞춰 두었다(`LeadForm` 의 `dense`).
  모바일은 겹치지 않고 포스터 → 폼으로 쌓는다. `#consult` 앵커는 폼 블록이 갖는다.
  포스터 제목은 sr-only h1, 나머지 문구는 alt. 통신사는 폼 안의 칩 라디오로 고른다.
  하단 고정 상담바는 `#consult` 가 화면에 보이는 동안 내려간다(같은 폼 두 개 방지).
- **주 CTA 는 비활성으로 두지 않는다.** 동의 미체크 상태에서도 버튼은 살아 있고,
  누르면 무엇이 빠졌는지 말해준다. 회색으로 죽은 CTA 는 페이지 전체를 미완성으로 읽히게 한다.
- **브랜드 표기는 `TS-Net`** (영문). 로고 워드마크와 본문 표기를 일치시킨다.
- **로고는 팔레트를 따른다.** 원본(`docs/TS-Net 로고.jpg`)은 보관용이고, 웹에 쓰는
  `FE/public/logo.png` 는 여백 트림 + 흰 배경 투명화 + 잉크를 `--brand`/`--brand-deep`
  으로 치환한 변형본이다. 로고 색에 맞춰 주조색을 바꾸지 않는다. (2026-09-29)
- **브랜드 에셋은 손으로 만들지 않는다.** 워드마크와 아이콘 세트(`app/icon.png`,
  `app/apple-icon.png`, `app/favicon.ico`)는 전부 `FE/scripts/build-brand-assets.mjs`
  가 원본 한 장에서 생성한다. 로고를 교체하면 `SOURCE` 만 바꿔 다시 돌리고,
  출력된 크기를 `SITE.logo` 의 width/height 에 반영한다.
  파비콘은 초록 타일 위 흰 `TS` — 16px 에서 읽히려면 워드마크 전체는 쓸 수 없다(가로 2.3:1).
- **홍보 이미지에는 대체 텍스트를 짝지어 넣는다.** `notices.image_alts` 가
  `image_urls` 와 **길이가 같아야** 통과한다(009 제약). 빈 문자열은 "이 한 장은
  장식" 이라는 선택이고, 그 선택을 운영자가 장마다 한다. 이 게시판은 홍보
  이미지 채널로 쓰이므로 — 정보의 본체가 이미지에 있는 것이 정상 운용이므로 —
  일괄 `alt=""` 는 거의 항상 거짓 선언이 된다 (WCAG 1.1.1 / H67).
- **퍼블리싱 카피·홍보 템플릿은 운영자가 직접 제작해 제공 예정.**
  그전까지 `FE/lib/site-config.ts`의 중립 플레이스홀더 유지, 수신 시 해당 파일만 교체.

## 확정된 의사결정

| 항목 | 결정 |
|---|---|
| 프론트 | Next.js 15 App Router + TypeScript + Tailwind CSS |
| DB/인증/스토리지 | Supabase (PostgreSQL), **Seoul 리전** |
| 배포 | Vercel |
| DNS/보안 | Cloudflare **DNS 전용**(회색 구름, Vercel 권장) · 방화벽은 Vercel · 접수 레이트리밋은 DB 함수(006). 도메인 `tsnet.io.kr` (2026-10-25) |
| 봇방지 | Cloudflare Turnstile + honeypot 필드 |
| 어드민 | **OWNER 계정 2개 + 계정별 2FA** (2026-10-26 사용자 결정 — yoyotaewhan@gmail.com 추가). 상담사 계정 없음 |
| 상담사 배분 | 어드민이 **엑셀 내보내기** → 오프라인 전달 |
| 접수 알림 | **없음**. 알림톡·SMS·Slack 전부 미사용. 어드민에서만 확인 |
| 취급 통신사 | KT / SK / LG / KT스카이라이프 |

`assignee_id`, 실시간 폴링, 알림 연동은 **의도적으로 제외**했다. 다시 넣지 말 것.

## 절대 어기면 안 되는 것

1. **실시간 신청현황은 실제 `leads` 데이터만 마스킹해서 노출한다.**
   가짜 접수 데이터를 생성·시딩하는 코드를 짜지 않는다. 표시광고법 위반 소지.
   건수가 5건 미만이면 **접수 내역을 한 건도 렌더링하지 않는다.**
   지금은 섹션 자체를 그리지 않는다(자리를 미리 잡지 않으므로 공백도 없다).
   건수·금액·가상 내역을 암시하는 어떤 표현도 쓰지 않는다.
   "아직 쌓이지 않았다" 같은 **단정은 건수를 실제로 확인했을 때만** 쓴다 —
   로딩 중이거나 조회가 실패한 상태에서 그 말을 하면 거짓이 된다.
   (2026-10-14 — 10-08 에 둔 안내 블록(`DataPolicy`, 700px)은 메인 축소로 지웠다.
    취지는 "없는 실적을 있는 것처럼 보이지 말 것"이고, 그리지 않는 것도 그 취지에 맞는다.)
   **같은 원칙이 `reviews` 에도 적용된다.** 후기는 방문자가 제출한 글만
   게시한다 — 운영자가 쓴 글을 "가입 후기" 로 내보내면 소비자가 제3자 경험으로
   읽는 자리에 사업자의 자기 서술이 들어가 같은 위반이 된다.
   제출 경로는 `/review/write` 하나이고, 승인 전 글은 RLS 가 가린다
   (`BE/.../008`, 근거: `docs/REVIEW_AUTHORSHIP.md`).
2. **개인정보 동의와 마케팅 수신 동의는 체크박스를 분리한다.** 묶으면 위법.
3. **전화번호는 평문으로 저장·로깅하지 않는다.** `phone_enc`(AES-256-GCM) +
   `phone_hash`(SHA-256) + `phone_masked` 3종으로만 다룬다.
   복호화는 어드민 상세조회 시점에만, 그리고 반드시 `access_logs`에 기록한다.
4. **`ENCRYPTION_KEY`와 `PHONE_PEPPER`는 DB에 넣지 않는다.** 환경변수 전용.
5. **레퍼런스 사이트의 문구·이미지·CSS를 복제하지 않는다.**
   기능 구조는 업계 공통 패턴이라 무방하지만, 카피와 디자인 에셋은 직접 제작분을 쓴다.
6. 과장 광고 문구(보상률·최대 지원금 등)는 하드코딩하지 말고 설정값으로 뺀다.
   운영자가 근거에 맞춰 수정할 수 있어야 한다.

## 디렉터리 규약

루트는 `FE/`(Next.js 앱)와 `BE/`(Supabase)로 나뉜다. 별도 API 서버는 없다 —
서버 로직은 전부 FE의 Route Handler, 데이터·인증·스토리지는 Supabase.

```
FE/                    Next.js 15 앱 (package name: tsnet-fe)
  app/
    (site)/            공개 페이지 — 정적 생성 우선
      page.tsx         메인 랜딩
      [carrier]/       KT / SK / LG / SKYLIFE 서브페이지
      review/          후기 목록·상세
      notice/          정보공유
    (admin)/admin/     어드민 — 전부 서버 컴포넌트, 인증 가드
    api/
      leads/route.ts   접수 엔드포인트
      feed/live/route.ts 실시간 현황 (60초 캐시)
  components/
    sections/          랜딩 섹션 단위 (Hero, Benefits, Process, Reviews ...)
    forms/             LeadForm, QuickForm, MobileBottomBar
    ui/                버튼·인풋 등 프리미티브
  lib/
    supabase/          client.ts, server.ts, admin.ts
    crypto.ts          전화번호 암·복호화, 해시
    validation.ts      zod 스키마
    audit.ts           access_logs 기록 헬퍼
  content/             terms.mdx, privacy.mdx (약관)
  .env.example         환경변수 목록 — 실제 값은 .env.local
BE/
  supabase/migrations/ DB 스키마 단일 출처. 변경은 새 파일 추가로만
  README.md            Supabase 프로젝트 생성·연결 절차
docs/SPEC.md           기능 명세 — 작업 전 반드시 읽을 것
```

## 코딩 규칙

- 폼 제출은 Server Action이 아니라 **Route Handler**(`/api/leads`)로 받는다.
  Turnstile 검증·rate limit·감사로그를 한 곳에 모으기 위함.
- 모든 입력은 `zod`로 검증한다. 클라이언트 검증만 믿지 않는다.
- 어드민 페이지는 기본 서버 컴포넌트. `use client`는 필터·테이블 상호작용에만.
- 랜딩은 SSG, 게시판은 `revalidate = 300`.
- 한국어 UI. 날짜·시간은 전부 `Asia/Seoul` 기준으로 표시한다.

## 현재 진행 상태

> **2026-10-25 운영 오픈 — https://tsnet.io.kr** (Vercel Pro · icn1 · Cloudflare DNS only).
> 배포·도메인·DNS·환경변수 구성은 **`docs/work/domain.md`** 한 장에 있다.
> 10-14 개편(디자인 축소·카피·QA) 현황은 **`docs/work/`** 의 design·copy·qa 세 문서.
> 그 이전 기록의 한 장 요약은 **`docs/작업진행상황(10-07).md`** — 여섯 목표의 상태, 검증
> 명령과 그 출력, 내가 만든 결함 11건, 지금 열려 있는 것(비평 15건 +
> 운영자 작업 10건)을 근거와 함께 적어 두었다. 아래 체크리스트보다 상세하다.


- [x] 요구사항 확정, 기술 스택 결정
- [x] DB 스키마 작성 (`BE/supabase/migrations/001_init_schema.sql`)
- [x] Supabase 프로젝트 생성 및 마이그레이션 적용 — Seoul 리전, ref `yrqfnjiynyenxrjxruot`
  **001~009 전부 적용 완료 (2026-10-13)** + 요금 시드 72행.
  ⚠ 마이그레이션 이력(`supabase_migrations`)은 실제 스키마와 어긋나 있었다 —
  002 적용 직후 `list_fee` 가 이미 채워져 있었다(002 에는 백필이 없다). 누군가
  대시보드에서 직접 SQL 을 돌린 것이다. **이력을 상태의 근거로 믿지 말고
  실제 동작으로 확인할 것.**
  - [x] 어드민 계정 + 키를 `FE/.env.local` 에 기입 — 로그인·목록·필터 실측,
    `access_logs` 에 `LOGIN`/`LIST` 기록 확인 (`row_count` 가 실제 행 수와 일치)
  - [x] **`pg_cron` 활성화 + 파기 스케줄 (2026-10-13)** — `purge-leads` 03:00 KST ·
    `purge-logs` 03:30 KST. 그전까지 `purge_expired_leads()` ·
    `purge_old_access_logs()` 는 **존재하지만 호출자가 없었다** — 보존기간이
    지난 개인정보가 스스로 지워지지 않는 상태였다. 함수가 있다는 것과 파기가
    일어나는 것은 다르다. 확인은 `select * from cron.job;` (행이 없으면 없는 것)
  - [ ] Storage 버킷 (`BE/README.md` 6번) — 007 의 `notices.image_urls` 가 가리킬 곳
- [x] Next.js 스캐폴딩 + 디자인 토큰 (주조색·통신사 컬러는 임시값 — 브랜드 확정 시 `FE/app/globals.css`만 교체)
- [x] lib 기반 모듈 (crypto / validation / supabase 클라이언트 3종 / audit)
- [x] 메인 랜딩 퍼블리싱 1차 — 섹션(Hero·LiveFeed·Benefits·Process·Reviews·Footer)
  + 폼 3종(인라인·플로팅 퀵상담·모바일 하단바). 카피·사업자정보는 `FE/lib/site-config.ts`
  - 잔여: 실제 카피·사업자 정보 (약관·처리방침 전문은 `lib/site-config.ts` 에 작성 완료)
- [x] `/api/leads` 접수 파이프라인 + `/api/feed/live` (60초 캐시, 5건 미만 빈 배열)
  - **운영 E2E 완료(10-25)** — 실 Turnstile 키로 접수 → 어드민 확인.
    QA 접수 6건(1·3·4·5·7·8)은 전부 `SPAM`. 실 고객 접수는 아직 0건.
    ⚠ 운영에서 테스트 접수를 하면 즉시 `SPAM` 으로 — 실시간 현황 게이트(5건)를 넘기면
    테스트 행이 "실시간 신청"으로 노출된다(규칙 1, 10-25 에 4분간 실제로 일어났다)
- [x] 어드민 — 로그인(2FA/TOTP)·목록·필터·상세·상태변경·메모·**기간 지정 엑셀 내보내기**
  (`app/(admin)/admin/*`, `app/api/admin/export/route.ts`). 전화번호 복호화는
  상세에서 버튼으로만, `access_logs` 기록 후. 검증은 `scripts/verify-export.mjs`
  — 기간 프리셋·잘못된 입력 거부·KST→UTC 경계·xlsx 생성까지 본다.
  - **운영 TOTP 등록 완료(10-25, verified)**. `ADMIN_SKIP_2FA` 는 로컬 `.env.local`
    에만 있고 운영 env 에는 없다(있어도 `NODE_ENV=production` 이면 무시된다).
  - 번호 복호화: **운영에서 사람이 눌러 확인(10-25)** — `access_logs` 에 VIEW·DECRYPT 기록.
    서버 화면 3곳(대시보드·목록·상세)이 접속기록에 IP 를 안 남기던 것을 고쳤다(9ad708b).
  - [ ] **엑셀 내보내기는 아직 사람이 눌러 본 적이 없다** — `access_logs` 의 `EXPORT` 0건.
    눌렀는지는 서버 로그가 아니라 `access_logs` 로 판단할 것
- [x] 통신사 서브페이지 4종 (`/kt` `/sk` `/lg` `/skylife`) — SSG, 미등록 slug는 404
  + 메인 통신사 4카드 허브. 요금제는 `plans` 테이블 기반, 미등록 시 상담 유도로 대체
  - 요금제 데이터 입력 완료 — `plans` 72행
    (KT 17 · SK 21 · LG 17 · SKYLIFE 17 / BUNDLE 41 · INTERNET 13 · TV 9 · MOBILE 9).
    구 시드 50행에는 `INTERNET`·`TV` 분류가 **아예 없어** 단독 상품을 고를 수 없었다.
    교체 전 50행은 `BE/supabase/backup/plans_before_seed_20261013-140333.json`
- [x] 후기·정보공유 게시판 (`/review` `/notice` + 각 상세) — 목록·검색·번호
  페이지네이션·이전글/다음글·운영자 답글·본문 이미지.
  anon key + RLS `*_public_read` 만 사용. 본문은 평문 렌더(저장형 XSS 차단).
  - **정렬 정의는 `lib/board-data.ts` 의 `applyListOrder` 한 곳뿐이다.**
    `(is_pinned desc) → created_at desc → id desc`. `id` 를 빼면 같은 시각의
    행이 둘 있을 때 페이지 경계에서 글이 중복되거나 사라진다 — 화면으로는
    안 보이는 고장이다. 목록·이전글·프리렌더가 전부 이 함수를 지난다
    (`verify-board.mjs` 가 구간 쿼리 수 = 호출 수 로 못 박는다)
  - **캐시**: 목록은 `searchParams` 를 읽어 **동적 라우트**다 — `revalidate`
    가 지킬 HTML 캐시가 없다(빌드 표 `ƒ`). 그래서 `unstable_cache` 로
    **쿼리 단위** 캐시를 둔다(키: `page`·`q`·`field`). 상세는
    `generateStaticParams` 로 `●` SSG + 5분 재생성.
    **실패는 캐시하지 않는다** — 던져서 캐시를 건너뛰고 바깥에서 `state` 로
    되돌린다. 1초 흔들린 DB 로 5분짜리 장애를 만들지 않기 위함이다
  - 007 적용 완료 — 운영자 답글·본문 이미지가 동작한다 (미적용이던 동안은
    **그 두 기능만 조용히 빠지고 있었다**)
- [x] **후기는 방문자가 쓴다** (`/review/write` → `/api/reviews` → 비공개 접수
  → 어드민 `/admin/reviews` 에서 승인). 008 적용 완료.
  적용 전에는 방문자 작성 경로가 없어 화면에 뜰 수 있는 후기가 전부 운영자가
  쓴 글이었다 — 표시광고 리스크다. 근거와 결정: `docs/REVIEW_AUTHORSHIP.md`
  - 연락처·비밀번호를 **받지 않는다.** 이름은 선택이고 **가린 형태(`박*민`)만**
    받는다 — 브라우저가 가려서 보내고 서버가 한 번 더 가린다(`lib/mask-name.ts`, 10-26).
    원래 이름을 저장하지 않으므로 유출될 것도, 개인정보 동의를 받을 대상도 없다
  - **사진 최대 3장 (010, 10-26 적용)** — 무료 플랜 · public 버킷 하나(`review-images`).
    브라우저가 1600px/720px WebP(Safari 는 JPEG)로 줄여 보내고 EXIF 위치정보는 그때 떨어진다.
    승인 전 사진은 **주소를 아무도 모르는 것**으로만 가려진다 — 경로는 서버가 무작위로
    정하고 응답에 싣지 않으며, anon 에게 storage 정책이 하나도 없다. 경로를 밖에 돌려주는
    코드를 넣지 말 것. **운영자는 승인만 누른다**(011, 10-26 사용자 결정) — 사진 설명은
    선택이고, 없으면 자동 문구("작성자가 올린 사진 1/3")가 대체 텍스트가 된다(`alt=""` 금지).
    규칙의 단일 출처는 `lib/review-images.ts`
- [~] SEO — `sitemap.xml` / `robots.txt` / 페이지별 canonical / OG 완료.
  정본 주소는 `NEXT_PUBLIC_SITE_URL` 하나로 결정된다(`lib/site-url.ts`).
  **비어 있거나 운영 빌드에서 로컬 주소면 robots 가 전체 수집을 막고
  sitemap 을 비운다** — 틀린 canonical 은 없는 canonical 보다 나쁘다.
  검색·2페이지 이후 목록은 `noindex, follow` + canonical 을 목록 첫 페이지로.
  - [x] `NEXT_PUBLIC_SITE_URL=https://tsnet.io.kr` (Vercel Production) → 색인 공개(10-25).
    Google Search Console(도메인 속성, TXT 인증) · 네이버 서치어드바이저(메타 태그) 등록·사이트맵 제출
  - [ ] 트래킹: `.env.example` 에 GA/Meta/Kakao/Naver 자리는 있으나 **미연결**.
    픽셀은 쿠키를 심으므로 동의 절차와 처리방침 고지를 같이 정해야 한다 —
    운영자 결정 사항으로 남긴다. 결정 없이 넣으면 동의 없는 수집이 된다.
