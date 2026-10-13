# DB 적용 절차 (운영자용)

> ## ✅ 1~2 는 2026-10-13 에 실행 완료 (커밋 `888f7f7`)
>
> 마이그레이션 **001~008** + 요금 시드 **72행** 적용. 라이브 검사 4개 전부 통과.
> **표가 003~008 만 적고 있었지만 실제로는 002 도 미적용이었다.**
> 그 과정에서 `supabase_migrations` 이력과 실제 스키마가 어긋난 것을 확인했다 —
> 002 적용 직후 `list_fee` 가 이미 채워져 있었다(002 에 백필은 없다).
> **이력을 상태의 근거로 삼지 말 것.** 상세: `docs/작업진행상황(10-07).md`
>
> **남은 것: 3번(QA 행 정리) · 4번 중 TOTP 등록 · 5번 · 6번.**
> 여기에 문서에 없던 항목 하나가 추가됐다 — **`pg_cron` 이 설치돼 있지 않아
> 파기 함수에 호출자가 없다** (`BE/README.md` 5번).

아래 절차는 재실행·검증용으로 남겨 둔다. 멱등하게 쓰여 있어 다시 돌려도 안전하다.

> **⚠ 적용 전 반드시 확인 — 프로젝트 ref**
>
> 이 레포의 `BE/supabase/.temp/linked-project.json` 이 **다른 계정의 프로젝트**
> (`gckdznguozyjeydqczwh`, "yootaewhan1212@gmail.com's Project")를 가리키고 있었다.
> 2026-10-08 에 비켜뒀다. 아래 절차로 **올바른 프로젝트에 다시 링크한 뒤** 진행할 것.
>
> 올바른 ref: **`yrqfnjiynyenxrjxruot`** (`FE/.env.local` · `CLAUDE.md` 기준)
>
> 링크를 확인하지 않고 `supabase db push` 를 돌리면 **남의 데이터베이스를 건드린다.**

---

## 0. 링크 확인

```bash
cd BE
supabase login                       # 액세스 토큰 입력
supabase link --project-ref yrqfnjiynyenxrjxruot
cat supabase/.temp/linked-project.json   # ref 가 yrqfnjiynyenxrjxruot 인지 눈으로 확인
```

## 1. 마이그레이션

**번호가 곧 실행 순서다.** `supabase db push` 는 파일명 순으로 적용하므로,
보안 차단이 반드시 먼저 가도록 번호를 정렬해 뒀다 (2026-10-08 재배열).

| 순서 | 파일 | 하는 일 |
|---|---|---|
| 003 | `003_lock_down_functions.sql` | 공개 anon 키로 호출 가능하던 **파기 함수 권한 회수** + `live_feed` 에 5건 게이트 |
| 004 | `004_purge_at_by_status.sql` | 보유기간을 고지(개통 D+1095 / 단순상담 D+14)에 맞춤 — **앞으로 들어올 행만** |
| 005 | `005_lead_logs_insert_policy.sql` | 변경 이력에 수정 주체(actor_id) 기록 |
| 006 | `006_lead_rate_count.sql` | 접수 레이트리밋 함수 (`lead_rate_exceeded`) |
| 007 | `007_board_reply_and_images.sql` | 게시판 — 후기 **운영자 답글** 1건, 정보공유 **본문 이미지** 배열 |
| 008 | `008_review_public_submit.sql` | 후기 **방문자 제출** 경로 (anon INSERT, `is_published=false` 강제) + 길이 제약 + 폭증 상한 함수 |

**003 이 004 보다 먼저여야 하는 이유**: 004 는 미개통 접수의 파기 예정일을 D+14 로
당긴다. 삭제 구멍(003 이 막는 것)이 열린 상태에서 파기 대상만 넓어지면 피해가 커진다.
처음에는 이 둘의 번호가 반대였고 "수동으로 먼저 실행하라"고 문서에 적었는데,
**문서로 경고할 일이 아니라 번호로 강제할 일**이라 재배열했다.

```bash
cd BE
supabase db push
```

