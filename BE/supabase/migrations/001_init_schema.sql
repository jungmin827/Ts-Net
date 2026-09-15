-- =====================================================================
-- 통신 인바운드 DB수집 사이트 — 초기 스키마
-- 대상: Supabase (PostgreSQL 15+)
-- 전제: 어드민 계정 1개, 상담사 배분은 엑셀 내보내기로 처리
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. 어드민
--    계정은 1개지만, 추후 읽기전용 계정 추가를 위해 role 컬럼은 남겨둠
-- ---------------------------------------------------------------------
create table admin_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  display_name text,
  role        text not null default 'OWNER'
              check (role in ('OWNER','VIEWER')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 현재 요청자가 어드민인지 판정 (RLS에서 반복 사용)
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from admin_users
    where id = auth.uid() and is_active
  );
$$;

-- ---------------------------------------------------------------------
-- 2. 상담신청 (핵심 자산)
-- ---------------------------------------------------------------------
create table leads (
  id             bigserial primary key,

  -- 개인정보
  name           varchar(50)  not null,
  phone_enc      text         not null,   -- AES-256-GCM 암호문 (앱 레이어에서 암·복호화)
  phone_hash     char(64)     not null,   -- SHA-256(정규화번호 + PEPPER), 중복검사용
  phone_masked   varchar(20)  not null,   -- 010-****-1234, 목록 노출용

  -- 상담 내용
  carrier        varchar(20)  check (carrier in ('KT','SK','LG','SKYLIFE')),
  product        varchar(30),             -- 인터넷 / TV / 인터넷+TV / 인터넷+TV+휴대폰 ...
  memo           text,

  -- 유입 추적 (광고비 손익의 근거)
  utm_source     varchar(100),
  utm_medium     varchar(100),
  utm_campaign   varchar(100),
  utm_content    varchar(100),
  landing_path   varchar(255),
  referrer       text,
  ip             inet,
  user_agent     text,

  -- 동의 (마케팅 동의는 반드시 분리)
  consent_privacy   boolean not null default false,
  consent_marketing boolean not null default false,
  consent_at        timestamptz,

  -- 처리 상태
  status       varchar(20) not null default 'NEW'
               check (status in ('NEW','CONTACTED','RESERVED','INSTALLED','DONE','CANCEL','SPAM')),
  gift_status  varchar(20) not null default 'PENDING'
               check (gift_status in ('PENDING','CONFIRMED','PAID')),
  exported_at  timestamptz,               -- 엑셀로 이미 내보낸 건 표시 (중복 배분 방지)

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- 보유기간 만료일. 파기 배치가 이 날짜를 보고 삭제
  purge_at     date not null default (now() + interval '2 years')::date,

  -- 중복검사용 생성 컬럼 (timestamptz::date 는 immutable 이 아니므로 KST 고정)
  created_on   date generated always as
               (((created_at at time zone 'Asia/Seoul'))::date) stored
);

-- 같은 번호가 같은 날 두 번 접수되는 것 차단
create unique index leads_dedupe_daily_idx on leads (phone_hash, created_on);

create index leads_created_at_idx  on leads (created_at desc);
create index leads_status_idx      on leads (status) where status <> 'SPAM';
create index leads_carrier_idx     on leads (carrier);
create index leads_utm_source_idx  on leads (utm_source);
create index leads_purge_idx       on leads (purge_at);

-- updated_at 자동 갱신
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_touch
  before update on leads
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. 상태 변경 이력
-- ---------------------------------------------------------------------
create table lead_logs (
  id         bigserial primary key,
  lead_id    bigint not null references leads(id) on delete cascade,
  actor_id   uuid references admin_users(id),
  field      varchar(30) not null,
  before_val text,
  after_val  text,
  created_at timestamptz not null default now()
);
create index lead_logs_lead_idx on lead_logs (lead_id, created_at desc);

-- status / gift_status 변경을 자동 기록
create or replace function log_lead_change()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into lead_logs(lead_id, actor_id, field, before_val, after_val)
    values (new.id, auth.uid(), 'status', old.status, new.status);
  end if;
  if new.gift_status is distinct from old.gift_status then
    insert into lead_logs(lead_id, actor_id, field, before_val, after_val)
    values (new.id, auth.uid(), 'gift_status', old.gift_status, new.gift_status);
  end if;
  return new;
end;
$$;

create trigger leads_log_change
  after update on leads
  for each row execute function log_lead_change();

-- ---------------------------------------------------------------------
-- 4. 개인정보 접속기록 — 법정 1년 보관
-- ---------------------------------------------------------------------
create table access_logs (
  id         bigserial primary key,
  actor_id   uuid,
  actor_email text,
  action     varchar(30) not null,   -- LIST / VIEW / DECRYPT / EXPORT / UPDATE / DELETE
  target     varchar(50),
  row_count  integer,
  detail     jsonb,                  -- 조회/내보내기 필터 조건
  ip         inet,
  created_at timestamptz not null default now()
);
create index access_logs_created_idx on access_logs (created_at desc);

