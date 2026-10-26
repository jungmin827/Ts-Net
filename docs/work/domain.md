# 도메인·배포 — tsnet.io.kr

## 현황 (10-25) — **운영 오픈 완료**
- https://tsnet.io.kr · Vercel Pro(팀 yootaewhan1212-1064 / 프로젝트 `ts-net`) · 리전 icn1 · `main` 푸시 = 자동 배포
- 도메인: 후이즈(만료 2027-10-24) → 네임서버 Cloudflare(`cris`/`priscilla`, 계정 yootaewhan1212)
- 인증서: Let's Encrypt, Vercel 자동 갱신. www → 308 → apex
- 검색: robots·sitemap 공개. Google Search Console(도메인 속성, 소유자: qkrwjdals8827 · yootaewhan1212) · 네이버 서치어드바이저 소유확인·사이트맵 제출
- 메일: `privacy@tsnet.io.kr` → 대표 Gmail (Cloudflare Email Routing, 수신 확인). 처리방침 보호책임자 주소

## 구성 기록 (바꿀 때 같이 볼 것)
| 자리 | 값 |
|---|---|
| Cloudflare DNS | `A @ 216.150.1.1` · `CNAME www → a8a1ac82d9ce2630.vercel-dns-016.com` (둘 다 **DNS only**) · MX 3 · SPF · DKIM · `TXT google-site-verification` |
| Vercel env (Production) | Supabase 3 · `ENCRYPTION_KEY` · `PHONE_PEPPER` · Turnstile 2(실키) · `NEXT_PUBLIC_SITE_URL` · `NEXT_PUBLIC_TEL` · `NAVER_SITE_VERIFICATION` |
| 넣지 않는 것 | `ADMIN_SKIP_2FA`, 트래킹 픽셀 ID(동의 절차 결정 전) |
| 코드 | `client-ip.ts` 는 `cf-connecting-ip` 를 믿지 않는다(DNS only 전제). 프록시(주황 구름)로 바꾸면 다시 정할 것 |

- ⚠ `.env.local` 은 배포되지 않는다 — 운영 값은 Vercel 에 따로 넣는다
- ⚠ 운영에서 테스트 접수를 하면 **즉시 SPAM 으로** — 6건이 되자 실시간 현황 게이트(5건)를 넘어 테스트 행이 4분간 노출됐다
- ⚠ TXT `google-site-verification` 을 지우면 서치콘솔 인증이 풀린다

## 체크리스트 — 전부 완료
1. [x] 후이즈 구매 · 2. [x] Cloudflare 존 · 3. [x] 네임서버 이전 · 4. [x] DNS only 결정·코드 반영(bf84be4)
5. [x] Vercel 프로젝트·env · 6. [x] 도메인·인증서 · 7. [x] 사업자정보 → 검색 공개
8. [x] Turnstile 실키 · 9. [x] 운영 TOTP(verified) · 10. [x] 서치콘솔·네이버·메일 라우팅

## 작업 보고
- 10-26 상호 검색 대응: 모든 페이지 제목 `태산-Net` 하나(사용자 결정) · 설명·OG 에 `태산-Net(TS-Net)`, 홈 JSON-LD(WebSite·Organization, alternateName TS-Net·태산넷·태산 Net), OG 이미지 = 메인 포스터. 화면 표기는 그대로 TS-Net (`SITE.searchName`)
  - 남은 것(운영자): 구글 URL 검사 → 색인 요청 · 네이버 웹 페이지 수집 요청 · 네이버 스마트플레이스 · Google 비즈니스 프로필
- 10-25 네이버 사이트맵 제출(운영자, 확장 정책상 수동) · Search Console 에 대표 계정 소유자 추가
- 10-25 Google 사이트맵 "성공" 확인 · `ENCRYPTION_KEY`·`PHONE_PEPPER` 오프라인 백업 완료(운영자 보관)
- 10-25 운영 E2E 실측: 접수 → 목록 → 상세(VIEW) → 번호 보기(DECRYPT). 서버 화면 3곳 접속기록 IP 누락 수정(9ad708b)
- 10-25 보호책임자 이메일 오타 수정 → `privacy@tsnet.io.kr` 전환, 처리방침 시행일 10-25
- 10-25 첫 배포는 프로젝트 생성 화면 오류로 빌드가 안 돌아 Create Deployment(main)로 수동 실행
