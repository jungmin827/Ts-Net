-- =====================================================================
-- leads.purge_at 을 화면 고지와 일치시킨다
--
-- 배경 — 화면의 개인정보 동의 문구(FE/lib/site-config.ts CONSENT.privacyDetail)는
--   "③ 보유, 이용기간 : 개통 완료시 D+1095일 단순상담시 D+14일 후
--     식별불가 암호화 파쇄"
-- 라고 고지한다. 그런데 001_init_schema.sql 의 기본값은 접수 종류와 무관하게
-- `now() + interval '2 years'` 였다. 고지한 기간보다 **실제 보관이 더 긴 구간**
-- (단순상담 14일 고지 → 실제 730일)이 생겨 고지가 거짓이 된다.
--
-- ⚠⚠ 운영상 중대한 귀결 ⚠⚠
--   이 마이그레이션 이후 **개통되지 않은 접수는 14일 뒤 파기 대상**이 된다.
--   상담 중이거나 보류 중인 건도 status 가 INSTALLED/DONE 이 아니면 마찬가지다.
--   → 파기 전에 엑셀로 내보내 오프라인 배분하는 운영 흐름이 전제되어야 한다.
--   → 14일이 운영에 맞지 않으면 **DB 를 늘리는 게 아니라 고지 문구를 먼저 고쳐야** 한다.
--      (고지 < 실제 보관 = 위법. 고지 > 실제 보관 = 적법하나 불필요)
--
-- 되돌리기: 아래 트리거와 함수를 drop 하면 001 의 기본값 동작으로 돌아간다.
-- =====================================================================

-- '개통 완료'로 볼 상태. 설치가 끝났거나 건이 종결된 경우다.
create or replace function lead_is_activated(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status in ('INSTALLED', 'DONE');
$$;

comment on function lead_is_activated(text) is
  '개통 완료 여부. 보유기간 산정(D+1095 vs D+14)의 유일한 기준';

create or replace function set_lead_purge_at()
returns trigger
language plpgsql
as $$
begin
  -- 기준일은 수집일(created_at)이다. 상태가 바뀌어도 기준일은 움직이지 않는다.
  new.purge_at := (
    new.created_at
    + case when lead_is_activated(new.status) then interval '1095 days'
           else interval '14 days'
      end
  )::date;
  return new;
end;
$$;

comment on function set_lead_purge_at() is
  '화면 고지와 보유기간을 일치시킨다. 고지: 개통 완료시 D+1095일 / 단순상담시 D+14일';

-- insert 와 status 변경 양쪽에서 다시 계산한다.
-- (상담 → 개통으로 올라가면 보유기간이 14일에서 1095일로 연장된다)
drop trigger if exists leads_set_purge_at on leads;
create trigger leads_set_purge_at
  before insert or update of status on leads
  for each row
  execute function set_lead_purge_at();

-- 기존 행 백필. 트리거는 앞으로 들어올 행만 처리하므로 한 번 맞춰 준다.
update leads
set purge_at = (
  created_at
  + case when lead_is_activated(status) then interval '1095 days'
         else interval '14 days'
    end
)::date
where purge_at is distinct from (
  created_at
  + case when lead_is_activated(status) then interval '1095 days'
         else interval '14 days'
    end
)::date;
