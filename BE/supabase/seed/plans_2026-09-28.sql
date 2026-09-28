-- =====================================================================
-- plans 시드 — 통신사 4사 요금표 (list_fee·tv_option 포함)
--
-- 출처: 레퍼런스 사이트 통신사 서브페이지, 수집일 2026-09-28
-- 수집 방식: 페이지 전문 추출 + DOM 직접 덤프 + 스크린샷 육안 대조 (3중 교차검증)
--
-- ⚠ 타사가 게시한 가격이다. 통신사 표준요금·결합할인에 기반하지만
--    우리 계약 조건과 일치한다는 보장이 없다.
--    **런칭 전 각 통신사 실제 계약 조건으로 반드시 재검증할 것.**
--
-- 전제(원문 각주): 3년 약정, 휴대폰 1회선 결합 할인 기준, VAT 포함가 → contract_months = 36
-- 원본 요금표에 사은품 컬럼이 없어 gift_amount 는 전부 NULL (규칙 6).
--
-- 원본 오타 처리: SK 5행의 구성명이 'TV스탠다드'가 아닌 'T스탠다드'로 적혀 있다.
--   name 은 원문 그대로 보존하고, 요금 계산기의 축으로 쓰는 tv_option 만
--   'TV스탠다드'로 정규화했다. 정규화하지 않으면 선택기에 깨진 옵션이 하나 더 뜬다.
--
-- 선행: migrations/002_plans_list_fee_tv_option.sql
-- 실행: psql "$DB_URL" -f BE/supabase/seed/plans_2026-09-28.sql
-- =====================================================================

begin;

delete from plans where carrier in ('KT','SK','LG','SKYLIFE');

insert into plans
  (carrier, category, name, speed, tv_option, monthly_fee, list_fee,
   contract_months, gift_amount, description, sort_order, is_active)
