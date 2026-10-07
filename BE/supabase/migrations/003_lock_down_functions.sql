-- =====================================================================
-- ⚠ 치명적 보안 결함 차단 — 가장 먼저 적용된다 (파일 번호가 곧 실행 순서)
--
-- 문제
--   001_init_schema.sql 의 `purge_expired_leads()` / `purge_old_access_logs()` 는
--   `security definer` 로 선언돼 소유자 권한으로 동작한다. 그런데 마이그레이션
--   4개 어디에도 `revoke` 가 한 줄도 없다. PostgreSQL 은 함수를 만들 때
--   **PUBLIC 에 EXECUTE 를 기본 부여**하므로, `anon` 역할도 그대로 상속받는다.
--
--   anon 키는 클라이언트 번들에 들어가는 공개 값이다. 따라서 지금은
--   누구나 아래 한 줄로 만료된 리드를 전부 지울 수 있다.
--
--       POST /rest/v1/rpc/purge_expired_leads
--       apikey: <공개 anon 키>
--
--   004_purge_at_by_status.sql 을 적용하면 미개통 접수의 purge_at 이 D+14 로
--   당겨지므로, **이 구멍을 막기 전에 004 를 올리면 거의 모든 리드가
--   외부에서 삭제 가능한 상태**가 된다. 적용 순서를 반드시 지킬 것.
--
-- 함께 처리
--   live_feed 뷰에 '5건 미만이면 노출하지 않는다' 규칙을 심는다.
--   그동안 이 게이트는 Next 라우트(app/api/feed/live)에만 있었고 뷰에는 없어서,
--   공개 anon 키로 뷰를 직접 조회하면 1건만 있어도 그대로 읽혔다.
--   (CLAUDE.md 규칙 1 — 건수가 5건 미만이면 섹션 자체를 렌더링하지 않는다)
-- =====================================================================

-- ── 1. 파기 함수는 스케줄러(service_role)만 호출할 수 있어야 한다 ──────────
revoke all on function purge_expired_leads()   from public, anon, authenticated;
revoke all on function purge_old_access_logs() from public, anon, authenticated;

grant execute on function purge_expired_leads()   to service_role;
grant execute on function purge_old_access_logs() to service_role;

-- ── 2. 트리거 전용 함수는 외부에서 직접 부를 이유가 없다 ──────────────────
--     (PostgREST 는 인자 없는 함수를 RPC 로 노출한다)
revoke all on function touch_updated_at()   from public, anon, authenticated;
revoke all on function log_lead_change()    from public, anon, authenticated;

-- ── 3. is_admin() 은 RLS 정책이 평가할 때 호출되므로 authenticated 에 남긴다.
--     anon 에게는 필요 없다 (anon 이 접근하는 정책에 쓰이지 않는다).
revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- ── 4. 실시간 현황 뷰에 5건 게이트를 심는다 ──────────────────────────────
--     표시 가능한 건수가 5건 미만이면 뷰가 아예 빈 결과를 돌려준다.
--     라우트 쪽 게이트는 그대로 두고 이중으로 건다.
create or replace view live_feed as
select
  to_char(created_at at time zone 'Asia/Seoul', 'YY-MM-DD') as applied_date,
  carrier,
  left(name, 1) || '**'                                     as masked_name,
  case status
    when 'NEW'       then '접수완료'
    when 'CONTACTED' then '진행중'
    when 'RESERVED'  then '진행중'
    when 'INSTALLED' then '설치완료'
    when 'DONE'      then '완료'
  end                                                       as status_label,
  case gift_status
    when 'PENDING'   then '확인중'
    when 'CONFIRMED' then '확인중'
    when 'PAID'      then '지급'
  end                                                       as gift_label
from leads
where status not in ('CANCEL', 'SPAM')
  and (
    select count(*) from leads where status not in ('CANCEL', 'SPAM')
  ) >= 5
order by created_at desc
limit 20;

comment on view live_feed is
  '실시간 신청현황. 실제 leads 만 마스킹해 노출하며, 표시 가능 건수가 5건 미만이면 빈 결과를 반환한다';
