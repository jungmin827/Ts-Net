# 도메인 연결 — 후이즈 구매 → Cloudflare DNS → Vercel

## 현황 (10-25)
- **`tsnet.io.kr` 구매 완료** (후이즈, 만료 2027-10-24). `io.kr` 은 KISA 공식 2단계 → Cloudflare 존으로 추가 가능
- **네임서버 Cloudflare 로 이전 완료(10-25)** — `cris` / `priscilla.ns.cloudflare.com`. KISA·1.1.1.1·8.8.8.8·KT DNS 모두 확인, Cloudflare 존 Active
- Cloudflare 존 추가 완료(Free, 계정 yootaewhan1212). DNS 레코드 0개 — Vercel 단계에서 추가
- **사이트 공개됨 — https://tsnet.io.kr (10-25)**. Vercel Pro 팀 yootaewhan1212-1064 / 프로젝트 `ts-net`, 리전 icn1, Let's Encrypt 인증서(~2027-01-22). www → 308 → apex
- Cloudflare DNS: `A @ 216.150.1.1` · `CNAME www a8a1ac82d9ce2630.vercel-dns-016.com` (둘 다 DNS only)
- 사업자 정보 채움(0ac18f6) → Vercel 에 `NEXT_PUBLIC_SITE_URL=https://tsnet.io.kr` · `NEXT_PUBLIC_TEL` 추가(Production, Config) → **검색 수집 공개**
- **운영 E2E 확인(10-25)**: 접수 → 목록 → 상세(VIEW) → 번호 보기(DECRYPT, IP 기록) 전 구간 실측
- QA 접수 6건(1·3·4·5·7·8)은 `SPAM` 처리 — 6건이 되면서 실시간 현황 5건 게이트를 넘어 테스트 행이 노출될 뻔했다(규칙 1). 테스트 접수 후에는 반드시 SPAM 으로 돌릴 것
- 남은 것: 메일 라우팅 · 서치콘솔/네이버 등록

## 결정 (10-25)
- 정본 `https://tsnet.io.kr` · www 는 308 리다이렉트
- Cloudflare **DNS 전용**(회색 구름). `client-ip.ts` 에서 `cf-connecting-ip` 신뢰 제거
- Vercel 함수 리전 서울 — `FE/vercel.json` `regions: ["icn1"]` (Pro 전용)
- 검색엔진 인증: `GOOGLE_SITE_VERIFICATION` · `NAVER_SITE_VERIFICATION` 환경변수 → 메타 태그
- Vercel 요금제: 상업 사이트라 Hobby 불가 → Pro

## 체크리스트
1. [x] 후이즈 구매 — 자동연장 ON, 부가서비스 체크 해제, 명의 = 사업자정보와 동일
2. [x] Cloudflare Free 에 사이트 추가 → 네임서버 2개 받기
3. [x] 후이즈 네임서버 변경 → Cloudflare Active (10-25)
4. [x] DNS 전용 결정 → `client-ip.ts`·`vercel.json`·인증 태그·CLAUDE.md 반영 (bf84be4)
5. [x] Vercel Pro · GitHub(jungmin827/Ts-Net) 연결 · Root `FE` · 리전 `icn1` · 환경변수 7개 (10-25)
6. [x] Domains apex + www(308) → Cloudflare 레코드 2개 → 인증서 발급 (10-25)
7. [x] 사업자정보·보호책임자 → `NEXT_PUBLIC_SITE_URL` · `NEXT_PUBLIC_TEL` (Vercel 에 따로 넣어야 한다 — `.env.local` 은 배포되지 않는다) → 재배포 (10-25)
8. [x] Turnstile 실키("TS-Net 상담 폼") → Vercel 환경변수 반영 (10-25)
9. [x] 운영 TOTP 등록 완료(10-25, verified) · `ADMIN_SKIP_2FA` 는 운영 환경변수에 없음. (Supabase Site URL 은 비밀번호 로그인이라 영향 없음 — 선택)
10. [ ] 메일 라우팅(보호책임자 주소) · 서치콘솔 · 네이버 서치어드바이저 · 최종 확인

## 작업 보고
- 10-25 Vercel 첫 배포(bf84be4) + 도메인 연결. 프로젝트 생성 화면 오류로 첫 빌드가 안 돌아 Create Deployment(main)로 수동 실행
- 10-25 Cloudflare 등록 완료. 남은 Cloudflare 일: 계정 이메일 인증, (Vercel 후) 레코드 추가, Turnstile 실키, Email Routing. DNSSEC 는 선택(켜면 후이즈에 DS 등록 필요)
