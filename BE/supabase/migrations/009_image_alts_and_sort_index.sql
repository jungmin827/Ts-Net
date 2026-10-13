-- ---------------------------------------------------------------------
-- 009 홍보 이미지 대체 텍스트 · 빈 본문 금지 · 정렬 인덱스
--
-- ── 1) 왜 `image_alts` 를 따로 두는가 ───────────────────────────
-- 007 은 `notices.image_urls` 를 넣으면서 "대체 텍스트를 강제하는 자리가
-- `content` 다" 라고 적었다. 그 문장은 두 군데서 사실이 아니었다.
--
--   · `content text not null` 은 **존재**를 강제하지 빈 문자열을 막지 않는다.
--     `insert into notices (title, content, image_urls) values ('…', '', …)`
--     가 통과한다 — 그러면 `alt=""` 이미지 N장 + 본문 0자 = 스크린리더에
--     아무것도 없는 글이고, 007 주석이 막겠다고 선언한 바로 그 상태다.
--   · not null 은 `content` 가 이미지를 **설명한다**는 것을 강제하지 않는다.
--     운영자가 본문에 "10월 프로모션" 한 줄을 쓰고 금액·조건을 전부 이미지에
--     담으면, 그 금액은 스크린리더 사용자에게 존재하지 않는다. 레퍼런스
--     실측이 "텍스트 0자, PNG 6장" 이었다는 것은 **운영자가 실제로 그렇게
--     한다**는 근거다. 이 게시판은 홍보 이미지 채널로 운영하겠다고 007 과
--     `BoardArticle` 양쪽에 적어 둔 자리다 — 정보의 본체가 이미지에 있는
--     것이 정상 운용이고, 그 전제에서 `alt=""` 는 거의 항상 틀린 선언이다
--     (WCAG 1.1.1 / H67 — `alt=""` 는 "정보를 전달하지 않는 장식" 선언이다).
--
-- 그래서 장마다 대체 텍스트 칸을 만든다. 선택지가 "파일명을 읽히거나
-- 아무것도 읽히지 않거나" 둘뿐이었던 건 스키마에 칸이 없었기 때문이다.
--
-- 길이를 `image_urls` 와 **같게** 묶는다. 애플리케이션에서 맞추면 어드민을
-- 고칠 때마다 어긋나고, 어긋남은 "3장 중 2장만 설명이 있다" 처럼 조용하다.
-- 빈 문자열은 허용한다 — 그건 "이 한 장은 장식" 이라는 운영자의 **선택**이고,
-- 전체에 일괄로 걸던 기본값과는 다르다.
--
-- ── 2) 왜 정렬 인덱스를 다시 거는가 ────────────────────────────
-- 목록 정렬에 `id desc` 타이브레이커가 생겼다 (`FE/lib/board-data.ts`
-- `applyListOrder`). `created_at` 만으로는 정렬 키가 유일하지 않아 같은 시각의
-- 행이 둘 있으면 페이지 경계에서 글이 중복되거나 사라진다.
-- 001 의 인덱스는 그 마지막 키를 모른다. 정렬과 인덱스가 어긋나면 틀리지는
-- 않지만(Postgres 가 동치 묶음 안에서 다시 정렬한다) 순서를 보장받는 비용이
-- 정렬 단계로 넘어간다. 인덱스를 정렬과 같은 모양으로 둔다.
-- 기존 인덱스는 **남겨 둔다** — `is_published` 단독 조회(건수 집계)가 그걸 쓴다.
-- ---------------------------------------------------------------------

-- 1. 정보공유 본문 이미지 대체 텍스트 --------------------------------
alter table notices
  add column if not exists image_alts text[];

-- 장수와 설명 수가 어긋나면 DB 가 막는다. 둘 다 null 이면 이미지 없는 글이다.
alter table notices
  drop constraint if exists notices_image_alts_paired;
alter table notices
  add constraint notices_image_alts_paired
  check (
    (image_urls is null and image_alts is null)
    or (
      image_urls is not null
      and image_alts is not null
      and array_length(image_alts, 1) = array_length(image_urls, 1)
    )
  );

comment on column notices.image_alts is
  'image_urls 와 1:1 로 짝지은 대체 텍스트. 빈 문자열은 "이 한 장은 장식" 이라는 '
  '운영자의 선택이다 — 기본값으로 일괄 적용하던 alt="" 와 다르다';

-- 2. 빈 본문 금지 ----------------------------------------------------
-- 007 이 `admin_reply` 에 걸어 둔 것과 같은 제약을, 같은 이유로 `content` 에.
-- 이게 들어가야 "대체 텍스트를 강제하는 자리가 content 다" 가 사실이 된다.
alter table notices
  drop constraint if exists notices_content_not_blank;
alter table notices
  add constraint notices_content_not_blank
  check (btrim(content) <> '');

-- 후기 본문은 008 이 이미 10자 이상을 요구한다 (`reviews_content_len`).
-- 여기서 또 걸지 않는다 — 제약이 두 벌이면 어느 쪽이 거부했는지 헷갈린다.

-- 3. 정렬 인덱스 -----------------------------------------------------
create index if not exists reviews_sort_idx
  on reviews (is_published, created_at desc, id desc);

create index if not exists notices_sort_idx
  on notices (is_published, is_pinned desc, created_at desc, id desc);
