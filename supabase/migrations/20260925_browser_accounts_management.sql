-- Passwordless public accounts, consultation capture and management reporting.
begin;

create table if not exists public.browser_accounts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default 'SIAOS Member' check (char_length(full_name) between 2 and 120),
  email text not null check (email=lower(email) and char_length(email)<=254),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  country_code text not null default '91' check (country_code ~ '^[1-9][0-9]{0,3}$'),
  marketing_opt_in boolean not null default false,
  terms_accepted_at timestamptz,
  deletion_token_hash text not null check (deletion_token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  unique(email,phone)
);

create table if not exists public.browser_consultations (
  id uuid primary key,
  account_id uuid not null references public.browser_accounts(id) on delete cascade,
  service text not null check(service in ('kundli','numerology','vastu','tarot','face','paranormal')),
  service_name text not null check(char_length(service_name) between 2 and 120),
  related_service text not null check(char_length(related_service) between 2 and 160),
  appointment_start timestamptz not null,
  consultation_mode text not null check(char_length(consultation_mode) between 2 and 100),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'requested' check(status in ('requested','contacted','confirmed','completed','cancelled','no_show')),
  consent_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists browser_accounts_created_idx on public.browser_accounts(created_at desc);
create index if not exists browser_consultations_account_idx on public.browser_consultations(account_id,submitted_at desc);
create index if not exists browser_consultations_start_idx on public.browser_consultations(appointment_start,status);

alter table public.browser_accounts enable row level security;
alter table public.browser_consultations enable row level security;
revoke all on public.browser_accounts,public.browser_consultations from public,anon,authenticated;
grant all on public.browser_accounts,public.browser_consultations to service_role;

create or replace function public.admin_dashboard_summary(requested_days integer default 30)
returns jsonb language sql security definer set search_path='' as $$
  with bounds as (select now()-make_interval(days=>least(greatest(requested_days,1),365)) since),
  filtered as (select * from public.analytics_events where occurred_at >= (select since from bounds)),
  totals as (select count(*) filter(where event_name='page_view') page_views,count(*) filter(where event_name='click') clicks,
    count(distinct session_id) sessions,count(distinct anonymous_id) visitors from filtered),
  pages as (select coalesce(jsonb_agg(row_to_json(p) order by p.views desc),'[]'::jsonb) value from
    (select path,count(*) views,count(distinct session_id) sessions from filtered where event_name='page_view' group by path order by views desc limit 15) p),
  clicks as (select coalesce(jsonb_agg(row_to_json(c) order by c.clicks desc),'[]'::jsonb) value from
    (select path,target,count(*) clicks from filtered where event_name in ('click','outbound_click') group by path,target order by clicks desc limit 20) c),
  daily as (select coalesce(jsonb_agg(row_to_json(d) order by d.day),'[]'::jsonb) value from
    (select occurred_at::date as day,count(*) filter(where event_name='page_view') views,count(distinct session_id) sessions from filtered group by occurred_at::date) d),
  business as (select
    (select count(*) from public.browser_accounts) customers,
    (select count(*) from public.browser_accounts where created_at >= (select since from bounds)) new_customers,
    (select count(*) from public.browser_consultations where submitted_at >= (select since from bounds)) consultations,
    (select count(*) from public.browser_consultations where status in ('requested','contacted')) consultations_pending,
    (select count(*) from public.product_orders where ordered_at >= (select since from bounds)) product_orders,
    (select count(*) from public.payment_transactions where created_at >= (select since from bounds)) payment_attempts,
    (select count(*) from public.payment_transactions where status in ('paid','refunded') and paid_at >= (select since from bounds)) paid_orders,
    (select coalesce(sum(amount-refunded_amount),0) from public.payment_transactions where status in ('paid','refunded') and paid_at >= (select since from bounds)) revenue_paise,
    (select count(*) from public.refund_requests where status in ('requested','processing','review_required')) refunds_pending),
  integrations as (select last_success sheets_last_success,last_error sheets_last_error from public.integration_jobs where name='sheets')
  select jsonb_build_object('periodDays',least(greatest(requested_days,1),365),'totals',to_jsonb(totals.*),'business',to_jsonb(business.*),
    'integrations',coalesce((select to_jsonb(integrations.*) from integrations),jsonb_build_object('sheets_last_success',null,'sheets_last_error',null)),
    'topPages',pages.value,'topClicks',clicks.value,'daily',daily.value)
  from totals,business,pages,clicks,daily;
$$;

revoke all on function public.admin_dashboard_summary(integer) from public,anon,authenticated;
grant execute on function public.admin_dashboard_summary(integer) to service_role;

commit;
