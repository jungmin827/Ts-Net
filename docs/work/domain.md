# 도메인 연결 — 후이즈 구매 → Cloudflare DNS → Vercel

## 현황 (10-24)
- **`tsnet.io.kr` 구매 완료** (후이즈, 만료 2027-10-24). `io.kr` 은 KISA 공식 2단계 → Cloudflare 존으로 추가 가능
- DNSSEC 미서명. **네임서버 변경 신청 완료(10-24)** → `cris` / `priscilla.ns.cloudflare.com`. KISA WHOIS 반영됨, DNS 응답은 반영 대기
- Cloudflare 존 추가 완료(Free, 계정 yootaewhan1212). DNS 레코드 0개 — Vercel 단계에서 추가
- Vercel 미연결 · 10-14 개편 69개 파일 미커밋(푸시 전 배포하면 옛 디자인이 올라간다)
- `NEXT_PUBLIC_SITE_URL` 비어 있음 → robots 전체 차단·sitemap 빈 상태(의도된 안전 상태)
- 막는 것: Turnstile 테스트 키 · 사업자정보 TODO · TOTP 미등록 · `vercel.json` 없음(함수가 미국 iad1 에서 돈다)

## 결정할 것
- **Cloudflare 프록시(주황 구름) 여부** — Vercel 공식 권장은 *DNS only*. 프록시 시 Vercel 방화벽·봇차단이 약해지고 지연이 붙는다
  - DNS only 로 가면 `lib/client-ip.ts` 가 `cf-connecting-ip` 를 먼저 믿는 순서를 바꿔야 한다(위조 가능)
- 정본 주소: `https://도메인` (www 는 308 리다이렉트) 권장
- Vercel 요금제: 상업 사이트라 Hobby 불가 → Pro

## 체크리스트
1. [x] 후이즈 구매 — 자동연장 ON, 부가서비스 체크 해제, 명의 = 사업자정보와 동일
2. [x] Cloudflare Free 에 사이트 추가 → 네임서버 2개 받기
3. [~] 후이즈 네임서버 변경 — 신청 완료, Cloudflare "Active" 대기
4. [ ] 프록시 여부 결정 → 코드(`client-ip.ts`)·CLAUDE.md 반영
5. [ ] Vercel Pro · GitHub 연결 · Root `FE` · 함수 리전 `icn1` · 환경변수 입력
6. [ ] Vercel Domains 에 apex + www 추가 → 표시된 레코드를 Cloudflare 에 입력 → 인증서 Valid
7. [ ] `NEXT_PUBLIC_SITE_URL` 기입 후 **재배포** (그 전에 사업자정보·보호책임자 채우기)
8. [ ] Turnstile 실키 발급(hostname 2개) → 테스트 키 교체
9. [ ] Supabase Site URL · TOTP 등록 · `ADMIN_SKIP_2FA` 제거
10. [ ] 메일 라우팅(보호책임자 주소) · 서치콘솔 · 네이버 서치어드바이저 · 최종 확인

## 작업 보고
- (미착수)
