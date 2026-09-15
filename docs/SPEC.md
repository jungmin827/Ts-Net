# 기능 명세

## 1. 공개 사이트

### 1.1 메인 랜딩 (`/`)

위에서부터 순서대로:

1. **헤더** — 로고, 통신사 4개 메뉴, 후기게시판, 정보공유, 대표번호(클릭 시 `tel:`)
2. **히어로** — 프로모션 헤드라인, 서브카피, CTA 버튼. 배경 이미지는 교체 가능하게
3. **인라인 상담폼** — 이름 / 연락처 / 개인정보 동의(필수) / 마케팅 동의(선택)
4. **실시간 신청현황** — 날짜·통신사 아이콘·`김**`·진행상태·사은품상태, 최근 20건.
   세로 롤링 애니메이션. 5건 미만이면 섹션 미출력
5. **차별점 4카드** — 아이콘 + 제목 + 3줄 설명 (레퍼런스 이미지1 레이아웃)
6. **가입절차 5스텝** — 원형 아이콘 + 화살표 연결 (레퍼런스 이미지2 레이아웃).
   모바일에서는 세로 스택으로 전환
7. **후기 슬라이더** — 썸네일·제목·별점·본문 발췌·날짜, "후기 보러가기" 링크
8. **푸터** — 상호, 대표자, 사업자등록번호, 부가통신사업 신고번호,
   통신판매업 신고번호, 주소, 대표번호, 이용약관·개인정보처리방침 모달 링크
9. **플로팅 퀵상담 폼** (데스크톱 우하단) — 관심상품 선택 + 이름 + 연락처 + 동의
10. **모바일 하단 고정바** — 전화걸기 / 상담신청 2분할

### 1.2 통신사 서브페이지 (`/[carrier]`)

`carrier` = `kt` | `sk` | `lg` | `skylife`

- 통신사 전용 히어로 (브랜드 컬러 적용)
- `plans` 테이블에서 해당 통신사 요금제 표 렌더링
  (상품명 / 속도 / 월요금 / 약정 / 현금 사은품)
- 제휴카드 할인 안내 + 상세 모달
- 하단 상담폼 (해당 통신사가 `carrier` 기본값으로 프리셋)

### 1.3 게시판

- `/review` — 카드 그리드, 페이지네이션. `/review/[id]` 상세
- `/notice` — 리스트형, 고정글 상단. `/notice/[id]` 상세
- 둘 다 `is_published = true`만 노출. 작성은 어드민에서만

### 1.4 약관 모달

이용약관 / 개인정보처리방침. 콘텐츠는 `content/terms.mdx`, `content/privacy.mdx`로
분리해서 법무 검토 후 교체가 쉽도록 한다.

---

## 2. 접수 파이프라인 (`POST /api/leads`)

처리 순서 — 하나라도 실패하면 즉시 중단:

```
1. honeypot 필드가 비어있는지 확인        → 채워져 있으면 200 반환하고 조용히 폐기
2. Cloudflare Turnstile 토큰 검증         → 실패 시 400
3. zod 검증
     name    : 한글/영문 2~20자
     phone   : 010으로 시작하는 10~11자리 (하이픈 제거 후 정규화)
     product : 허용 목록 내
     consent_privacy : true 필수
4. Rate limit: 동일 IP 10분 내 3건 초과 시 429
5. phone_hash 생성 → 당일 중복이면 409 (UI에는 "이미 접수되었습니다" 안내)
6. phone_enc 생성, phone_masked 생성
7. UTM·referrer·landing_path·IP·UA 수집하여 INSERT
8. 성공 응답 → 프론트에서 전환 이벤트 발화 (GA4 / 네이버 / 메타 / 카카오)
```

**알림 발송 단계는 없다.** 운영자가 어드민에서 확인한다.

### 전화번호 처리

```ts
normalize(phone)  // "010-1234-5678" → "01012345678"
phone_hash   = sha256(normalized + PHONE_PEPPER)
phone_enc    = aes256gcm(normalized, ENCRYPTION_KEY)   // iv + tag 포함
phone_masked = "010-****-5678"
```

---

## 3. 어드민 (`/admin`)

### 3.1 인증

- Supabase Auth 이메일 + OTP. 계정 1개
- 미들웨어에서 `/admin/*` 전부 가드, `admin_users.is_active` 확인
- 로그인 성공·실패 모두 `access_logs`에 기록

### 3.2 DB 목록 (`/admin/leads`)

