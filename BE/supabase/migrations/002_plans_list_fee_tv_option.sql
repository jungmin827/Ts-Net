-- =====================================================================
-- plans 확장 — 할인 전 총요금과 TV 구성을 정식 컬럼으로 올린다.
--
-- 두 값은 그동안 description 문자열에 묻혀 있었다("총요금 50,600원 → 결합 할인가").
-- 화면에서 취소선 비교를 하고 요금 계산기의 축으로 쓰려면 구조화된 값이 필요하다.
-- 기존 컬럼·행은 건드리지 않는 additive 변경.
-- =====================================================================

alter table plans add column if not exists list_fee  integer;
alter table plans add column if not exists tv_option varchar(40);

comment on column plans.list_fee  is '할인 전 총요금(월, 원). 화면에서 monthly_fee 옆에 취소선으로 노출';
comment on column plans.tv_option is 'TV 구성명(예: TV베이직). 요금 계산기의 TV 축. 인터넷 단독이면 null';