-- ---------------------------------------------------------------------
-- 5. 요금제 마스터 (통신사 서브페이지 표 생성용)
-- ---------------------------------------------------------------------
create table plans (
  id              serial primary key,
  carrier         varchar(20) not null check (carrier in ('KT','SK','LG','SKYLIFE')),
  category        varchar(20) not null,   -- INTERNET / TV / BUNDLE
  name            varchar(100) not null,
  speed           varchar(30),            -- 100M / 500M / 1G
  monthly_fee     integer,                -- 원
  contract_months integer default 36,
  gift_amount     integer,                -- 현금 사은품 상한
  description     text,
  sort_order      integer default 0,
  is_active       boolean not null default true,
  updated_at      timestamptz not null default now()
);
create index plans_carrier_idx on plans (carrier, category, sort_order);

-- ---------------------------------------------------------------------
-- 6. 후기 / 정보공유
-- ---------------------------------------------------------------------
create table reviews (
  id            serial primary key,
  title         varchar(200) not null,
  content       text not null,
  author        varchar(50),              -- 노출은 마스킹된 형태로
  rating        smallint check (rating between 1 and 5),
  thumbnail_url text,
  carrier       varchar(20),
  is_published  boolean not null default false,  -- 승인 후 노출
  view_count    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index reviews_pub_idx on reviews (is_published, created_at desc);

create table notices (
  id           serial primary key,
  title        varchar(200) not null,
  content      text not null,
  is_pinned    boolean not null default false,
  is_published boolean not null default true,
  view_count   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index notices_pub_idx on notices (is_published, is_pinned desc, created_at desc);

-- ---------------------------------------------------------------------
-- 7. 실시간 신청현황 뷰
--    실제 접수 데이터만 마스킹해서 노출 (허위 데이터 생성 금지)
-- ---------------------------------------------------------------------
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
where status not in ('CANCEL','SPAM')
order by created_at desc
limit 20;

-- ---------------------------------------------------------------------
-- 8. RLS
--    anon 은 leads 에 INSERT 만 가능. 조회·수정은 어드민만.
-- ---------------------------------------------------------------------
alter table leads       enable row level security;
alter table lead_logs   enable row level security;
alter table access_logs enable row level security;
alter table admin_users enable row level security;
alter table plans       enable row level security;
alter table reviews     enable row level security;
alter table notices     enable row level security;

-- 폼 접수: 누구나 INSERT, 단 개인정보 동의 필수
create policy leads_public_insert on leads
  for insert to anon, authenticated
  with check (consent_privacy = true);

-- 어드민만 조회/수정
create policy leads_admin_select on leads
  for select to authenticated using (is_admin());
create policy leads_admin_update on leads
  for update to authenticated using (is_admin());

create policy logs_admin_select on lead_logs
  for select to authenticated using (is_admin());
create policy access_admin_select on access_logs
  for select to authenticated using (is_admin());
create policy admin_self_select on admin_users
  for select to authenticated using (id = auth.uid());

-- 공개 콘텐츠는 게시된 것만 읽기 허용
create policy plans_public_read on plans
  for select to anon, authenticated using (is_active);
create policy reviews_public_read on reviews
  for select to anon, authenticated using (is_published);
create policy notices_public_read on notices
  for select to anon, authenticated using (is_published);

-- 콘텐츠 쓰기는 어드민만
create policy plans_admin_write on plans
  for all to authenticated using (is_admin()) with check (is_admin());
create policy reviews_admin_write on reviews
  for all to authenticated using (is_admin()) with check (is_admin());
create policy notices_admin_write on notices
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- 9. 보유기간 만료 자동 파기
--    pg_cron 으로 매일 03:00 KST 실행 (Supabase Dashboard 에서 활성화)
-- ---------------------------------------------------------------------
create or replace function purge_expired_leads()
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  with d as (delete from leads where purge_at < current_date returning 1)
  select count(*) into n from d;

  insert into access_logs(action, target, row_count, detail)
  values ('DELETE', 'leads', n, jsonb_build_object('reason','retention_expired'));

  return n;
end;
$$;

-- select cron.schedule('purge-leads', '0 18 * * *', $$select purge_expired_leads()$$);
-- ↑ 18:00 UTC = 03:00 KST

-- 접속기록 1년 경과분 정리
create or replace function purge_old_access_logs()
returns void
language sql security definer set search_path = public
as $$
  delete from access_logs where created_at < now() - interval '1 year';
$$;
