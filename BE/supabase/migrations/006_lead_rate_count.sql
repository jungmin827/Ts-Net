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
--   **초과 여부 한 비트만** 돌려주는 `security definer` 함수를 두고
--   anon 에 execute 를 준다. 리드의 내용은 한 건도 나가지 않는다.
--   이걸로 service_role 의존과 fail-open 선택이 동시에 사라진다.
--
-- ⚠ 첫 설계는 `lead_rate_count(p_ip inet, p_since timestamptz) returns integer`
--   였고, 노출 평가를 "IP 를 일일이 넣어가며 세는 공격은 얻는 게 거의 없다"로
--   적었다. 그 평가는 **IPv4 전수 탐색만 상정한 오판**이다. 실제 위협은
--   전수가 아니라 표적 1건 확인이다. 건수와 `p_since` 자유 지정을 함께 열면
--   공개 anon 키만으로
--     · 특정 IP 가 접수했는지 확인하고
--     · `p_since` 를 이분 탐색해 **접수 시각을 초 단위까지 특정**하고
--     · 회사·학교 고정 IP 로 "그 조직에서 누가 신청했는지" 좁힐
--   수 있다. "이 사람이 통신사를 바꾸려 한다"는 사실 자체가 개인정보이며,
--   경쟁 대리점에 그 조회 수단을 우리가 공개 키로 쥐여주는 꼴이 된다.
--
--   그래서 이 파일은 적용 전에 아래와 같이 좁혔다 —
--     · 반환을 boolean(초과 여부)으로. 건수를 주지 않는다.
--     · `p_since` 를 **인자에서 제거**. 창(10분)·임계치(3건)를 함수 안에 고정해
--       호출자가 시간 축을 움직이지 못하게 한다.
--   남는 유출은 "이 IP 가 최근 10분 내 3건을 넘겼는가" 한 비트뿐이고,
--   레이트리밋 기능은 그대로다.
--
-- ⚠ 임계치를 바꾸려면 이 함수를 고치는 **새 마이그레이션**이 필요하다.
--   앱 상수로 두면 다시 호출자가 정하는 구조가 되므로 의도적으로 DB 에 둔다.
--   FE 의 RATE_LIMIT_* 상수는 이 값과 맞춘 **문서용 사본**이다.
-- =====================================================================

-- 건수를 반환하던 이전 시그니처가 (수동 적용 등으로) 남아 있다면 걷어낸다
drop function if exists lead_rate_count(inet, timestamptz);

create or replace function lead_rate_exceeded(p_ip inet)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) >= 3
  from (
    select 1
    from leads
    where ip = p_ip
      and created_at >= now() - interval '10 minutes'
    limit 3
  ) s;
$$;

comment on function lead_rate_exceeded(inet) is
  '동일 IP 가 최근 10분 내 접수 3건을 채웠는지 여부. 접수 레이트리밋 전용 — '
  '건수·시각 등 어떤 값도 반환하지 않고 boolean 한 비트만 돌려준다';

-- 기본 PUBLIC EXECUTE 를 걷어내고 필요한 역할에만 다시 준다
revoke all on function lead_rate_exceeded(inet) from public;
grant execute on function lead_rate_exceeded(inet) to anon, authenticated, service_role;