**필터**: 기간(프리셋: 오늘/7일/30일/직접입력), 통신사, 상태, 사은품상태,
유입경로(utm_source), 내보내기 여부, 이름·번호뒷자리 검색

**테이블 컬럼**: 접수일시 / 이름 / 연락처(마스킹) / 통신사 / 관심상품 /
유입경로 / 상태 / 사은품 / 내보냄

- 기본 정렬: 접수일시 내림차순
- 페이지네이션 50건 단위
- 목록 조회 시 `access_logs`에 `LIST` + 필터조건 기록

### 3.3 상세 (`/admin/leads/[id]`)

- **"번호 보기" 버튼을 눌러야 복호화**된다. 목록에서는 절대 평문 노출 금지
- 복호화 시 `access_logs`에 `DECRYPT` 기록
- 상태·사은품상태 변경, 메모 작성 (변경은 `lead_logs`에 자동 기록)
- 하단에 변경 이력 타임라인

### 3.4 엑셀 내보내기

`GET /admin/api/leads/export?from=&to=&carrier=&status=&exported=`

- 현재 화면 필터를 그대로 적용
- `exceljs`로 서버 생성. 파일명 `leads_YYYYMMDD_HHmm.xlsx`
- **시트 구성**: 통신사별로 시트 분리 (`KT` / `SK` / `LG` / `SKYLIFE` / `전체`).
  상담사 배분이 통신사 단위로 이뤄지므로
- **전화번호는 복호화한 평문으로 내보낸다** (상담 목적). 이 행위는 반드시
  `access_logs`에 `EXPORT` + 건수 + 필터조건 기록
- 내보낸 행의 `exported_at`을 갱신 → 목록에서 "내보냄" 배지로 구분
- 중복 배분 방지를 위해 "미내보내기 건만" 필터를 기본 제공

### 3.5 콘텐츠 관리

- `/admin/plans` — 요금제 CRUD, 정렬, 활성화 토글
- `/admin/reviews` — 후기 CRUD, 게시 승인, 이미지 업로드(Supabase Storage)
- `/admin/notices` — 공지 CRUD, 고정 토글

### 3.6 대시보드 (`/admin`)

오늘/이번주/이번달 접수 건수, 상태별 분포, **유입경로별 건수**.
마지막 항목이 광고비 판단 근거이므로 눈에 띄게 배치.

---

## 4. 환경변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # 서버 전용, 절대 클라이언트 노출 금지

ENCRYPTION_KEY=                     # 32바이트 hex. 분실 시 기존 DB 복구 불가
PHONE_PEPPER=                       # 해시용 솔트. 변경 시 중복검사 이력 리셋됨

TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_KAKAO_PIXEL_ID=
NEXT_PUBLIC_NAVER_ID=

NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_TEL=                    # 대표번호
```

---

## 5. 런칭 전 체크리스트

**법적**
- [ ] 푸터 사업자 정보 6종 표기 완료
- [ ] 개인정보 동의 / 마케팅 동의 체크박스 분리 확인
- [ ] 수집항목·목적·보유기간 동의 화면 명시
- [ ] 개인정보처리방침에 보호책임자 실명·연락처 기재
- [ ] 광고 문구의 근거자료 보유 확인
- [ ] `pg_cron` 파기 배치 동작 확인

**보안**
- [ ] `SUPABASE_SERVICE_ROLE_KEY`가 클라이언트 번들에 없는지 확인
- [ ] RLS 정책 실제 동작 테스트 (anon으로 SELECT 시도 → 차단 확인)
- [ ] 어드민 2FA 활성화, 백업코드 별도 보관
- [ ] `ENCRYPTION_KEY` / `PHONE_PEPPER` 오프라인 백업
- [ ] Cloudflare WAF + Rate limit 규칙 적용

**기능**
- [ ] 폼 3종 모두 접수 → DB 반영 확인
- [ ] 중복 접수 차단 동작 확인
- [ ] 엑셀 내보내기 → 통신사별 시트 분리 확인
- [ ] 실시간 현황이 실제 데이터만 표시하는지 확인
- [ ] 모바일 하단바 / `tel:` 링크 동작

**마케팅**
- [ ] GA4·네이버·메타·카카오 전환 이벤트 발화 확인
- [ ] UTM 파라미터가 `leads`에 저장되는지 확인
- [ ] 서치어드바이저·서치콘솔 소유확인, sitemap 제출
- [ ] OG 이미지, 메타 태그
- [ ] Lighthouse 모바일 성능 80점 이상
