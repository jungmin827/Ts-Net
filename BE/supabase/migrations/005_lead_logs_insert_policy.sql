-- =====================================================================
-- lead_logs 에 INSERT 경로를 열어 변경 이력의 주체(actor_id)를 남긴다
--
-- 배경 — 001_init_schema.sql 은 lead_logs 에 SELECT 정책만 두었다.
-- 그래서 leads 변경 트리거(log_lead_change)가 authenticated 세션으로 돌 때
-- RLS 에 막혔고, 어드민 구현은 상태 변경 쓰기를 service_role 클라이언트로
-- 우회할 수밖에 없었다. 그 결과 lead_logs.actor_id 가 항상 NULL 로 남는다
-- (누가 바꿨는지는 access_logs 에만 남아 두 테이블을 대조해야 한다).
--
-- 조치 두 가지
--   1) 트리거 함수를 SECURITY DEFINER 로 올려 RLS 를 통과시킨다.
--      이력 기록은 '시스템이 반드시 수행해야 하는 일'이라 호출자 권한에 맡기지 않는다.
--   2) 어드민에게 INSERT 정책을 열어, 트리거 밖에서 수동 기록이 필요할 때도 남을 수 있게 한다.
--
-- 이 마이그레이션 이후 어드민은 세션 클라이언트로 leads 를 수정할 수 있고
-- actor_id 가 실제 수정자로 채워진다.
-- =====================================================================

-- 트리거 함수가 RLS 를 통과하도록. search_path 를 고정해 함수 하이재킹을 막는다.
alter function log_lead_change() security definer;
alter function log_lead_change() set search_path = public, pg_temp;

-- 어드민이 직접 이력을 남겨야 할 때의 경로
drop policy if exists lead_logs_admin_insert on lead_logs;
create policy lead_logs_admin_insert on lead_logs
  for insert to authenticated
  with check (is_admin());

comment on policy lead_logs_admin_insert on lead_logs is
  '어드민 수동 기록용. 통상 경로는 leads 변경 트리거(log_lead_change, SECURITY DEFINER)';