> **기존 행의 파기 예정일은 이 단계에서 바뀌지 않는다.**
> 004 는 트리거만 건다. 이미 보관 중인 행까지 맞추는 백필은
> `BE/supabase/manual/004b_backfill_purge_at.sql` 로 떼어 놓았다 —
> `db push` 대상이 아니고, 그 파일의 STEP 1(읽기 전용)로 **무엇이 얼마나
> 당겨지는지 먼저 세어 본 뒤에** 직접 실행한다.
> `pg_cron` 이 켜진 상태에서 백필하면 그 날짜에 실제로 삭제되고
> 전화번호 암호문까지 함께 사라진다. 되돌릴 수 없다.

> **007 을 빼먹어도 게시판은 죽지 않는다 — 하지만 조용히 기능이 빠진다.**
> `admin_reply` / `image_urls` 열이 없으면 PostgREST 가 `42703` 을 내는데,
> 그대로 두면 목록 전체가 "불러오지 못했습니다" 가 된다. 답글 하나 때문에
> 게시판이 통째로 죽는 건 과한 대가라, `lib/board-data.ts` 가 그 오류를
> 받으면 **해당 열만 빼고 다시 조회하고 서버 로그에 파일명을 찍는다.**
> 화면은 정상이고 답글·본문 이미지만 안 보인다. 즉 **증상이 없으므로**
> 운영자가 "다 됐다" 고 판단할 수 있다 — 적용 후 로그에서
> `007_board_reply_and_images.sql 가 적용되지 않았습니다` 가 없는지 확인할 것.

> **008 은 "후기를 누가 쓸 수 있는가" 를 바꾼다.** 적용 전에는 방문자가 후기를
> 남길 경로가 없어, `/review` 에 뜰 수 있는 글이 전부 운영자가 쓴 글이었다 —
> 소비자가 제3자 경험으로 읽는 자리에 사업자의 자기 서술이 들어가면
> 표시광고법상 거짓·과장 광고 소지가 있다 (`docs/REVIEW_AUTHORSHIP.md`).
> 008 은 anon INSERT 를 열지만 `is_published = false` 인 행만 통과시키고
> anon 에게 UPDATE·DELETE 를 주지 않는다. 제출자가 자기 글을 게시 상태로
> 바꿀 경로가 없다. 승인은 어드민 `/admin/reviews` 에서만.
>
> 008 미적용 상태에서 방문자가 후기를 쓰려 하면 RLS 가 INSERT 를 거부하고
> 서버 로그에 `008_review_public_submit.sql 미적용 가능` 이 찍힌다.
> 화면에는 "등록에 실패했습니다" 만 보이므로, 로그를 확인할 것.

### 적용 후 검증

```sql
-- 파기 함수가 익명에게 닫혔는가 (0행이어야 정상)
select p.proname, a.rolname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(p.proacl) ac
join pg_roles a on a.oid = ac.grantee
where n.nspname = 'public'
  and p.proname in ('purge_expired_leads','purge_old_access_logs')
  and a.rolname in ('anon','authenticated','public');

-- 보유기간이 상태별로 갈리는가
select status, count(*), min(purge_at), max(purge_at) from leads group by status;

-- 레이트리밋 함수가 있는가 (정수 1개를 돌려주면 정상)
select lead_rate_exceeded('127.0.0.1'::inet);  -- false 면 정상
```

