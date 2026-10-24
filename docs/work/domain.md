# 도메인 연결 — 후이즈 구매 → Cloudflare DNS → Vercel

## 현황 (10-25)
- **`tsnet.io.kr` 구매 완료** (후이즈, 만료 2027-10-24). `io.kr` 은 KISA 공식 2단계 → Cloudflare 존으로 추가 가능
- **네임서버 Cloudflare 로 이전 완료(10-25)** — `cris` / `priscilla.ns.cloudflare.com`. KISA·1.1.1.1·8.8.8.8·KT DNS 모두 확인, Cloudflare 존 Active
- Cloudflare 존 추가 완료(Free, 계정 yootaewhan1212). DNS 레코드 0개 — Vercel 단계에서 추가
- Vercel 미연결. 10-14 개편분은 푸시 완료(074fd09)
- `NEXT_PUBLIC_SITE_URL` 비어 있음 → robots 전체 차단·sitemap 빈 상태(의도된 안전 상태)
- 막는 것: Turnstile 테스트 키 · 사업자정보 TODO · TOTP 미등록

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
4. [x] DNS 전용 결정 → `client-ip.ts`·`vercel.json`·인증 태그·CLAUDE.md 반영 (커밋 대기)
5. [ ] Vercel Pro · GitHub 연결 · Root `FE` · 함수 리전 `icn1` · 환경변수 입력
6. [ ] Vercel Domains 에 apex + www 추가 → 표시된 레코드를 Cloudflare 에 입력 → 인증서 Valid
7. [ ] `NEXT_PUBLIC_SITE_URL` 기입 후 **재배포** (그 전에 사업자정보·보호책임자 채우기)
8. [ ] Turnstile 실키 발급(hostname 2개) → 테스트 키 교체
9. [ ] Supabase Site URL · TOTP 등록 · `ADMIN_SKIP_2FA` 제거
10. [ ] 메일 라우팅(보호책임자 주소) · 서치콘솔 · 네이버 서치어드바이저 · 최종 확인

## 작업 보고
- 10-25 Cloudflare 등록 완료. 남은 Cloudflare 일: 계정 이메일 인증, (Vercel 후) 레코드 추가, Turnstile 실키, Email Routing. DNSSEC 는 선택(켜면 후이즈에 DS 등록 필요)
