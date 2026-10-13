# BE — Supabase 백엔드

## 현재 상태 (2026-09-15)

| 항목 | 값 |
|---|---|
| 프로젝트 ref | `yrqfnjiynyenxrjxruot` (Seoul, ap-northeast-2) |
| 대시보드 | https://supabase.com/dashboard/project/yrqfnjiynyenxrjxruot |
| 마이그레이션 | `001_init_schema.sql` 적용 완료 — 테이블 7종·RLS·정책 12개·live_feed 뷰·함수 5종 검증됨 |
| 적용 방식 | `supabase db push --db-url` (세션 풀러 `aws-0-ap-northeast-2.pooler.supabase.com:5432`) |
| DB 비밀번호 | 로컬 `~/.tsnet/db-password` (chmod 600) — 저장소·DB에 절대 기록 금지 |

**주의**: 현재 CLI 액세스 토큰이 프로젝트 소유 계정과 달라 `supabase link`는 불가.
마이그레이션은 위 `--db-url` 방식으로 적용한다. 소유 계정으로 `supabase login`을
다시 하면 link 기반 관리로 전환 가능.

**남은 대시보드 작업** (아래 절차 5~8번):
- [x] **pg_cron 활성화 + 파기 스케줄 등록 (2026-10-13 완료)**
      `purge-leads` 매일 18:00 UTC(03:00 KST) · `purge-logs` 18:30 UTC(03:30 KST),
      둘 다 `active`. 등록 당시 **지울 대상이 0건**임을 먼저 확인했다
      (leads 최단 `purge_at` 2028-10-07 / access_logs 최고령 6일, 보존 1년).
      스케줄이 처음 도는 새벽에 터지지 않는지 `purge_expired_leads()` 를
      한 번 호출해 확인했다 — 0건 반환, `access_logs` 에 `DELETE rows=0` 기록.
      확인: `select jobid, jobname, schedule, active from cron.job;`
- [x] 어드민 계정 생성 + `admin_users` INSERT (OWNER/active) — 로그인 실측 완료
  - [ ] **2FA(TOTP) 등록** — 지금은 `ADMIN_SKIP_2FA=1` 개발 분기로 우회 중.
        배포 전 등록 + 변수 제거 (어드민은 단일 계정 1개 + 2FA 가 확정사항)
- [ ] `review-images` Storage 버킷
- [x] anon / service_role 키를 `FE/.env.local`에 기입
      (URL·ENCRYPTION_KEY·PHONE_PEPPER·Turnstile 테스트 키는 세팅됨)
  - [ ] **service_role 키 교체** — 채팅에 평문으로 오갔다. 레거시 JWT 라 JWT
        secret 을 돌리면 anon 키도 함께 바뀌므로 `.env.local` 두 값을 같이 갱신

이 프로젝트의 백엔드는 Supabase(PostgreSQL + Auth + Storage)다.
별도 API 서버는 없고, 서버 로직은 `FE/app/api/*` Route Handler가 담당한다.
이 폴더는 **DB 스키마·마이그레이션·Supabase 설정**의 단일 출처다.

## 구조

```
BE/
  supabase/
    migrations/
      001_init_schema.sql   초기 스키마 (leads, admin_users, access_logs, plans, reviews, notices, RLS, 파기 배치)
```

## 초기 설정 절차

1. **CLI 설치** (현재 이 머신에 미설치)
   ```sh
   brew install supabase/tap/supabase
   ```
2. **Supabase 프로젝트 생성** — 대시보드에서 생성. 리전은 반드시 **Seoul (ap-northeast-2)**
3. **로컬 초기화 및 연결** (이 폴더에서)
   ```sh
   cd BE
   supabase init          # supabase/config.toml 생성 (migrations 폴더는 이미 있음)
   supabase link --project-ref <PROJECT_REF>
   ```
4. **마이그레이션 적용**
   ```sh
   supabase db push
   ```
5. **pg_cron 활성화** — 대시보드 Database → Extensions에서 `pg_cron` 켠 뒤 SQL Editor에서:
   ```sql
   select cron.schedule('purge-leads', '0 18 * * *', $$select purge_expired_leads()$$);
   -- 18:00 UTC = 03:00 KST. 보유기간 만료 leads 자동 파기
   select cron.schedule('purge-logs', '30 18 * * *', $$select purge_old_access_logs()$$);
   -- access_logs 보존기간 경과분
   ```
   등록 후 확인 — 이 쿼리가 행을 돌려주지 않으면 **스케줄이 없는 것**이다:
   ```sql
   select jobid, jobname, schedule, command from cron.job;
   ```
6. **어드민 계정 생성** — Auth에서 이메일 계정 1개 생성(2FA 활성화) 후:
   ```sql
   insert into admin_users (id, email, role)
   values ('<auth.users의 uuid>', '<이메일>', 'OWNER');
   ```
7. **Storage 버킷** — 후기 이미지용 `review-images` 버킷 생성 (public read)
8. **키 전달** — Project URL / anon key / service_role key를 `FE/.env.local`에 기입
   (`FE/.env.example` 참고. service_role key는 절대 클라이언트 노출 금지)

## 규칙

- 스키마 변경은 반드시 새 마이그레이션 파일(`NNN_설명.sql`)로 추가한다. 기존 파일 수정 금지
- `ENCRYPTION_KEY` / `PHONE_PEPPER`는 DB에 넣지 않는다 — FE 환경변수 전용
- 가짜 접수(leads) 데이터를 시딩하지 않는다 — 표시광고법 위반 소지 (CLAUDE.md 규칙 1)
