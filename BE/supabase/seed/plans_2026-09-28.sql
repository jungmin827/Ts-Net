-- =====================================================================
-- plans 시드 — 통신사 4사 요금표
--
-- 출처: 레퍼런스 사이트 통신사 서브페이지, 수집일 2026-09-28
-- 수집 방식: 페이지 전문 추출 + DOM 직접 덤프 + 스크린샷 육안 대조 (3중 교차검증)
--
-- ⚠ 이 수치는 **타사가 게시한 가격**이다. 통신사 표준요금·결합할인에 기반하지만
--    우리 계약 조건과 일치한다는 보장이 없다.
--    **런칭 전 각 통신사 실제 계약 조건으로 반드시 재검증할 것.**
--
-- 전제 (원문 각주): 3년 약정, 휴대폰 1회선 결합 할인 기준, VAT 포함가
--   → contract_months = 36
-- 사은품(현금 지원금) 컬럼은 원본 요금표에 없다 → gift_amount 는 전부 NULL.
--   근거 없는 사은품 금액을 만들어 넣지 않는다 (CLAUDE.md 규칙 6).
--
-- 실행:
--   psql "$DB_URL" -f BE/supabase/seed/plans_2026-09-28.sql
-- 참고: plans.category 에는 DB 체크 제약이 없어(주석뿐) MOBILE 추가에 마이그레이션이 불필요하다.
-- =====================================================================

begin;

-- 재실행 가능하도록 이 시드가 넣는 범위만 비운다
delete from plans where carrier in ('KT','SK','LG','SKYLIFE');

insert into plans
  (carrier, category, name, speed, monthly_fee, contract_months, gift_amount, description, sort_order, is_active)