values
  ('KT', 'BUNDLE', '인터넷와이드', '500M+WIFI포함', 'TV베이직', 45100, 50600, 36, NULL, '끊김 없이, 빠르게! 유선통신 중심 DPS', 1, true),
  ('KT', 'BUNDLE', 'KT 오피스넷', '500M', 'TV모든G', 50600, 56100, 36, NULL, '속도와 안정성의 만남, 유선 DPS 솔루션!', 2, true),
  ('KT', 'BUNDLE', '프리미엄 결합', '1G', 'TV모든G', 55000, 60500, 36, NULL, '미세한 변화까지 감지하는 스마트 TPS!', 3, true),
  ('KT', 'BUNDLE', '100M+WIFI+TV베이직', '100M', 'TV베이직', 39600, 39600, 36, NULL, NULL, 10, true),
  ('KT', 'BUNDLE', '500M+WIFI+TV베이직', '500M', 'TV베이직', 45100, 50600, 36, NULL, NULL, 11, true),
  ('KT', 'BUNDLE', '1G+WIFI+TV베이직', '1G', 'TV베이직', 49500, 56000, 36, NULL, NULL, 12, true),
  ('KT', 'BUNDLE', '100M+WIFI+TV모든G', '100M', 'TV모든G', 45100, 45100, 36, NULL, NULL, 13, true),
  ('KT', 'BUNDLE', '500M+WIFI+TV모든G', '500M', 'TV모든G', 50600, 56100, 36, NULL, NULL, 14, true),
  ('KT', 'BUNDLE', '1G+WIFI+TV모든G', '1G', 'TV모든G', 55000, 60500, 36, NULL, NULL, 15, true),
  ('KT', 'MOBILE', '거의 안씀(5G 슬림 4GB)', NULL, NULL, 24750, 27750, 36, NULL, NULL, 50, true),
  ('KT', 'MOBILE', '기본 데이터(5G 슬림 10GB)', NULL, NULL, 34750, 37500, 36, NULL, NULL, 51, true),
  ('KT', 'MOBILE', '완전 무제한(5G 베이직)', NULL, NULL, 53000, 60000, 36, NULL, NULL, 52, true),
  ('SK', 'BUNDLE', '베이직 결합', '500M+WIFI포함', 'TV이코노미', 42900, 50600, 36, NULL, '끊김 없이, 빠르게! 유선통신 중심 DPS', 1, true),
  ('SK', 'BUNDLE', '스탠다드 결합', '500M+WIFI포함', 'TV스탠다드', 46200, 53900, 36, NULL, '속도와 안정성의 만남, 유선 DPS 솔루션!', 2, true),
  ('SK', 'BUNDLE', '프리미엄 결합', '1G+WIFI포함', 'TV올플', 60500, 68200, 36, NULL, '미세한 변화까지 감지하는 스마트 TPS!', 3, true),
  ('SK', 'BUNDLE', '100M+WIFI+TV이코노미', '100M', 'TV이코노미', 36300, 39600, 36, NULL, NULL, 10, true),
  ('SK', 'BUNDLE', '500M+WIFI+TV이코노미', '500M', 'TV이코노미', 48400, 50600, 36, NULL, NULL, 11, true),
  ('SK', 'BUNDLE', '1G+WIFI+TV이코노미', '1G', 'TV이코노미', 48400, 56100, 36, NULL, NULL, 12, true),
  ('SK', 'BUNDLE', '100M+WIFI+TV스탠다드', '100M', 'TV스탠다드', 39600, 42900, 36, NULL, NULL, 13, true),
  ('SK', 'BUNDLE', '500M+WIFI+T스탠다드', '500M', 'TV스탠다드', 50600, 56100, 36, NULL, NULL, 14, true),
  ('SK', 'BUNDLE', '1G+WIFI+TV스탠다드', '1G', 'TV스탠다드', 51700, 53900, 36, NULL, NULL, 15, true),
  ('SK', 'BUNDLE', '100M+WIFI+TV올플', '100M', 'TV올플', 48400, 51700, 36, NULL, NULL, 16, true),
  ('SK', 'BUNDLE', '500M+WIFI+TV올플', '500M', 'TV올플', 55000, 62700, 36, NULL, NULL, 17, true),
  ('SK', 'BUNDLE', '1G+WIFI+TV올플', '1G', 'TV올플', 60500, 68200, 36, NULL, NULL, 18, true),
  ('SK', 'MOBILE', '거의 안씀(5G 컴팩트 6GB)', NULL, NULL, 29250, 39000, 36, NULL, NULL, 50, true),
  ('SK', 'MOBILE', '기본 데이터(5G 컴팩트플러스 8GB)', NULL, NULL, 33750, 45000, 36, NULL, NULL, 51, true),
  ('SK', 'MOBILE', '완전 무제한(5G 프라임)', NULL, NULL, 66750, 89000, 36, NULL, NULL, 52, true),
  ('LG', 'BUNDLE', '베이직 결합', '500MB+WIFI포함', 'TV 실속형', 45100, 52800, 36, NULL, '끊김 없이, 빠르게! 유선통신 중심 DPS', 1, true),
  ('LG', 'BUNDLE', '스탠다드 결합', '500MB+WIFI포함', 'TV 프리미엄', 48400, 57200, 36, NULL, '속도와 안정성의 만남, 유선 DPS 솔루션!', 2, true),
  ('LG', 'BUNDLE', '프리미엄 결합', '1G+WIFI포함', 'TV 프리미엄', 53900, 61600, 36, NULL, '미세한 변화까지 감지하는 스마트 TPS!', 3, true),
  ('LG', 'BUNDLE', '100M+WIFI+TV실속형', '100M', 'TV실속형', 29600, 41800, 36, NULL, NULL, 10, true),
  ('LG', 'BUNDLE', '500M+WIFI+TV실속형', '500M', 'TV실속형', 45100, 52800, 36, NULL, NULL, 11, true),
  ('LG', 'BUNDLE', '1G+WIFI+TV실속형', '1G', 'TV실속형', 49500, 58300, 36, NULL, NULL, 12, true),
  ('LG', 'BUNDLE', '100M+WIFI+TV프리미엄', '100M', 'TV프리미엄', 42900, 46200, 36, NULL, NULL, 13, true),
  ('LG', 'BUNDLE', '500M+WIFI+TV프리미엄', '500M', 'TV프리미엄', 48400, 57200, 36, NULL, NULL, 14, true),
  ('LG', 'BUNDLE', '1G+WIFI+TV프리미엄', '1G', 'TV프리미엄', 53900, 61600, 36, NULL, NULL, 15, true),
  ('LG', 'MOBILE', '거의 안씀(5G 슬림+)', NULL, NULL, 35250, 47000, 36, NULL, NULL, 50, true),
  ('LG', 'MOBILE', '기본 데이터(5G 심플+)', NULL, NULL, 45750, 61000, 36, NULL, NULL, 51, true),
  ('LG', 'MOBILE', '완전 무제한(5G 프리미엄에센셜)', NULL, NULL, 63750, 85000, 36, NULL, NULL, 52, true),
  ('SKYLIFE', 'BUNDLE', '베이직 결합', '500MB+WIFI포함', 'TV베이직', 37400, 40700, 36, NULL, '끊김 없이, 빠르게! 유선통신 중심 DPS', 1, true),
  ('SKYLIFE', 'BUNDLE', '스탠다드 결합', '500MB+WIFI포함', 'TV플러스', 38500, 41800, 36, NULL, '속도와 안정성의 만남, 유선 DPS 솔루션!', 2, true),
  ('SKYLIFE', 'BUNDLE', '프리미엄 결합', '1G+WIFI포함', 'TV플러스', 44000, 47300, 36, NULL, '미세한 변화까지 감지하는 스마트 TPS!', 3, true),
  ('SKYLIFE', 'BUNDLE', '100M+WIFI+TV베이직', '100M', 'TV베이직', 30800, 34100, 36, NULL, NULL, 10, true),
  ('SKYLIFE', 'BUNDLE', '200M+WIFI+TV베이직', '200M', 'TV베이직', 31900, 35200, 36, NULL, NULL, 11, true),
  ('SKYLIFE', 'BUNDLE', '500M+WIFI+TV베이직', '500M', 'TV베이직', 37400, 40700, 36, NULL, NULL, 12, true),
  ('SKYLIFE', 'BUNDLE', '1G+WIFI+TV베이직', '1G', 'TV베이직', 42900, 46200, 36, NULL, NULL, 13, true),
  ('SKYLIFE', 'BUNDLE', '100M+WIFI+TV플러스', '100M', 'TV플러스', 31900, 35200, 36, NULL, NULL, 14, true),
  ('SKYLIFE', 'BUNDLE', '200M+WIFI+TV플러스', '200M', 'TV플러스', 33000, 36300, 36, NULL, NULL, 15, true),
  ('SKYLIFE', 'BUNDLE', '500M+WIFI+TV플러스', '500M', 'TV플러스', 38500, 41800, 36, NULL, NULL, 16, true),
  ('SKYLIFE', 'BUNDLE', '1G+WIFI+TV플러스', '1G', 'TV플러스', 44000, 47400, 36, NULL, NULL, 17, true);

commit;

-- 요약
--   KT       추천 3 / 인터넷+TV결합 6 / 휴대폰정액 3 = 12행
--   SK       추천 3 / 인터넷+TV결합 9 / 휴대폰정액 3 = 15행
--   LG       추천 3 / 인터넷+TV결합 6 / 휴대폰정액 3 = 12행
--   SKYLIFE  추천 3 / 인터넷+TV결합 8 / 휴대폰정액 0 = 11행
--   합계 50행