외부에서도 확인한다 — **둘 다 404/401 이어야 한다**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "$SUPABASE_URL/rest/v1/rpc/purge_expired_leads" -H "apikey: $ANON_KEY"
```

## 2. 요금 시드 재적용

라이브 DB 는 **폐기된 구 시드(50행)** 이고, 그중 12행의 `description` 에 레퍼런스
사이트의 마케팅 카피가 남아 있다 (CLAUDE.md 규칙 5 위반). 신규 시드는 72행이고
그 필드가 전부 비어 있다.

```bash
psql "$DB_URL" -f supabase/seed/plans_damoa_2026-10-08.sql
```

### 적용 후

```sql
select count(*) from plans;                                  -- 72 여야 한다
select count(*) from plans where description is not null;    -- 9 (사실 정보만)
```

그 다음 **`FE/lib/plans.ts` 의 `SUPPRESS_PLAN_DESCRIPTION` 을 `false` 로 되돌린다.**
이 스위치는 구 시드의 레퍼런스 카피가 화면·RSC 페이로드에 실리는 것을 막는 임시 조치였다.

## 3. QA 행 정리

파이프라인 검증 중 실제 `leads` 에 3건이 들어갔다. `live_feed` 뷰가 공개 조회 가능하므로
`003_lock_down_functions` 적용 전까지는 외부에 보인다 (5건 게이트가 그 파일에 있다).

| 이름 | 마스킹 번호 |
|---|---|
| 테스트 | 010-****-5678 |
| 검증 | 010-****-8888 |
| 김검증 | 010-****-3333 |

어드민 상세에서 눈으로 확인한 뒤 지우거나, 상태를 `SPAM` 으로 바꾼다
(`live_feed` 가 SPAM 을 제외한다).

**앞으로의 규약**: QA 접수는 넣은 직후 `status = 'SPAM'` 으로 바꾼다.

## 4. 어드민 사용 준비

1. `FE/.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 기입
   (Dashboard → Settings → API). 어드민의 감사로그 기록이 이 키로 이뤄진다.
2. Supabase Auth 에 어드민 사용자 생성
3. `admin_users` 에 행 추가 — `is_active = true`, `role = 'OWNER'`
4. `/admin/login` 접속 → 비밀번호 입력 → **`/admin/enroll-2fa` 에서 TOTP 등록**
   (인증 앱으로 QR 스캔 → 6자리 입력). 등록은 한 번만 하면 된다.

## 5. 운영 Turnstile 키

현재 `.env.local` 의 키는 Cloudflare **테스트 키("항상 통과")** 다.
아무 토큰이나 접수가 통과하므로 봇 방어가 사실상 없다.
Cloudflare 대시보드에서 운영 키를 발급해 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 와
`TURNSTILE_SECRET_KEY` 를 교체할 것.

## 6. 그 외 런칭 차단 항목

- `NEXT_PUBLIC_TEL` — 미설정이라 **전화 수단이 전부 숨겨져 있다**(무효 번호 링크를 막기 위함)
- `SITE.business` 6종 — 전부 `등록 전` 으로 표기 중. 전자상거래법 §10 표시 의무 항목이다
- 개인정보처리방침·이용약관 **전문 작성 완료** (`FE/lib/site-config.ts` 의 `PRIVACY_POLICY`·`TERMS_DOC`).
  제3자 제공(통신사)·처리위탁(상담 인력·Supabase·Vercel·Cloudflare)·파기절차·
  정보주체 권리·안전성 확보조치·권익침해 구제방법까지 기재했다.
  **운영자가 채울 값은 두 곳뿐이다** — `SITE.business` 6항목, `PRIVACY_OFFICER` 3항목(성명·직책·이메일).
  미입력 상태에서는 화면에 `등록 전`으로 표기된다 (숨기지 않는다).
  ⚠ 방침을 고칠 때는 `PRIVACY_POLICY.effectiveFrom` 시행일도 함께 올릴 것.


## 어드민이 로그인되지 않을 때

로그인 제한은 **계정을 잠그지 않는다.** 제3자가 요청을 퍼부어도 운영자의
로그인이 막히는 일은 없다 — 느려질 뿐이고(최대 4초), 한 번 성공하면 사라진다.
(설계 근거는 `FE/lib/admin/login-throttle.ts` 주석)

하드 차단은 **Cloudflare·Vercel 이 직접 쓴 IP 헤더가 있을 때**, 같은 IP 에서
15분 안에 5회 실패한 경우에만 걸린다. 이때도 15분 뒤 자동으로 풀린다.
서버를 재배포하면 제한 상태는 메모리와 함께 초기화된다.

로그인 실패가 계속되면 확인할 것 —
1. `access_logs` 의 `LOGIN_FAIL` 행과 `detail.stage` (`password` / `mfa` / `throttled`)
2. `SUPABASE_SERVICE_ROLE_KEY`·`NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 여부
3. TOTP 미등록 상태면 `/admin/enroll-2fa` 로 이동한다 (로그아웃되지 않는다)
