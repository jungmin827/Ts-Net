-- ---------------------------------------------------------------------
-- 010 후기 사진 — 방문자가 최대 3장 첨부 (2026-10-26 사용자 결정)
--
-- 결정: Supabase 무료 플랜 · 장수 3장 · 목록에 썸네일 · 버킷 하나.
--
-- ── 버킷 하나로 어떻게 "승인 전 비공개" 를 지키는가 ──────────────
-- `review-images` 는 public 버킷이다. public 버킷의 객체는 **경로를 아는
-- 사람은 누구나** 받을 수 있다 — 승인 여부와 상관없이. 그래서 비공개는
-- 경로를 아무도 모르게 하는 것으로 지킨다:
--   · 경로는 서버(`/api/reviews`)가 정한다. 무작위 128비트(`r/<32hex>.webp`)
--   · 그 경로를 제출자에게 **돌려주지 않는다.** 응답은 `{ ok: true }` 뿐이다
--   · anon 에게 storage.objects 정책을 **하나도 주지 않는다** → 목록 조회·
--     업로드·삭제 전부 불가. 업로드는 service_role 로 라우트만 한다
--   · 행의 `image_paths` 는 `reviews_public_read`(`using (is_published)`)
--     뒤에 있다 — 승인 전 행의 경로는 select 단계에서 안 보인다
-- 즉 승인 전 사진의 주소를 아는 쪽은 운영자뿐이다. 버킷을 두 개로 나누는
-- 것보다 약하지만(주소가 새면 보인다), 주소가 새는 경로를 위에서 다 막았다.
-- 막지 않으면 이 버킷은 **익명 무료 이미지 호스팅**이 된다 — 업로드한 쪽이
-- 주소를 받아 가서 아무 데나 붙이는 것. 그게 버킷 하나를 쓸 때의 최대 위험이다.
--
-- ── 대체 텍스트는 운영자가 승인할 때 쓴다 ────────────────────────
-- CLAUDE.md: 이미지마다 대체 텍스트를 짝지어 넣는다(009 와 같은 규칙).
-- 방문자에게 받으면 비거나 "사진" 같은 값이 들어온다. 그래서 제출 시점에는
-- `image_alts` 가 **반드시 비어 있고**(anon 정책), 게시하려면 **반드시
-- 채워져 있어야** 한다(아래 제약). 빈 문자열은 "이 한 장은 장식" 이라는
-- 선택이고, 그 선택을 운영자가 장마다 한다.
-- ---------------------------------------------------------------------

-- 1. 버킷 -------------------------------------------------------------
-- 크기 상한은 라우트(`lib/review-images.ts` 의 MAX_FULL_BYTES)와 같은 값이다.
-- 브라우저가 1600px WebP 로 줄여서 보내므로 보통 300KB 안팎이고, 이 상한은
-- 줄이기를 건너뛴 요청을 막는 마지막 선이다. 형식은 브라우저 캔버스가 만드는
-- 두 가지뿐이다 — Safari 는 캔버스에서 WebP 를 못 만들어 JPEG 로 떨어진다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-images', 'review-images', true, 1258291, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. 열 ---------------------------------------------------------------
-- 원본 경로만 적는다. 썸네일은 같은 이름에 `.t` 를 끼운 경로다
-- (`r/ab…cd.webp` → `r/ab…cd.t.webp`, `lib/review-images.ts` 의 thumbPath).
-- 두 열로 따로 적으면 짝이 어긋날 수 있다 — 규칙으로 유도하면 어긋날 수 없다.
alter table reviews
  add column if not exists image_paths text[],
  add column if not exists image_alts  text[];

comment on column reviews.image_paths is
  '첨부 사진 경로(review-images 버킷, 최대 3장). 썸네일은 `.t` 를 끼운 경로 — 010 주석 참고';
comment on column reviews.image_alts is
  'image_paths 와 1:1 대체 텍스트. 운영자가 승인할 때 쓴다 — 게시하려면 필수';

-- 빈 배열과 null 이 둘 다 "사진 없음" 이 되지 않게 하나로 줄인다 (007 과 같은 판단)
alter table reviews drop constraint if exists reviews_image_paths_nonempty;
alter table reviews add constraint reviews_image_paths_nonempty
  check (image_paths is null or array_length(image_paths, 1) >= 1);

alter table reviews drop constraint if exists reviews_image_paths_max;
alter table reviews add constraint reviews_image_paths_max
  check (image_paths is null or array_length(image_paths, 1) <= 3);

-- 경로 형식. anon 은 PostgREST 로 직접 INSERT 할 수 있으므로(008) 라우트가
-- 정한 모양이 아닌 값 — 외부 URL, `../`, 다른 버킷 경로 — 을 DB 가 거부한다.
-- 배열 원소마다 정규식을 걸 수 없어(check 에 서브쿼리 불가) 이어 붙여 검사한다.
-- `array_to_string` 은 null 원소를 **건너뛰므로** null 이 끼면 따로 막는다.
alter table reviews drop constraint if exists reviews_image_paths_format;
alter table reviews add constraint reviews_image_paths_format
  check (
    image_paths is null
    or (
      array_position(image_paths, null) is null
      and array_to_string(image_paths, '|')
          ~ '^r/[0-9a-f]{32}\.(webp|jpg)(\|r/[0-9a-f]{32}\.(webp|jpg)){0,2}$'
    )
  );

-- 대체 텍스트는 사진과 **길이가 같아야** 한다 (009 의 notices 와 같은 규칙)
alter table reviews drop constraint if exists reviews_image_alts_paired;
alter table reviews add constraint reviews_image_alts_paired
  check (
    image_alts is null
    or (
      image_paths is not null
      and array_length(image_alts, 1) = array_length(image_paths, 1)
      and array_position(image_alts, null) is null
    )
  );

-- 사진이 있는 글은 대체 텍스트 없이 **게시될 수 없다.** 어드민 화면이 먼저
-- 막지만, 화면을 고치다 빠뜨려도 여기서 걸린다.
alter table reviews drop constraint if exists reviews_image_alts_before_publish;
alter table reviews add constraint reviews_image_alts_before_publish
  check (not is_published or image_paths is null or image_alts is not null);

-- 3. 방문자 제출 정책 — 008 을 다시 쓴다 ------------------------------
-- 008 의 네 조건은 그대로 두고 둘을 더한다.
--   · image_alts is null — 대체 텍스트는 운영자 몫이다(위 주석)
--   · thumbnail_url is null — 001 부터 있던 열인데 008 이 막지 않았다.
--     anon 이 외부 주소를 넣어 제출하면 어드민 승인 화면에는 안 보이는데
--     (그 열을 그리지 않는다) 상세 페이지는 그 주소를 이미지로 그렸다.
--     운영자가 본문만 보고 승인하면 **보지 못한 그림**이 게시되는 구멍이다.
--     사진은 이제 `image_paths` 로만 받으므로 이 열은 닫는다.
drop policy if exists reviews_public_insert on reviews;
create policy reviews_public_insert on reviews
  for insert to anon, authenticated
  with check (
    is_published = false
    and view_count = 0
    and admin_reply is null
    and admin_reply_at is null
    and image_alts is null
    and thumbnail_url is null
  );
