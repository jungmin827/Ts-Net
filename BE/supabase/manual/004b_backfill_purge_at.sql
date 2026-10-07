-- =====================================================================
-- 기존 행의 purge_at 백필 — **수동 실행 전용**
--
-- 이 파일은 `migrations/` 밖에 있다. `supabase db push` 로 적용되지 않는다.
-- 일부러 그렇게 두었다.
--
-- 004 의 트리거는 앞으로 들어올 행만 처리한다. 이미 보관 중인 행까지 맞추려면
-- 아래 UPDATE 가 필요한데, 그 순간 **과거 접수의 파기 예정일이 당겨진다.**
-- `pg_cron` 이 켜져 있으면 그 날짜에 `purge_expired_leads()` 가 행을 지우고,
-- 전화번호 암호문까지 함께 사라진다. 되돌릴 수 없다.
--
-- 그래서 순서가 있다.
--   1) 아래 STEP 1 을 먼저 돌려 **무엇이 얼마나 당겨지는지** 눈으로 본다.
--   2) 숫자를 보고 납득했을 때만 STEP 2 를 돌린다.
--   3) 즉시 삭제 대상이 생긴다면( purge_at <= today ) 먼저 그 건들의 상태를
--      바로잡는다. 상담이 진행 중인데 status 가 NEW 로 남아 있는 건들이 대개 그렇다.
-- =====================================================================

-- ── STEP 1. 영향 범위 확인 (읽기 전용) ───────────────────────────────
select
  status,
  count(*)                                              as 건수,
  min(purge_at)                                         as 현재_가장_이른_파기일,
  min((created_at + case when lead_is_activated(status)
                         then interval '1095 days'
                         else interval '14 days' end)::date) as 변경후_가장_이른_파기일,
  count(*) filter (
    where (created_at + case when lead_is_activated(status)
                             then interval '1095 days'
                             else interval '14 days' end)::date <= current_date
  )                                                     as 즉시_삭제대상
from leads
group by status
order by status;

-- ── STEP 2. 실제 백필 (STEP 1 을 확인한 뒤에만) ──────────────────────
-- 즉시 삭제 대상이 0 이 아니면 **먼저 그 건들을 처리하고 나서** 실행할 것.
--
-- update leads
-- set purge_at = (
--   created_at
--   + case when lead_is_activated(status) then interval '1095 days'
--          else interval '14 days'
--     end
-- )::date
-- where purge_at is distinct from (
--   created_at
--   + case when lead_is_activated(status) then interval '1095 days'
--          else interval '14 days'
--     end
-- )::date;
