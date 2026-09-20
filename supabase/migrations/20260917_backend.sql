-- Apply ONCE after schema.sql, first in a staging project. Do not rerun schema.sql.
begin;

-- Trigger helpers must never be exposed as callable Data API endpoints.
do $do$
begin
  if to_regprocedure('public.handle_new_auth_user()') is not null then
    execute 'revoke all on function public.handle_new_auth_user() from public, anon, authenticated';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$do$;

alter table public.consultation_requests add column if not exists appointment_id uuid references public.appointments(id);
create unique index if not exists consultation_appointment_unique on public.consultation_requests(appointment_id);
-- Refuse concurrent checkout ledgers for one consultation, even across request IDs.
create unique index if not exists consultation_checkout_unique on public.payment_transactions((metadata->>'consultationId')) where kind='consultation' and status in ('created','authorized','paid');
alter table public.consultation_requests add column if not exists consent_at timestamptz;

create table public.catalog_prices (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('product','consultation')),
  slug text not null,
  variant text not null default '',
  name text not null,
  unit_amount bigint check(unit_amount > 0),
  shipping_amount bigint not null default 0 check(shipping_amount >= 0),
  active boolean not null default false,
  unique(kind,slug,variant),
  check(not active or unit_amount is not null)
);
-- Prices, sizes, delivery and availability must be approved before activation.
-- For consultations, variant must equal related_service exactly.

create table public.checkout_intents (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  request jsonb not null,
  state text not null default 'creating' check(state in ('creating','ready','review')),
  transaction_id uuid references public.payment_transactions(id),
  created_at timestamptz not null default now()
);
create index if not exists checkout_intents_user_idx on public.checkout_intents(user_id);
create index if not exists checkout_intents_transaction_idx on public.checkout_intents(transaction_id) where transaction_id is not null;
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  action text not null,
  target text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_user_idx on public.admin_audit_log(user_id) where user_id is not null;
create table public.api_rate_limits (
  key text primary key,
  count integer not null,
  expires_at timestamptz not null
);
create table public.integration_jobs (
  name text primary key,
  locked_until timestamptz,
  last_success timestamptz,
  last_error text
);
insert into public.integration_jobs(name) values ('sheets');
alter table public.catalog_prices enable row level security;
alter table public.checkout_intents enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.integration_jobs enable row level security;
revoke all on public.catalog_prices,public.checkout_intents,public.admin_audit_log,public.api_rate_limits,public.integration_jobs from public,anon,authenticated;
grant all on public.catalog_prices,public.checkout_intents,public.admin_audit_log,public.api_rate_limits,public.integration_jobs to service_role;
grant usage,select on sequence public.admin_audit_log_id_seq to service_role;