values
  ('KT', 'BUNDLE', '인터넷와이드', '500M+WIFI포함', 45100, 36, NULL, '끊김 없이, 빠르게! 유선통신 중심 DPS · TV: TV베이직 · 정가 50,600원', 1, true),
  ('KT', 'BUNDLE', 'KT 오피스넷', '500M', 50600, 36, NULL, '속도와 안정성의 만남, 유선 DPS 솔루션! · TV: TV모든G · 정가 56,100원', 2, true),
  ('KT', 'BUNDLE', '프리미엄 결합', '1G', 55000, 36, NULL, '미세한 변화까지 감지하는 스마트 TPS! · TV: TV모든G · 정가 60,500원', 3, true),
  ('KT', 'BUNDLE', '100M+WIFI+TV베이직', '100M', 39600, 36, NULL, NULL, 10, true),
  ('KT', 'BUNDLE', '500M+WIFI+TV베이직', '500M', 45100, 36, NULL, '총요금 50,600원 → 결합 할인가', 11, true),
  ('KT', 'BUNDLE', '1G+WIFI+TV베이직', '1G', 49500, 36, NULL, '총요금 56,000원 → 결합 할인가', 12, true),
  ('KT', 'BUNDLE', '100M+WIFI+TV모든G', '100M', 45100, 36, NULL, NULL, 13, true),
  ('KT', 'BUNDLE', '500M+WIFI+TV모든G', '500M', 50600, 36, NULL, '총요금 56,100원 → 결합 할인가', 14, true),
  ('KT', 'BUNDLE', '1G+WIFI+TV모든G', '1G', 55000, 36, NULL, '총요금 60,500원 → 결합 할인가', 15, true),
  ('KT', 'MOBILE', '거의 안씀(5G 슬림 4GB)', NULL, 24750, 36, NULL, '총요금 27,750원 → 결합 할인가', 50, true),
  ('KT', 'MOBILE', '기본 데이터(5G 슬림 10GB)', NULL, 34750, 36, NULL, '총요금 37,500원 → 결합 할인가', 51, true),
  ('KT', 'MOBILE', '완전 무제한(5G 베이직)', NULL, 53000, 36, NULL, '총요금 60,000원 → 결합 할인가', 52, true),
  ('SK', 'BUNDLE', '베이직 결합', '500M+WIFI포함', 42900, 36, NULL, '끊김 없이, 빠르게! 유선통신 중심 DPS · TV: TV이코노미 · 정가 50,600원', 1, true),
  ('SK', 'BUNDLE', '스탠다드 결합', '500M+WIFI포함', 46200, 36, NULL, '속도와 안정성의 만남, 유선 DPS 솔루션! · TV: TV스탠다드 · 정가 53,900원', 2, true),
  ('SK', 'BUNDLE', '프리미엄 결합', '1G+WIFI포함', 60500, 36, NULL, '미세한 변화까지 감지하는 스마트 TPS! · TV: TV올플 · 정가 68,200원', 3, true),
  ('SK', 'BUNDLE', '100M+WIFI+TV이코노미', '100M', 36300, 36, NULL, '총요금 39,600원 → 결합 할인가', 10, true),
  ('SK', 'BUNDLE', '500M+WIFI+TV이코노미', '500M', 48400, 36, NULL, '총요금 50,600원 → 결합 할인가', 11, true),
  ('SK', 'BUNDLE', '1G+WIFI+TV이코노미', '1G', 48400, 36, NULL, '총요금 56,100원 → 결합 할인가', 12, true),
  ('SK', 'BUNDLE', '100M+WIFI+TV스탠다드', '100M', 39600, 36, NULL, '총요금 42,900원 → 결합 할인가', 13, true),
  ('SK', 'BUNDLE', '500M+WIFI+T스탠다드', '500M', 50600, 36, NULL, '총요금 56,100원 → 결합 할인가', 14, true),
  ('SK', 'BUNDLE', '1G+WIFI+TV스탠다드', '1G', 51700, 36, NULL, '총요금 53,900원 → 결합 할인가', 15, true),
  ('SK', 'BUNDLE', '100M+WIFI+TV올플', '100M', 48400, 36, NULL, '총요금 51,700원 → 결합 할인가', 16, true),
  ('SK', 'BUNDLE', '500M+WIFI+TV올플', '500M', 55000, 36, NULL, '총요금 62,700원 → 결합 할인가', 17, true),
  ('SK', 'BUNDLE', '1G+WIFI+TV올플', '1G', 60500, 36, NULL, '총요금 68,200원 → 결합 할인가', 18, true),
  ('SK', 'MOBILE', '거의 안씀(5G 컴팩트 6GB)', NULL, 29250, 36, NULL, '총요금 39,000원 → 결합 할인가', 50, true),
  ('SK', 'MOBILE', '기본 데이터(5G 컴팩트플러스 8GB)', NULL, 33750, 36, NULL, '총요금 45,000원 → 결합 할인가', 51, true),
  ('SK', 'MOBILE', '완전 무제한(5G 프라임)', NULL, 66750, 36, NULL, '총요금 89,000원 → 결합 할인가', 52, true),
  ('LG', 'BUNDLE', '베이직 결합', '500MB+WIFI포함', 45100, 36, NULL, '끊김 없이, 빠르게! 유선통신 중심 DPS · TV: TV 실속형 · 정가 52,800원', 1, true),
  ('LG', 'BUNDLE', '스탠다드 결합', '500MB+WIFI포함', 48400, 36, NULL, '속도와 안정성의 만남, 유선 DPS 솔루션! · TV: TV 프리미엄 · 정가 57,200원', 2, true),
  ('LG', 'BUNDLE', '프리미엄 결합', '1G+WIFI포함', 53900, 36, NULL, '미세한 변화까지 감지하는 스마트 TPS! · TV: TV 프리미엄 · 정가 61,600원', 3, true),
  ('LG', 'BUNDLE', '100M+WIFI+TV실속형', '100M', 29600, 36, NULL, '총요금 41,800원 → 결합 할인가', 10, true),
  ('LG', 'BUNDLE', '500M+WIFI+TV실속형', '500M', 45100, 36, NULL, '총요금 52,800원 → 결합 할인가', 11, true),
  ('LG', 'BUNDLE', '1G+WIFI+TV실속형', '1G', 49500, 36, NULL, '총요금 58,300원 → 결합 할인가', 12, true),
  ('LG', 'BUNDLE', '100M+WIFI+TV프리미엄', '100M', 42900, 36, NULL, '총요금 46,200원 → 결합 할인가', 13, true),
  ('LG', 'BUNDLE', '500M+WIFI+TV프리미엄', '500M', 48400, 36, NULL, '총요금 57,200원 → 결합 할인가', 14, true),
  ('LG', 'BUNDLE', '1G+WIFI+TV프리미엄', '1G', 53900, 36, NULL, '총요금 61,600원 → 결합 할인가', 15, true),
  ('LG', 'MOBILE', '거의 안씀(5G 슬림+)', NULL, 35250, 36, NULL, '총요금 47,000원 → 결합 할인가', 50, true),
  ('LG', 'MOBILE', '기본 데이터(5G 심플+)', NULL, 45750, 36, NULL, '총요금 61,000원 → 결합 할인가', 51, true),
  ('LG', 'MOBILE', '완전 무제한(5G 프리미엄에센셜)', NULL, 63750, 36, NULL, '총요금 85,000원 → 결합 할인가', 52, true),
  ('SKYLIFE', 'BUNDLE', '베이직 결합', '500MB+WIFI포함', 37400, 36, NULL, '끊김 없이, 빠르게! 유선통신 중심 DPS · TV: TV베이직 · 정가 40,700원', 1, true),
  ('SKYLIFE', 'BUNDLE', '스탠다드 결합', '500MB+WIFI포함', 38500, 36, NULL, '속도와 안정성의 만남, 유선 DPS 솔루션! · TV: TV플러스 · 정가 41,800원', 2, true),
  ('SKYLIFE', 'BUNDLE', '프리미엄 결합', '1G+WIFI포함', 44000, 36, NULL, '미세한 변화까지 감지하는 스마트 TPS! · TV: TV플러스 · 정가 47,300원', 3, true),
  ('SKYLIFE', 'BUNDLE', '100M+WIFI+TV베이직', '100M', 30800, 36, NULL, '총요금 34,100원 → 결합 할인가', 10, true),
  ('SKYLIFE', 'BUNDLE', '200M+WIFI+TV베이직', '200M', 31900, 36, NULL, '총요금 35,200원 → 결합 할인가', 11, true),
  ('SKYLIFE', 'BUNDLE', '500M+WIFI+TV베이직', '500M', 37400, 36, NULL, '총요금 40,700원 → 결합 할인가', 12, true),
  ('SKYLIFE', 'BUNDLE', '1G+WIFI+TV베이직', '1G', 42900, 36, NULL, '총요금 46,200원 → 결합 할인가', 13, true),
  ('SKYLIFE', 'BUNDLE', '100M+WIFI+TV플러스', '100M', 31900, 36, NULL, '총요금 35,200원 → 결합 할인가', 14, true),
  ('SKYLIFE', 'BUNDLE', '200M+WIFI+TV플러스', '200M', 33000, 36, NULL, '총요금 36,300원 → 결합 할인가', 15, true),
  ('SKYLIFE', 'BUNDLE', '500M+WIFI+TV플러스', '500M', 38500, 36, NULL, '총요금 41,800원 → 결합 할인가', 16, true),
  ('SKYLIFE', 'BUNDLE', '1G+WIFI+TV플러스', '1G', 44000, 36, NULL, '총요금 47,400원 → 결합 할인가', 17, true);

commit;

-- 요약
--   KT       추천 3 / 인터넷+TV결합 6 / 휴대폰정액 3 = 12행
--   SK       추천 3 / 인터넷+TV결합 9 / 휴대폰정액 3 = 15행
--   LG       추천 3 / 인터넷+TV결합 6 / 휴대폰정액 3 = 12행
--   SKYLIFE  추천 3 / 인터넷+TV결합 8 / 휴대폰정액 0 = 11행
--   합계 50행
