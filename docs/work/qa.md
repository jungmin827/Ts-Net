# QA — 정적·런타임·네트워크

## 현황 (10-14)
- `tsc --noEmit` 0 · `eslint` 0 · `next build` 성공(33페이지) · `verify-goals` 코드 35/35 · 라이브 4/4
- 브라우저 워크스루: `/` `/kt` `/sk` `/lg` `/skylife` `/review` `/notice` `/review/write` 콘솔 오류 0, 404 정상
- 방식: 네트워크 에이전트 1 + 리팩토링 검증 에이전트 1 (각자 맡은 파일만 수정)

## 발견 / 조치
| # | 구분 | 내용 | 조치 |
|---|---|---|---|
| 1 | 네트워크 | 폼 fetch 시간 제한 없음 → 모바일에서 "접수 중…" 무한 | 25초 중단 + 안내 (`useLeadSubmit`, `ReviewForm`) |
| 2 | 네트워크 | 200+HTML(와이파이 로그인 페이지)을 접수 성공으로 처리 | `data.ok === true` 일 때만 성공 |
| 3 | 런타임 | 연타 시 1회용 토큰 재사용 → 실패 응답이 완료 화면을 덮음 | ref 잠금 |
| 4 | 네트워크 | Turnstile 스크립트 차단 시 출구 없음 (폼 3종) | `onError`·`onUnsupported`·스크립트 실패 감지 → 안내 |
| 5 | 네트워크 | Turnstile 검증·Supabase 호출 시간 제한 없음 | 5초 / 8초 (`lib/turnstile.ts`, `lib/supabase/fetch-timeout.ts`, middleware) |
| 6 | 네트워크 | API 본문 크기·형식 무제한, 캐시 지시 없음 | 415/413, POST·복호화 응답 `no-store` (`lib/http.ts`) |
| 7 | 네트워크 | `/api/feed/live` 오류 응답도 60초 캐시 | 성공·5건 미만만 캐시 |
| 8 | 네트워크 | LiveFeed 조회 시간 제한 없음 | 10초 + `!r.ok` 처리 |
| 9 | 네트워크 | 쓰지 않는 Jua 폰트를 매 페이지 로드 | 제거 |
| 10 | 런타임 | `/review/write` 에서 헤더·푸터·하단바 "상담 신청" 무반응(`#consult` 없음) | `ConsultAnchorFallback` → `/#consult` 이동 (실측 확인) |
| 11 | UX | 빈 폼 제출 시 이름보다 "동의하세요"가 먼저 나옴 | 이름·연락처를 먼저 검사 (`checkNamePhone`, 서버와 같은 규칙) |
| 12 | 정적 | 삭제 섹션의 잔재: `getCarrierPriceComparison`, 막대 애니메이션 CSS, Reveal | 삭제 |
| — | 오탐 | `fonts.googleapis.com` 요청 | 브라우저 확장이 주입. 서버 HTML 에는 없음 |
| — | 미재현 | 착수 직후 dev 오버레이 "1 Issue" | 새로고침 후 소멸, 이후 재현 안 됨 |

## ⚠ 운영자 조치 필요
- **`.env.local` 의 `TURNSTILE_SECRET_KEY` 가 항상 통과하는 테스트 키**다. 이 상태로는 봇 차단이 없다. 배포 전 실제 키로 교체
- 위 사실을 확인하는 과정에서 검증 요청 1건이 실 DB `reviews` 에 **비공개 행**으로 들어갔다
  (제목 `테스트제목`, `is_published=false`). `/admin/reviews` 에서 삭제 필요
