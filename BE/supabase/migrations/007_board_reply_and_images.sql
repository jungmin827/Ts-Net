-- ---------------------------------------------------------------------
-- 007 게시판 — 운영자 답글 · 정보공유 본문 이미지
--
-- 레퍼런스 두 곳(탐나넷 / 인터넷다모아)의 게시판을 요소 단위로 뜯어본 결과,
-- 두 사이트가 **공통으로 투자한 유일한 상호작용은 "운영자 답글" 하나**였다.
-- 평점도, 스레드 댓글도, 이전글/다음글도 양쪽에 없다.
--   · 탐나넷: 후기 30건 전부에 관리자 답글이 정확히 1건씩 달려 있다.
--   · 다모아: 상세 하단에 "운영진 댓글" 전용 블록이 1건 슬롯으로 박혀 있다.
-- 그러므로 후기 1건당 운영자 답글 **1건**이 들어가는 모양으로 둔다.
-- 스레드형 댓글 테이블을 만들지 않는 이유는 그게 필요한 게 아니기 때문이다 —
-- 방문자끼리의 대화가 아니라 "운영자가 공개적으로 답했다" 는 사실 하나다.
-- 테이블을 새로 파면 RLS 정책·작성자 신원·신고 처리까지 따라오는데,
-- 어드민은 단일 계정 1개뿐이라(CLAUDE.md) 그 구조를 받칠 주체가 없다.
--
-- 정보공유 본문 이미지 —
--   다모아의 정보공유 글은 본문이 **전부 업로드 이미지**다 (텍스트 0자,
--   CKEditor 로 올린 PNG 6장). 즉 그 게시판은 글 게시판이 아니라
--   **홍보 이미지 채널**로 운영된다. 우리도 "추후 다른 디자인 툴로 만든
--   상세페이지 홍보 이미지를 삽입할 수 있는 구조" 가 요구사항이라
--   같은 쓰임을 받아야 한다.
--   단, `content` 를 비울 수는 없게 둔다 (not null 유지) — 이미지만 올리면
--   스크린리더 사용자와 검색엔진에게 그 글은 **빈 글**이다. 대체 텍스트를
--   강제하는 자리가 `content` 다.
-- ---------------------------------------------------------------------

-- 1. 후기 운영자 답글 ------------------------------------------------
alter table reviews
  add column if not exists admin_reply    text,
  add column if not exists admin_reply_at timestamptz;

-- 답글 본문과 시각은 **같이 있거나 같이 없어야** 한다.
-- 한쪽만 채워지면 화면은 "답변이 있는데 언제인지 모름" 또는 "빈 답변 블록"
-- 을 그린다. 애플리케이션 코드에 맡기면 어드민 UI 를 고칠 때마다 깨진다.
alter table reviews
  drop constraint if exists reviews_admin_reply_paired;
alter table reviews
  add constraint reviews_admin_reply_paired
  check ((admin_reply is null) = (admin_reply_at is null));

-- 빈 문자열은 null 과 같은 뜻인데 화면에서는 다르게 동작한다
-- (`admin_reply && ...` 가 통과해 빈 답변 블록이 그려진다).
alter table reviews
  drop constraint if exists reviews_admin_reply_not_blank;
alter table reviews
  add constraint reviews_admin_reply_not_blank
  check (admin_reply is null or btrim(admin_reply) <> '');

comment on column reviews.admin_reply is
  '운영자 공개 답글 1건. 스레드형 댓글이 아니다 — 007 마이그레이션 주석 참고';

-- 2. 정보공유 본문 이미지 --------------------------------------------
-- 여러 장을 순서대로 붙이므로 배열이다 (다모아는 글 하나에 6장을 썼다).
alter table notices
  add column if not exists image_urls text[];

-- 빈 배열은 "이미지 없음" 을 두 가지 방식으로 표현하게 만든다(null 과 '{}').
-- 조회부에서 둘 다 다루게 하지 않고 여기서 하나로 줄인다.
alter table notices
  drop constraint if exists notices_image_urls_nonempty;
alter table notices
  add constraint notices_image_urls_nonempty
  check (image_urls is null or array_length(image_urls, 1) >= 1);

-- 장수 상한. 상한이 없으면 글 하나가 목록 응답을 통째로 부풀릴 수 있다.
alter table notices
  drop constraint if exists notices_image_urls_max;
alter table notices
  add constraint notices_image_urls_max
  check (image_urls is null or array_length(image_urls, 1) <= 20);

comment on column notices.image_urls is
  '본문에 순서대로 붙는 이미지 URL. 디자인 툴로 만든 홍보 이미지용 — '
  'content 는 그 이미지의 대체 텍스트 역할을 하므로 비울 수 없다';

-- 3. 목록 조회 인덱스 ------------------------------------------------
-- 후기 목록은 `is_published` + `created_at desc` 로만 읽는다. 001 의
-- `reviews_pub_idx` 가 그 순서라 추가 인덱스는 넣지 않는다 — 쓰지 않는
-- 인덱스는 쓰기를 느리게만 한다.
