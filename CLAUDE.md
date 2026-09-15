# 프로젝트 컨텍스트

## 무엇을 만드는가

국내 통신(인터넷·IPTV) 가입 인바운드 **DB수집 랜딩 사이트**.
방문자가 프로모션 문구를 보고 이름·연락처를 남기면, 운영자가 어드민에서 확인하고
엑셀로 내보내 상담사들에게 배분한다. 사이트 자체가 계약을 처리하지는 않는다.

레퍼런스: `인터넷다모아`(PHP 기반), `탐나넷`. 구조와 기능 범위를 따른다.

## 확정된 의사결정

| 항목 | 결정 |
|---|---|
| 프론트 | Next.js 15 App Router + TypeScript + Tailwind CSS |
| DB/인증/스토리지 | Supabase (PostgreSQL), **Seoul 리전** |
| 배포 | Vercel |
| DNS/보안 | Cloudflare (WAF, Rate limit, Bot Fight) |
| 봇방지 | Cloudflare Turnstile + honeypot 필드 |
| 어드민 | **단일 계정 1개 + 2FA**. 상담사 계정 없음 |
| 상담사 배분 | 어드민이 **엑셀 내보내기** → 오프라인 전달 |
| 접수 알림 | **없음**. 알림톡·SMS·Slack 전부 미사용. 어드민에서만 확인 |
| 취급 통신사 | KT / SK / LG / KT스카이라이프 |

`assignee_id`, 실시간 폴링, 알림 연동은 **의도적으로 제외**했다. 다시 넣지 말 것.

## 절대 어기면 안 되는 것

1. **실시간 신청현황은 실제 `leads` 데이터만 마스킹해서 노출한다.**
   가짜 접수 데이터를 생성·시딩하는 코드를 짜지 않는다. 표시광고법 위반 소지.
   건수가 5건 미만이면 섹션 자체를 렌더링하지 않는다.
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

- [x] 요구사항 확정, 기술 스택 결정
- [x] DB 스키마 작성 (`BE/supabase/migrations/001_init_schema.sql`)
- [ ] Supabase 프로젝트 생성 및 마이그레이션 적용 (`BE/README.md` 절차 참고)
- [x] Next.js 스캐폴딩 + 디자인 토큰 (주조색·통신사 컬러는 임시값 — 브랜드 확정 시 `FE/app/globals.css`만 교체)
- [x] lib 기반 모듈 (crypto / validation / supabase 클라이언트 3종 / audit)
- [ ] 메인 랜딩 퍼블리싱
- [ ] `/api/leads` 접수 파이프라인
- [ ] 어드민 (목록·필터·상세·상태변경·엑셀)
- [ ] 통신사 서브페이지 4종
- [ ] 후기·공지 게시판
- [ ] SEO·트래킹·도메인 연결
