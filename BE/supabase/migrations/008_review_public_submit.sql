-- ---------------------------------------------------------------------
-- 008 후기 — 방문자 제출 경로
--
-- 왜 필요한가 (전문: docs/REVIEW_AUTHORSHIP.md)
--
-- `reviews` 에는 anon INSERT 정책이 없었다. 쓰기는 `reviews_admin_write`
-- (`is_admin()`) 뿐이고, 어드민은 단일 계정 1개(운영자)다. 즉 `/review` 에
-- "가입 후기" 로 뜰 수 있는 글은 **전부 운영자가 쓴 글**이었다.
-- 소비자가 제3자의 경험으로 읽도록 배치했는데 실제로는 사업자의 자기
-- 서술이면 표시광고법상 거짓·과장 광고 소지가 있다.
--
-- CLAUDE.md 규칙 1 이 `leads` 를 두고 막으려던 것과 같은 종류다. 규칙이
-- `reviews` 를 이름으로 적지 않았을 뿐, 보호하려는 것의 안쪽에 있다.
-- 001 의 `is_published boolean default false -- 승인 후 노출` 과
-- `author varchar(50) -- 노출은 마스킹된 형태로` 는 원래 "누군가 제출하고
-- → 운영자가 승인한다" 를 전제한 설계다. 제출하는 쪽이 빠진 채로 승인
-- 단계만 남아서, 승인이 자기 글을 자기가 승인하는 절차가 됐다.
--
-- ── 승인 전 글이 새지 않는 보장은 RLS 에 둔다 ──────────────────
-- 애플리케이션 코드에 맡기면 라우트를 하나 더 만들 때마다 다시 지켜야 한다.
--   · anon INSERT 는 `is_published = false` 인 행만 통과 (with check)
--   · anon 에게 UPDATE·DELETE 를 **주지 않는다** → 제출자가 나중에 자기 글을
--     게시 상태로 바꿀 경로가 없다
--   · 조회는 기존 `reviews_public_read`(`using (is_published)`) 그대로 —
--     승인 전 글은 select 단계에서 안 보인다. 제출자 본인에게도 안 보인다
--     (본인 확인 수단을 안 받기 때문이고, 그게 의도다)
-- ---------------------------------------------------------------------

-- 1. 방문자 제출 ------------------------------------------------------
drop policy if exists reviews_public_insert on reviews;
create policy reviews_public_insert on reviews
  for insert to anon, authenticated
  with check (
    -- 게시 상태로 바로 들어오는 것을 막는다. 이 한 줄이 "승인 후 노출" 을
    -- 지키는 유일한 장치다 — 애플리케이션이 깜빡해도 DB 가 거부한다.
    is_published = false
    -- 조회수를 심어서 들어오는 것도 막는다. 인기 글로 위장할 수 있다.
    and view_count = 0
    -- 운영자 답글을 스스로 달아 보내는 것을 막는다(007 이 추가한 열).
    -- "운영자 답변" 블록은 운영자가 답했다는 사실을 말하는 자리다.
    and admin_reply is null
    and admin_reply_at is null
  );

-- 2. 받지 않는 것을 받지 못하게 한다 ----------------------------------
-- 작성자 이름을 **받지 않는다.** 레퍼런스(다모아)도 작성자 입력란이 없다.
-- 개인정보를 한 종류라도 덜 받는 쪽이 항상 안전하고, 후기의 신뢰는 이름이
-- 아니라 "실제 가입자가 썼다" 는 경로에서 나온다. 받지 않으면 마스킹할 것도,
-- 유출될 것도 없다.
--
-- 열 자체를 지우지는 않는다 — 운영자가 어드민에서 "KT 가입자" 같은 분류를
-- 넣고 싶을 수 있고, 그건 개인정보가 아니다. 다만 **공개 제출에서는** 비운다.
alter table reviews
  drop constraint if exists reviews_public_no_author;
-- (제약으로 막지 않는다: 어드민이 넣는 행에는 author 가 들어갈 수 있다.
--  제출 경로의 비움은 `/api/reviews` 가 책임지고, RLS 는 위의 네 가지만 본다.
--  여기 주석을 남기는 이유는 "왜 제약이 없는지" 가 다음 사람의 첫 질문이기 때문이다.)

-- 3. 본문·제목 길이 하한 ----------------------------------------------
-- 001 은 `not null` 만 걸어 둬서 제목 한 글자, 본문 한 글자가 통과한다.
-- 빈 껍데기 글이 쌓이면 운영자가 승인 화면에서 그걸 전부 걸러야 한다.
-- 클라이언트·zod 검증과 **같은 하한을 DB 에도** 둔다 — 검증을 우회해 들어오는
-- 경로(직접 PostgREST 호출)가 anon 에게 열려 있기 때문이다.
alter table reviews
  drop constraint if exists reviews_title_len;
alter table reviews
  add constraint reviews_title_len
  check (char_length(btrim(title)) between 2 and 200);

alter table reviews
  drop constraint if exists reviews_content_len;
alter table reviews
  add constraint reviews_content_len
  check (char_length(btrim(content)) between 10 and 4000);

-- 4. 제출 레이트리밋용 보조 ------------------------------------------
-- 접수(`leads`)와 같은 방식이다: 라우트가 호출하는 `security definer` 함수가
-- 최근 창의 건수만 보고 boolean 을 돌려준다. **건수를 노출하지 않는다** —
-- 숫자를 돌려주면 그 자체가 "오늘 몇 건 들어왔나" 를 외부에 알려준다
-- (003 이 같은 이유로 파기 함수 권한을 회수했다).
--
-- 후기는 IP 를 저장하지 않는다. `leads` 와 달리 후기 행에 ip 열이 없고,
-- 넣을 이유도 없다 — 익명 제출이므로. 그래서 창을 **전역**으로 본다:
-- 짧은 시간에 전체 제출이 폭증하면 사람이 아니라 스크립트다.
-- 개별 공격자를 막는 건 Turnstile 과 Cloudflare 레이트리밋의 일이고,
-- 이 함수는 그 둘이 뚫렸을 때의 마지막 상한이다.
-- ⚠ 창·임계값을 **인자로 받지 않는다.** 처음에
--   `review_submit_flood(window_minutes int, threshold int)` 로 썼는데,
--   anon 에게 execute 를 주는 함수라 호출자가 `threshold => 999999` 를
--   넘기면 상한이 통째로 무력화된다. 006 에서 같은 실수를 한 번 고쳤다 —
--   anon 이 부르는 함수의 기준값은 함수 **안에** 박아야 한다.
create or replace function review_submit_flood()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  -- 10분 창에 21건째면 참. `limit` 으로 세는 범위를 끊어 두면 글이 많아도
  -- 전체 스캔이 되지 않는다 (006 과 같은 모양).
  select count(*) >= 20
  from (
    select 1
    from reviews
    where created_at >= now() - interval '10 minutes'
    limit 20
  ) t
$$;

revoke all on function review_submit_flood() from public;
grant execute on function review_submit_flood() to anon, authenticated;

comment on function review_submit_flood() is
  '후기 제출 폭증 여부만 boolean 으로. 건수를 돌려주지 않고, 창·임계값은 '
  '인자가 아니라 함수 안에 박혀 있다 — 008 주석 참고';
