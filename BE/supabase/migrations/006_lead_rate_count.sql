-- =====================================================================
-- 레이트리밋을 anon 이 쓸 수 있는 함수로 옮긴다
--
-- 배경 —
--   `/api/leads` 는 접수 INSERT 에 service_role 이 필요 없다
--   (`leads_public_insert` 정책이 anon INSERT 를 이미 허용한다).
--   service_role 이 필요했던 유일한 이유가 **레이트리밋용 SELECT** 였다.
--   anon 은 leads 를 조회할 수 없기 때문이다.
--
--   그래서 공개 엔드포인트가 RLS 를 통째로 우회하는 키를 쥐고 있었고,
--   그 키가 비면 **접수 자체가 500 으로 전면 중단**됐다.
--   키가 없을 때 레이트리밋만 건너뛰도록 바꿔 중단은 막았지만,
--   그건 '통제가 조용히 꺼지는' 구조라 여전히 좋지 않다.
--
-- 조치 —
--   건수만 돌려주는 `security definer` 함수를 두고 anon 에 execute 를 준다.
--   리드의 **내용은 한 건도 나가지 않는다.** 정수 하나만 반환한다.
--   이걸로 service_role 의존과 fail-open 선택이 동시에 사라진다.
--
-- 노출되는 정보 —
--   호출자가 지정한 IP 의 최근 접수 건수. IP 를 일일이 넣어가며 세는 공격은
--   얻는 게 거의 없고, 그 대가로 공개 경로에서 전권 키를 제거한다.
-- =====================================================================

create or replace function lead_rate_count(p_ip inet, p_since timestamptz)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from leads
  where ip = p_ip
    and created_at >= p_since;
$$;

comment on function lead_rate_count(inet, timestamptz) is
  '동일 IP 의 최근 접수 건수. 접수 레이트리밋 전용 — 건수 외에는 아무것도 반환하지 않는다';

-- 기본 PUBLIC EXECUTE 를 걷어내고 필요한 역할에만 다시 준다
revoke all on function lead_rate_count(inet, timestamptz) from public;
grant execute on function lead_rate_count(inet, timestamptz) to anon, authenticated, service_role;
