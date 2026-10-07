-- =====================================================================
-- plans 시드 — 인터넷다모아 기준 통신사 4사 요금표
--
-- 출처: 인터넷다모아 (https://www.xn--t60bv5ao1noylqucs0u.com/)
--   KT      /page/sub-02-test.php
--   SK      /page/sub-01-test.php
--   LG      /page/sub-03-test.php
--   SKYLIFE /page/sub-04-test.php
-- 수집일: 2026-10-08
--
-- 수집 방식 (3경로 교차검증):
--   (1) curl 원문 HTML -> 태그 제거 텍스트 덤프
--   (2) WebFetch 독립 재추출 (KT / SK / LG 요금표 전문 재전사)
--   (3) 페이지 내 요금계산기 JS의 products / combos 리터럴 직접 파싱
--       — 인터넷 단독가·TV 단독가는 (3)에서만 얻을 수 있다. 표에는 없다.
--   (1)과 (2)는 모든 표 행에서 100% 일치했다. (3)과의 불일치는 아래에 전량 기록.
--
-- ⚠ 타사가 게시한 가격이다. 통신사 표준요금·결합할인에 기반하지만
--    우리 계약 조건과 일치한다는 보장이 없다.
--    **런칭 전 각 통신사 실제 계약 조건으로 반드시 재검증할 것.**
--
-- 요금 전제 (원문 각주, 4개 페이지 공통):
--   `* 3년 약정, 휴대폰 1회선 결합 할인 기준, VAT포함가`
--   -> contract_months = 36, 표시 금액은 전부 VAT 포함
--   (SKYLIFE 페이지에도 동일 각주가 붙어 있으나 그 페이지에는 휴대폰 상품이 없다.
--    '휴대폰 1회선 결합' 전제가 SKYLIFE 요금에 실제로 적용되는지 확인 필요.)
--
-- 원문에 사은품(현금 지원금) 컬럼이 없어 gift_amount 는 전 행 NULL (CLAUDE.md 규칙 6).
-- 원문 마케팅 카피는 일절 옮기지 않았다 (CLAUDE.md 규칙 5).
--   추천카드 3종의 설명문은 전부 홍보 문구이므로 description = NULL.
--   description 에 들어간 값은 채널 수·추가 단말 요금 같은 사실 정보뿐이다.
--
-- ---------------------------------------------------------------------
-- 값 채택 원칙
-- ---------------------------------------------------------------------
-- 결합표 행(sort_order >= 10)의 금액은 **게시된 요금표 값을 그대로** 쓴다.
-- 계산기 JS 또는 추천카드와 어긋나는 값도 추정 보정하지 않았다.
-- 모든 불일치는 아래에 양쪽 숫자를 함께 적어 두었다. 운영자가 통신사
-- 실제 조건으로 판정해야 한다. (추정 보정 = 근거 없는 숫자 생성)
--
-- 교차검증 불일치 — 운영자 판정 필요
--   A. KT 1G+WIFI+TV베이직  list_fee
--      요금표 56,000원 / 계산기 단독가 합(38,500+16,500) 55,000원
--      각주 할인액 5,500원을 할인가 49,500원에 더해도 55,000원.
--      -> 요금표의 56,000원만 외톨이 값. 백원 단위도 다른 행과 불일치.
--   B. SK 500M+WIFI+TV이코노미  monthly_fee
--      요금표 48,400원 / 계산기 42,900원 / 추천카드 42,900원
--      (추천카드 '베이직 결합'이 같은 구성 50,600 -> 42,900 으로 게시)
--   C. SK 500M+WIFI+T스탠다드  list_fee / monthly_fee
--      요금표 56,100 / 50,600  vs  계산기 53,900(단독가 합) / 46,200
--      추천카드 '스탠다드 결합'(같은 구성)은 53,900 -> 46,200.
--   D. SK 1G+WIFI+TV스탠다드  list_fee
--      요금표 53,900원 / 계산기 단독가 합(39,600+19,800) 59,400원
--      요금표 값이 500M 행(56,100)보다 낮아 속도순이 역전된다.
--      59,400원은 어디에도 게시되지 않은 계산값이라 채택하지 않았다.
--   E. LG 100M+WIFI+TV실속형  monthly_fee
--      요금표 29,600원 / 계산기 39,600원
--      29,600원은 이 사이트 전체에서 유일하게 1,100원 배수가 아닌 금액이다.
--   F. LG 100M/500M + TV프리미엄  list_fee
--      요금표 46,200 / 57,200  vs  계산기 단독가 합 45,100 / 56,100 (각 1,100원 차)
--      500M 행은 추천카드도 57,200원이라 요금표 쪽이 2:1. 100M 행은 1:1.
--   G. SKYLIFE 1G+WIFI+TV플러스  list_fee
--      요금표 47,400원 / 계산기 단독가 합(36,300+11,000) 47,300원 / 추천카드 47,300원
--      -> 요금표 쪽이 1:2. 100원 차.
--   H. KT 기본 데이터(5G 슬림 10GB)  monthly_fee
--      요금표 34,750원 / 계산기 priceMap 정액결합 34,500원
--
-- ---------------------------------------------------------------------
-- 정규화 — name 은 원문 보존, tv_option 만 통일
-- ---------------------------------------------------------------------
--   SK 결합표 5행 구성명이 'TV스탠다드'가 아닌 'T스탠다드'로 게시돼 있다.
--   LG 는 추천카드가 'TV 실속형'(공백), 결합표가 'TV실속형'(붙임)으로 혼용한다.
--   tv_option 은 요금 계산기의 선택 축이라 표기가 갈리면 깨진 옵션이 하나 더 뜬다.
--   -> name 은 게시된 문자열 그대로, tv_option 만 공백 없는 표기로 정규화.
--
-- ---------------------------------------------------------------------
-- 이식하지 않은 표
-- ---------------------------------------------------------------------
--   KT 휴대폰 프리미엄 싱글/가족 결합      인원별 행렬 — 1행=1상품 모델에 대응 불가
--   SK 휴대폰 요즘가족결합 (45행)          인터넷속도 x 요금제 x 인원 3축 행렬
--   LG 참쉬운가족결합 / 투게더결합         요금제 x 인원 2축 행렬
--   인터넷+TV+휴대폰 3결합 (KT/SK/LG)      절대금액 없이 추가할인액만 제시
--                                          (KT -5,500 / SK -4,400·-6,600·-8,800
--                                           / LG -5,500·-9,900·-13,200)
--   -> 전부 PLANS_IMPORT.md 에만 기록한다. plans 로 모델링되면 별도 시드로 뺀다.
--
-- sort_order 규약: 1~3 추천카드 / 10~ 인터넷+TV 결합표 / 30~ 인터넷 단독
--                  40~ TV 단독 / 50~ 휴대폰 정액결합
--   (FE lib/plans.ts 의 TABLE_SORT_MIN = 10 과 맞물린다 — 추천카드 행은 요금표에서 제외)
--
-- 선행: migrations/001_init_schema.sql, migrations/002_plans_list_fee_tv_option.sql
-- 실행: psql "$DB_URL" -f BE/supabase/seed/plans_damoa_2026-10-08.sql
-- =====================================================================

begin;

delete from plans where carrier in ('KT','SK','LG','SKYLIFE');

insert into plans
  (carrier, category, name, speed, tv_option, monthly_fee, list_fee,
   contract_months, gift_amount, description, sort_order, is_active)
values
  -- ===================== KT =====================
  -- 추천 인터넷/IPTV 상품 (카드 3종)
  ('KT', 'BUNDLE', '인터넷와이드',                '500M+WIFI포함', 'TV베이직', 45100, 50600, 36, NULL, NULL, 1, true),
  ('KT', 'BUNDLE', 'KT 오피스넷',                 '500M',          'TV모든G',  50600, 56100, 36, NULL, NULL, 2, true),
  ('KT', 'BUNDLE', '프리미엄 결합',               '1G',            'TV모든G',  55000, 60500, 36, NULL, NULL, 3, true),
  -- KT 인터넷 + TV 결합
  ('KT', 'BUNDLE', '100M+WIFI+TV베이직',          '100M', 'TV베이직', 39600, 39600, 36, NULL, NULL, 10, true),
  ('KT', 'BUNDLE', '500M+WIFI+TV베이직',          '500M', 'TV베이직', 45100, 50600, 36, NULL, NULL, 11, true),
  ('KT', 'BUNDLE', '1G+WIFI+TV베이직',            '1G',   'TV베이직', 49500, 56000, 36, NULL, NULL, 12, true),  -- 불일치 A
  ('KT', 'BUNDLE', '100M+WIFI+TV모든G',           '100M', 'TV모든G',  45100, 45100, 36, NULL, NULL, 13, true),
  ('KT', 'BUNDLE', '500M+WIFI+TV모든G',           '500M', 'TV모든G',  50600, 56100, 36, NULL, NULL, 14, true),
  ('KT', 'BUNDLE', '1G+WIFI+TV모든G',             '1G',   'TV모든G',  55000, 60500, 36, NULL, NULL, 15, true),
  -- KT 인터넷 단독 (계산기 단독가)
  ('KT', 'INTERNET', '인터넷 100메가+WIFI',       '100M', NULL, 23100, NULL, 36, NULL, NULL, 30, true),
  ('KT', 'INTERNET', '인터넷 500메가+WIFI',       '500M', NULL, 34100, NULL, 36, NULL, NULL, 31, true),
  ('KT', 'INTERNET', '인터넷 1기가+WIFI',         '1G',   NULL, 38500, NULL, 36, NULL, NULL, 32, true),
  -- KT TV 단독 (계산기 단독가)
  ('KT', 'TV', 'TV 베이직', NULL, 'TV베이직', 16500, NULL, 36, NULL, '239개 채널 / TV 추가 1대당 월 10,670원', 40, true),
  ('KT', 'TV', 'TV 모든G',  NULL, 'TV모든G',  22000, NULL, 36, NULL, '250개 채널 / TV 추가 1대당 월 10,670원', 41, true),
  -- KT 휴대폰 정액 결합
  ('KT', 'MOBILE', '거의 안씀(5G 슬림 4GB)',      NULL, NULL, 24750, 27750, 36, NULL, NULL, 50, true),
  ('KT', 'MOBILE', '기본 데이터(5G 슬림 10GB)',   NULL, NULL, 34750, 37500, 36, NULL, NULL, 51, true),  -- 불일치 H
  ('KT', 'MOBILE', '완전 무제한(5G 베이직)',      NULL, NULL, 53000, 60000, 36, NULL, NULL, 52, true),

  -- ===================== SK =====================
  ('SK', 'BUNDLE', '베이직 결합',                 '500M+WIFI포함', 'TV이코노미',  42900, 50600, 36, NULL, NULL, 1, true),
  ('SK', 'BUNDLE', '스탠다드 결합',               '500M+WIFI포함', 'TV스탠다드',  46200, 53900, 36, NULL, NULL, 2, true),
  ('SK', 'BUNDLE', '프리미엄 결합',               '1G+WIFI포함',   'TV올플',      60500, 68200, 36, NULL, NULL, 3, true),
  -- SK 인터넷 + TV 결합
  ('SK', 'BUNDLE', '100M+WIFI+TV이코노미',        '100M', 'TV이코노미', 36300, 39600, 36, NULL, NULL, 10, true),
  ('SK', 'BUNDLE', '500M+WIFI+TV이코노미',        '500M', 'TV이코노미', 48400, 50600, 36, NULL, NULL, 11, true),  -- 불일치 B
  ('SK', 'BUNDLE', '1G+WIFI+TV이코노미',          '1G',   'TV이코노미', 48400, 56100, 36, NULL, NULL, 12, true),
  ('SK', 'BUNDLE', '100M+WIFI+TV스탠다드',        '100M', 'TV스탠다드', 39600, 42900, 36, NULL, NULL, 13, true),
  ('SK', 'BUNDLE', '500M+WIFI+T스탠다드',         '500M', 'TV스탠다드', 50600, 56100, 36, NULL, NULL, 14, true),  -- 불일치 C, name 원문 보존
  ('SK', 'BUNDLE', '1G+WIFI+TV스탠다드',          '1G',   'TV스탠다드', 51700, 53900, 36, NULL, NULL, 15, true),  -- 불일치 D
  ('SK', 'BUNDLE', '100M+WIFI+TV올플',            '100M', 'TV올플',     48400, 51700, 36, NULL, NULL, 16, true),
  ('SK', 'BUNDLE', '500M+WIFI+TV올플',            '500M', 'TV올플',     55000, 62700, 36, NULL, NULL, 17, true),
  ('SK', 'BUNDLE', '1G+WIFI+TV올플',              '1G',   'TV올플',     60500, 68200, 36, NULL, NULL, 18, true),
  -- SK 인터넷 단독
  ('SK', 'INTERNET', '인터넷 100메가+WIFI',       '100M', NULL, 23100, NULL, 36, NULL, NULL, 30, true),
  ('SK', 'INTERNET', '인터넷 500메가+WIFI',       '500M', NULL, 34100, NULL, 36, NULL, NULL, 31, true),
  ('SK', 'INTERNET', '인터넷 1기가+WIFI',         '1G',   NULL, 39600, NULL, 36, NULL, NULL, 32, true),
  -- SK TV 단독
  ('SK', 'TV', 'TV 이코노미', NULL, 'TV이코노미', 16500, NULL, 36, NULL, '183개 채널 + 스마트3 / TV 추가 1대당 월 9,900원',   40, true),
  ('SK', 'TV', 'TV 스탠다드', NULL, 'TV스탠다드', 19800, NULL, 36, NULL, '232개 채널 + 스마트3 / TV 추가 1대당 월 9,900원',   41, true),
  ('SK', 'TV', 'TV 올플',     NULL, 'TV올플',     28600, NULL, 36, NULL, '257개 채널 + IA4비젼 / TV 추가 1대당 월 9,900원',   42, true),
  -- SK 휴대폰 정액 결합
  ('SK', 'MOBILE', '거의 안씀(5G 컴팩트 6GB)',          NULL, NULL, 29250, 39000, 36, NULL, NULL, 50, true),
  ('SK', 'MOBILE', '기본 데이터(5G 컴팩트플러스 8GB)',  NULL, NULL, 33750, 45000, 36, NULL, NULL, 51, true),
  ('SK', 'MOBILE', '완전 무제한(5G 프라임)',            NULL, NULL, 66750, 89000, 36, NULL, NULL, 52, true),

  -- ===================== LG =====================
  ('LG', 'BUNDLE', '베이직 결합',                 '500MB+WIFI포함', 'TV실속형',   45100, 52800, 36, NULL, NULL, 1, true),
  ('LG', 'BUNDLE', '스탠다드 결합',               '500MB+WIFI포함', 'TV프리미엄', 48400, 57200, 36, NULL, NULL, 2, true),
  ('LG', 'BUNDLE', '프리미엄 결합',               '1G+WIFI포함',    'TV프리미엄', 53900, 61600, 36, NULL, NULL, 3, true),
  -- LG 인터넷 + TV 결합
  ('LG', 'BUNDLE', '100M+WIFI+TV실속형',          '100M', 'TV실속형',   29600, 41800, 36, NULL, NULL, 10, true),  -- 불일치 E
  ('LG', 'BUNDLE', '500M+WIFI+TV실속형',          '500M', 'TV실속형',   45100, 52800, 36, NULL, NULL, 11, true),
  ('LG', 'BUNDLE', '1G+WIFI+TV실속형',            '1G',   'TV실속형',   49500, 58300, 36, NULL, NULL, 12, true),
  ('LG', 'BUNDLE', '100M+WIFI+TV프리미엄',        '100M', 'TV프리미엄', 42900, 46200, 36, NULL, NULL, 13, true),  -- 불일치 F
  ('LG', 'BUNDLE', '500M+WIFI+TV프리미엄',        '500M', 'TV프리미엄', 48400, 57200, 36, NULL, NULL, 14, true),  -- 불일치 F
  ('LG', 'BUNDLE', '1G+WIFI+TV프리미엄',          '1G',   'TV프리미엄', 53900, 61600, 36, NULL, NULL, 15, true),
  -- LG 인터넷 단독
  ('LG', 'INTERNET', '인터넷 100메가+WIFI',       '100M', NULL, 22000, NULL, 36, NULL, NULL, 30, true),
  ('LG', 'INTERNET', '인터넷 500메가+WIFI',       '500M', NULL, 33000, NULL, 36, NULL, NULL, 31, true),
  ('LG', 'INTERNET', '인터넷 1기가+WIFI',         '1G',   NULL, 38500, NULL, 36, NULL, NULL, 32, true),
  -- LG TV 단독
  ('LG', 'TV', 'TV 실속형',   NULL, 'TV실속형',   19800, NULL, 36, NULL, '217개 채널 / TV 추가 1대당 월 9,900원', 40, true),
  ('LG', 'TV', 'TV 프리미엄', NULL, 'TV프리미엄', 23100, NULL, 36, NULL, '252개 채널 / TV 추가 1대당 월 9,900원', 41, true),
  -- LG 휴대폰 정액 결합
  ('LG', 'MOBILE', '거의 안씀(5G 슬림+)',              NULL, NULL, 35250, 47000, 36, NULL, NULL, 50, true),
  ('LG', 'MOBILE', '기본 데이터(5G 심플+)',            NULL, NULL, 45750, 61000, 36, NULL, NULL, 51, true),
  ('LG', 'MOBILE', '완전 무제한(5G 프리미엄에센셜)',   NULL, NULL, 63750, 85000, 36, NULL, NULL, 52, true),

  -- =================== SKYLIFE ==================
  ('SKYLIFE', 'BUNDLE', '베이직 결합',            '500MB+WIFI포함', 'TV베이직', 37400, 40700, 36, NULL, NULL, 1, true),
  ('SKYLIFE', 'BUNDLE', '스탠다드 결합',          '500MB+WIFI포함', 'TV플러스', 38500, 41800, 36, NULL, NULL, 2, true),
  ('SKYLIFE', 'BUNDLE', '프리미엄 결합',          '1G+WIFI포함',    'TV플러스', 44000, 47300, 36, NULL, NULL, 3, true),
  -- 스카이라이프 인터넷 + TV 결합
  ('SKYLIFE', 'BUNDLE', '100M+WIFI+TV베이직',     '100M', 'TV베이직', 30800, 34100, 36, NULL, NULL, 10, true),
  ('SKYLIFE', 'BUNDLE', '200M+WIFI+TV베이직',     '200M', 'TV베이직', 31900, 35200, 36, NULL, NULL, 11, true),
  ('SKYLIFE', 'BUNDLE', '500M+WIFI+TV베이직',     '500M', 'TV베이직', 37400, 40700, 36, NULL, NULL, 12, true),
  ('SKYLIFE', 'BUNDLE', '1G+WIFI+TV베이직',       '1G',   'TV베이직', 42900, 46200, 36, NULL, NULL, 13, true),
  ('SKYLIFE', 'BUNDLE', '100M+WIFI+TV플러스',     '100M', 'TV플러스', 31900, 35200, 36, NULL, NULL, 14, true),
  ('SKYLIFE', 'BUNDLE', '200M+WIFI+TV플러스',     '200M', 'TV플러스', 33000, 36300, 36, NULL, NULL, 15, true),
  ('SKYLIFE', 'BUNDLE', '500M+WIFI+TV플러스',     '500M', 'TV플러스', 38500, 41800, 36, NULL, NULL, 16, true),
  ('SKYLIFE', 'BUNDLE', '1G+WIFI+TV플러스',       '1G',   'TV플러스', 44000, 47400, 36, NULL, NULL, 17, true),  -- 불일치 G
  -- 스카이라이프 인터넷 단독
  ('SKYLIFE', 'INTERNET', '인터넷 100메가+WIFI',  '100M', NULL, 24200, NULL, 36, NULL, NULL, 30, true),
  ('SKYLIFE', 'INTERNET', '인터넷 200메가+WIFI',  '200M', NULL, 25300, NULL, 36, NULL, NULL, 31, true),
  ('SKYLIFE', 'INTERNET', '인터넷 500메가+WIFI',  '500M', NULL, 30800, NULL, 36, NULL, NULL, 32, true),
  ('SKYLIFE', 'INTERNET', '인터넷 1기가+WIFI',    '1G',   NULL, 36300, NULL, 36, NULL, NULL, 33, true),
  -- 스카이라이프 TV 단독
  ('SKYLIFE', 'TV', 'IPTV 베이직', NULL, 'TV베이직',  9900, NULL, 36, NULL, '194개 채널 / TV 추가 1대당 월 6,050원', 40, true),
  ('SKYLIFE', 'TV', 'IPTV 플러스', NULL, 'TV플러스', 11000, NULL, 36, NULL, '209개 채널 / TV 추가 1대당 월 6,050원', 41, true);

commit;

-- 요약 (총 72행)
--   carrier  추천  결합표  인터넷단독  TV단독  휴대폰  소계
--   KT          3       6           3       2       3    17
--   SK          3       9           3       3       3    21
--   LG          3       6           3       2       3    17
--   SKYLIFE     3       8           4       2       0    17
--
-- 미수집 필드
--   gift_amount  전 행 NULL — 원문에 사은품 금액 컬럼이 아예 없다
--   list_fee     인터넷 단독 / TV 단독 14행 NULL — 계산기에 단독 정가가 없다
--   description  추천카드·결합표·휴대폰 행 NULL — 원문 설명은 전부 홍보 문구라 제외
