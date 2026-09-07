-- SIAOS account history and 15-day purchased report access.
-- Run in a new Supabase project's SQL editor before adding the public configuration.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  country_code text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists country_code text;

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_type text not null check (reading_type in ('compatibility','tarot','kundli','numerology','vastu','face','paranormal')),
  title text not null,
  summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  client_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (user_id,client_fingerprint)
);

create table if not exists public.report_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null,
  title text not null,
  payment_reference text not null unique,
  status text not null default 'paid' check (status in ('paid','refunded','cancelled')),
  purchased_at timestamptz not null default now(),
  access_expires_at timestamptz not null default (now() + interval '15 days'),
  created_at timestamptz not null default now()
);

create table if not exists public.report_documents (
  report_id uuid primary key references public.report_purchases(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.product_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null unique,
  payment_reference text unique,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','cancelled')),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','confirmed','processing','dispatched','delivered','cancelled','returned')),
  currency text not null default 'INR',
  subtotal numeric(12,2) not null default 0,
  shipping_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  delivery_address jsonb not null default '{}'::jsonb,
  tracking_reference text,
  ordered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.enforce_report_access_window()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.access_expires_at := new.purchased_at + interval '15 days';
  return new;
end;
$$;

drop trigger if exists report_access_window on public.report_purchases;
create trigger report_access_window before insert or update of purchased_at,access_expires_at
on public.report_purchases for each row execute function public.enforce_report_access_window();

create index if not exists readings_user_created_idx on public.readings(user_id,created_at desc);
create index if not exists report_purchases_user_created_idx on public.report_purchases(user_id,purchased_at desc);
create index if not exists product_orders_user_created_idx on public.product_orders(user_id,ordered_at desc);

alter table public.profiles enable row level security;
alter table public.readings enable row level security;
alter table public.report_purchases enable row level security;
alter table public.report_documents enable row level security;
alter table public.product_orders enable row level security;

revoke all on table public.profiles,public.readings,public.report_purchases,public.report_documents,public.product_orders from anon,authenticated;
grant select,insert,update,delete on table public.profiles to authenticated;
grant select,insert,delete on table public.readings to authenticated;
grant select on table public.report_purchases,public.report_documents to authenticated;
grant select on table public.product_orders to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "readings_select_own" on public.readings for select to authenticated using ((select auth.uid()) = user_id);
create policy "readings_insert_own" on public.readings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "readings_delete_own" on public.readings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "report_history_select_own" on public.report_purchases for select to authenticated using ((select auth.uid()) = user_id);
create policy "active_report_document_select_own" on public.report_documents for select to authenticated using (
  exists (
    select 1 from public.report_purchases purchase
    where purchase.id = report_documents.report_id
      and purchase.user_id = (select auth.uid())
      and purchase.status = 'paid'
      and now() < purchase.access_expires_at
  )
);

create policy "product_orders_select_own" on public.product_orders for select to authenticated using ((select auth.uid()) = user_id);

-- Payment webhooks use the server-only service role to insert reports and product orders,
-- and to update payment, fulfilment and tracking statuses.
-- Never put the service-role key in browser JavaScript or GitHub.

-- Backend-owned consultation, analytics, YouTube and payment data.
create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (service in ('kundli','numerology','vastu','tarot','face','paranormal')),
  service_name text not null,
  related_service text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','contacted','scheduled','completed','cancelled')),
  internal_notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in ('page_view','click','scroll_depth','form_start','form_submit','checkout_start','outbound_click')),
  session_id uuid not null,
  anonymous_id uuid not null,
  path text not null,
  referrer text not null default '',
  target text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create table if not exists public.youtube_channel_snapshots (
  id bigint generated always as identity primary key,
  channel_id text not null,
  handle text not null,
  title text not null,
  subscriber_count bigint not null default 0,
  video_count bigint not null default 0,
  view_count bigint not null default 0,
  fetched_at timestamptz not null default now()
);

create table if not exists public.youtube_videos (
  video_id text primary key,
  title text not null,
  description text not null default '',
  thumbnail_url text not null default '',
  published_at timestamptz not null,
  position integer not null default 0,
  is_live boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  gateway text not null check (gateway in ('razorpay')),
  gateway_order_id text not null unique,
  gateway_payment_id text unique,
  receipt text not null unique,
  kind text not null check (kind in ('product','report','consultation')),
  item_slug text not null,
  item_name text not null,
  quantity integer not null default 1 check (quantity between 1 and 10),
  amount bigint not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created','authorized','paid','failed','refunded','cancelled')),
  raw_status text,
  method text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_webhook_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (service in ('kundli','numerology','vastu','tarot','face','paranormal')),
  related_service text not null,
  consultation_mode text not null default 'On-call consultation',
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'held' check (status in ('held','confirmed','cancelled','completed','no_show')),
  hold_expires_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at = start_at + interval '30 minutes')
);

create unique index if not exists appointments_active_start_idx on public.appointments(start_at) where status in ('held','confirmed');
create index if not exists appointments_user_start_idx on public.appointments(user_id,start_at desc);

alter table public.appointments enable row level security;
revoke all on table public.appointments from anon,authenticated;
grant select on table public.appointments to authenticated;
drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own" on public.appointments for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.available_appointment_slots(p_date date)
returns table(start_at timestamptz,label text)
language sql stable security definer set search_path = public as $$
  select candidate.start_at,
         to_char(candidate.start_at at time zone 'Asia/Kolkata','FMHH12:MI AM') || ' – ' ||
         to_char((candidate.start_at + interval '30 minutes') at time zone 'Asia/Kolkata','FMHH12:MI AM')
  from (
    select make_timestamptz(extract(year from p_date)::int,extract(month from p_date)::int,extract(day from p_date)::int,hour_value,0,0,'Asia/Kolkata') start_at
    from generate_series(10,18) hour_value
  ) candidate
  where p_date between current_date and current_date + 31
    and extract(isodow from p_date) between 1 and 6
    and candidate.start_at > now()
    and not exists (
      select 1 from public.appointments booked
      where booked.start_at = candidate.start_at
        and (booked.status = 'confirmed' or (booked.status = 'held' and booked.hold_expires_at > now()))
    )
  order by candidate.start_at;
