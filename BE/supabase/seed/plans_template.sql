-- =====================================================================
-- plans 입력 템플릿
--
-- ⚠ 이 파일의 숫자는 형식을 보여주기 위한 **자리표시자**다.
--    실제 요금·약정·사은품 금액으로 교체한 뒤 실행할 것.
--    근거 없는 금액을 그대로 넣으면 표시광고법 위반 소지가 있다 (CLAUDE.md 규칙 6).
--
-- 마이그레이션이 아니라 운영 데이터 입력용이므로 migrations/ 에 두지 않는다.
-- 상시 관리는 어드민 /admin/plans 화면에서 한다 (구현 예정).
--
-- 실행:
--   psql "$DB_URL" -f BE/supabase/seed/plans_template.sql
-- =====================================================================

-- category: INTERNET(인터넷 단독) / TV(TV 단독) / BUNDLE(인터넷+TV 결합)
-- sort_order: 낮을수록 먼저 노출. 서브페이지 '추천 상품 3카드'는 상위 3건을 사용한다.
-- gift_amount: 현금 사은품 '상한'. 화면에는 "최대 N원"으로 표기된다.

insert into plans
  (carrier, category, name, speed, monthly_fee, contract_months, gift_amount, description, sort_order, is_active)
values
  -- KT ---------------------------------------------------------------
  ('KT', 'BUNDLE',   '(교체) 인터넷+TV 결합 A', '500M', 0, 36, 0, '(교체) 상품 설명 한 줄', 1, false),
  ('KT', 'INTERNET', '(교체) 인터넷 단독 A',    '500M', 0, 36, 0, null,                     2, false),
  ('KT', 'TV',       '(교체) TV 단독 A',        null,   0, 36, 0, null,                     3, false),

  -- SK ---------------------------------------------------------------
  ('SK', 'BUNDLE',   '(교체) 인터넷+TV 결합 A', '500M', 0, 36, 0, null, 1, false),
  ('SK', 'INTERNET', '(교체) 인터넷 단독 A',    '500M', 0, 36, 0, null, 2, false),

  -- LG ---------------------------------------------------------------
  ('LG', 'BUNDLE',   '(교체) 인터넷+TV 결합 A', '500M', 0, 36, 0, null, 1, false),
  ('LG', 'INTERNET', '(교체) 인터넷 단독 A',    '500M', 0, 36, 0, null, 2, false),

  -- KT스카이라이프 ----------------------------------------------------
  ('SKYLIFE', 'BUNDLE', '(교체) 인터넷+TV 결합 A', '500M', 0, 36, 0, null, 1, false),
  ('SKYLIFE', 'TV',     '(교체) TV 단독 A',        null,   0, 36, 0, null, 2, false);

-- is_active = false 로 들어간다. 값을 검수한 뒤 아래로 공개한다:
--   update plans set is_active = true where carrier = 'KT';