create function public.api_rate_limit(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  insert into public.api_rate_limits(key,count,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
  on conflict(key) do update set count=case when api_rate_limits.expires_at<=now() then 1 else api_rate_limits.count+1 end,
    expires_at=case when api_rate_limits.expires_at<=now() then now()+make_interval(secs=>p_seconds) else api_rate_limits.expires_at end
  returning count into n;
  return n<=p_limit;
end $$;

create function public.save_consultation(p_user_id uuid,p_appointment_id uuid,p_service text,p_service_name text,p_related_service text,p_details jsonb)
returns public.consultation_requests language plpgsql security definer set search_path='' as $$
declare a public.appointments; result public.consultation_requests;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if not found or a.user_id<>p_user_id or a.service<>p_service or a.related_service<>p_related_service then
    raise exception 'Appointment ownership or service mismatch';
  end if;
  select * into result from public.consultation_requests where appointment_id=a.id;
  if found then return result; end if;
  if a.status<>'held' or a.hold_expires_at<=now() then raise exception 'Appointment hold expired'; end if;
  insert into public.consultation_requests(user_id,appointment_id,service,service_name,related_service,details,consent_at)
  values(p_user_id,a.id,p_service,p_service_name,p_related_service,p_details,now()) returning * into result;
  return result;
end $$;

-- Serialize holds per user, reject sub-minute bypasses, use India's business date.
create or replace function public.hold_appointment_slot(p_service text,p_related_service text,p_consultation_mode text,p_start_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; local_time timestamp := p_start_at at time zone 'Asia/Kolkata';
begin
  if auth.uid() is null then raise exception 'Sign in before reserving an appointment.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if p_service not in ('kundli','numerology','vastu','tarot','face','paranormal') or coalesce(length(trim(p_related_service)),0)=0 then raise exception 'Invalid service'; end if;
  if local_time is null or local_time::date not between (now() at time zone 'Asia/Kolkata')::date and (now() at time zone 'Asia/Kolkata')::date+31
    or extract(isodow from local_time) not between 1 and 6
    or date_trunc('hour',local_time)<>local_time
    or extract(hour from local_time) not between 10 and 18 or p_start_at<=now() then raise exception 'Invalid appointment time'; end if;
  update public.appointments set status='cancelled',updated_at=now() where status='held' and hold_expires_at<=now();
  select id into new_id from public.appointments where user_id=auth.uid() and start_at=p_start_at and service=p_service and related_service=p_related_service and status='held';
  if found then return new_id; end if;
  if exists(select 1 from public.appointments where user_id=auth.uid() and status='held') then raise exception 'You already have a reservation. Complete it or wait for it to expire.'; end if;
  if (select count(*) from public.appointments where user_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Too many reservations. Please try later.'; end if;
  insert into public.appointments(user_id,service,related_service,consultation_mode,start_at,end_at,hold_expires_at)
  values(auth.uid(),p_service,left(p_related_service,160),left(coalesce(p_consultation_mode,'On-call consultation'),100),p_start_at,p_start_at+interval '30 minutes',now()+interval '15 minutes') returning id into new_id;
  return new_id;
exception when unique_violation then raise exception 'This appointment was just reserved. Choose another time.';
end $$;

create or replace function public.available_appointment_slots(p_date date)
returns table(start_at timestamptz,label text,availability text) language sql stable security definer set search_path='' as $$
  select s.t,to_char(s.t at time zone 'Asia/Kolkata','FMHH12:MI AM')||' – '||to_char((s.t+interval '30 minutes') at time zone 'Asia/Kolkata','FMHH12:MI AM'),'available'::text
  from (select make_timestamptz(extract(year from p_date)::int,extract(month from p_date)::int,extract(day from p_date)::int,h,0,0,'Asia/Kolkata') t from generate_series(10,18) h) s
  where p_date between (now() at time zone 'Asia/Kolkata')::date and (now() at time zone 'Asia/Kolkata')::date+31
    and extract(isodow from p_date) between 1 and 6 and s.t>now()
    and not exists(select 1 from public.appointments a where a.start_at=s.t and (a.status='confirmed' or (a.status='held' and a.hold_expires_at>now()))) order by s.t;
$$;

-- One DB transaction commits the ledger and fulfilment. Duplicate callbacks are safe.
create function public.capture_payment(p_order text,p_payment text,p_amount bigint,p_currency text,p_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.payment_transactions; a public.appointments; c public.consultation_requests; needs_review boolean := false;
begin
  select * into t from public.payment_transactions where gateway_order_id=p_order for update;
  if not found or t.amount<>p_amount or t.currency<>p_currency then raise exception 'Payment does not match the saved order'; end if;
  if t.status in ('paid','refunded') then
    if t.gateway_payment_id<>p_payment then raise exception 'Payment reference mismatch'; end if;
    return jsonb_build_object('status',t.status,'id',t.id);
  end if;
  if t.kind='consultation' then
    select * into c from public.consultation_requests where id=(t.metadata->>'consultationId')::uuid and user_id=t.user_id;
    if not found then raise exception 'Consultation not found'; end if;
    select * into a from public.appointments where id=c.appointment_id for update;
    if a.status='held' and a.hold_expires_at>now() and a.start_at>now() then
      update public.appointments set status='confirmed',hold_expires_at=null,payment_reference=p_payment,updated_at=now() where id=a.id;
      update public.consultation_requests set status='scheduled',updated_at=now() where id=c.id;
    else
      needs_review:=true;
      update public.consultation_requests set internal_notes='Payment received after reservation expiry. Contact client to reschedule or refund.',updated_at=now() where id=c.id;
    end if;
  elsif t.kind='product' then
    insert into public.product_orders(user_id,order_number,payment_reference,payment_status,status,currency,subtotal,shipping_amount,total,items,delivery_address)
    values(t.user_id,t.receipt,p_payment,'paid','confirmed',t.currency,(t.amount-coalesce((t.metadata->>'shippingAmount')::bigint,0))/100.0,coalesce((t.metadata->>'shippingAmount')::bigint,0)/100.0,t.amount/100.0,
      jsonb_build_array(jsonb_build_object('slug',t.item_slug,'name',t.item_name,'size',t.metadata->>'variant','quantity',t.quantity)),t.metadata->'address');
  else raise exception 'Report fulfilment is not configured';
  end if;
  update public.payment_transactions set status='paid',gateway_payment_id=p_payment,method=left(p_method,40),paid_at=now(),updated_at=now(),raw_status=case when needs_review then 'paid_after_hold_expiry_requires_review' else 'captured' end,metadata=metadata||jsonb_build_object('requires_review',needs_review) where id=t.id;
  return jsonb_build_object('status','paid','id',t.id,'requiresReview',needs_review);
end $$;

create function public.record_full_refund(p_payment text,p_amount bigint)
returns void language plpgsql security definer set search_path='' as $$
declare t public.payment_transactions;
begin
  select * into t from public.payment_transactions where gateway_payment_id=p_payment for update;
  if not found or t.amount<>p_amount then raise exception 'Refund requires manual reconciliation'; end if;
  update public.payment_transactions set status='refunded',updated_at=now() where id=t.id;
  update public.product_orders set payment_status='refunded',updated_at=now() where payment_reference=p_payment;
  update public.report_purchases set status='refunded' where payment_reference=p_payment;
  update public.appointments set status='cancelled',updated_at=now() where payment_reference=p_payment and status='confirmed';
end $$;

create function public.claim_sheets_sync() returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.integration_jobs set locked_until=now()+interval '10 minutes' where name='sheets' and (locked_until is null or locked_until<now());
  return found;
end $$;

revoke all on function public.api_rate_limit(text,integer,integer),public.save_consultation(uuid,uuid,text,text,text,jsonb),public.capture_payment(text,text,bigint,text,text),public.record_full_refund(text,bigint),public.claim_sheets_sync() from public,anon,authenticated;
grant execute on function public.api_rate_limit(text,integer,integer),public.save_consultation(uuid,uuid,text,text,text,jsonb),public.capture_payment(text,text,bigint,text,text),public.record_full_refund(text,bigint),public.claim_sheets_sync() to service_role;
revoke all on function public.available_appointment_slots(date),public.hold_appointment_slot(text,text,text,timestamptz) from public;
grant execute on function public.available_appointment_slots(date) to anon,authenticated;
grant execute on function public.hold_appointment_slot(text,text,text,timestamptz) to authenticated;
commit;