$$;

create or replace function public.hold_appointment_slot(p_service text,p_related_service text,p_consultation_mode text,p_start_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in before reserving an appointment.'; end if;
  if p_service not in ('kundli','numerology','vastu','tarot','face','paranormal') then raise exception 'Invalid service.'; end if;
  if (p_start_at at time zone 'Asia/Kolkata')::date not between current_date and current_date + 31
     or extract(isodow from p_start_at at time zone 'Asia/Kolkata') not between 1 and 6
     or extract(minute from p_start_at at time zone 'Asia/Kolkata') <> 0
     or extract(hour from p_start_at at time zone 'Asia/Kolkata') not between 10 and 18
     or p_start_at <= now() then raise exception 'This appointment time is not available.'; end if;
  update public.appointments set status='cancelled',updated_at=now() where status='held' and hold_expires_at <= now();
  insert into public.appointments(user_id,service,related_service,consultation_mode,start_at,end_at,status,hold_expires_at)
  values(auth.uid(),p_service,left(p_related_service,160),left(coalesce(p_consultation_mode,'On-call consultation'),100),p_start_at,p_start_at+interval '30 minutes','held',now()+interval '15 minutes')
  returning id into new_id;
  return new_id;
exception when unique_violation then raise exception 'This appointment was just reserved. Please choose another time.';
end;
$$;

revoke all on function public.available_appointment_slots(date) from public;
revoke all on function public.hold_appointment_slot(text,text,text,timestamptz) from public;
grant execute on function public.available_appointment_slots(date) to anon,authenticated;
grant execute on function public.hold_appointment_slot(text,text,text,timestamptz) to authenticated;

create index if not exists consultation_user_submitted_idx on public.consultation_requests(user_id,submitted_at desc);
create index if not exists analytics_occurred_idx on public.analytics_events(occurred_at desc);
create index if not exists analytics_event_path_idx on public.analytics_events(event_name,path,occurred_at desc);
create index if not exists analytics_session_idx on public.analytics_events(session_id,occurred_at);
create index if not exists youtube_snapshot_fetched_idx on public.youtube_channel_snapshots(fetched_at desc);
create index if not exists payment_user_created_idx on public.payment_transactions(user_id,created_at desc);

alter table public.consultation_requests enable row level security;
alter table public.analytics_events enable row level security;
alter table public.youtube_channel_snapshots enable row level security;
alter table public.youtube_videos enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;

revoke all on table public.consultation_requests,public.analytics_events,public.youtube_channel_snapshots,public.youtube_videos,public.payment_transactions,public.payment_webhook_events from anon,authenticated;
grant select on table public.consultation_requests,public.payment_transactions to authenticated;
grant select on table public.youtube_channel_snapshots,public.youtube_videos to anon,authenticated;

create policy "consultations_select_own" on public.consultation_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "payments_select_own" on public.payment_transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "youtube_snapshots_public_read" on public.youtube_channel_snapshots for select to anon,authenticated using (true);
create policy "youtube_videos_public_read" on public.youtube_videos for select to anon,authenticated using (true);

-- Called only with the server-side service role after an administrator check.
create or replace function public.admin_dashboard_summary(requested_days integer default 30)
returns jsonb language sql security definer set search_path = public as $$
  with bounds as (
    select now() - make_interval(days => least(greatest(requested_days,1),365)) as since
  ), filtered as (
    select * from analytics_events where occurred_at >= (select since from bounds)
  ), totals as (
    select count(*) filter (where event_name='page_view') as page_views,
           count(*) filter (where event_name='click') as clicks,
           count(distinct session_id) as sessions,
           count(distinct anonymous_id) as visitors
    from filtered
  ), pages as (
    select coalesce(jsonb_agg(row_to_json(p) order by p.views desc),'[]'::jsonb) value from (
      select path,count(*) views,count(distinct session_id) sessions from filtered where event_name='page_view' group by path order by views desc limit 15
    ) p
  ), clicks as (
    select coalesce(jsonb_agg(row_to_json(c) order by c.clicks desc),'[]'::jsonb) value from (
      select path,target,count(*) clicks from filtered where event_name in ('click','outbound_click') group by path,target order by clicks desc limit 20
    ) c
  ), daily as (
    select coalesce(jsonb_agg(row_to_json(d) order by d.day),'[]'::jsonb) value from (
      select occurred_at::date day,count(*) filter(where event_name='page_view') views,count(distinct session_id) sessions from filtered group by occurred_at::date order by day
    ) d
  ), business as (
    select
      (select count(*) from consultation_requests where submitted_at >= (select since from bounds)) consultations,
      (select count(*) from payment_transactions where created_at >= (select since from bounds)) payment_attempts,
      (select count(*) from payment_transactions where status='paid' and paid_at >= (select since from bounds)) paid_orders,
      (select coalesce(sum(amount),0) from payment_transactions where status='paid' and paid_at >= (select since from bounds)) revenue_paise
  )
  select jsonb_build_object('periodDays',least(greatest(requested_days,1),365),'totals',to_jsonb(totals.*),'business',to_jsonb(business.*),'topPages',pages.value,'topClicks',clicks.value,'daily',daily.value)
  from totals,business,pages,clicks,daily;
$$;

revoke all on function public.admin_dashboard_summary(integer) from public,anon,authenticated;
