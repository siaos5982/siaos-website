-- Consultation cancellation/refund ledger and approved storefront catalogue.
-- Apply after 20260917_backend.sql.
begin;

alter table public.payment_transactions
  add column if not exists refunded_amount bigint not null default 0,
  add column if not exists refund_status text not null default 'none';

alter table public.payment_transactions
  drop constraint if exists payment_transactions_refunded_amount_check,
  add constraint payment_transactions_refunded_amount_check check (refunded_amount between 0 and amount),
  drop constraint if exists payment_transactions_refund_status_check,
  add constraint payment_transactions_refund_status_check check (refund_status in ('none','pending','partial','full','review_required'));

alter table public.catalog_prices drop constraint if exists catalog_prices_kind_check;
alter table public.catalog_prices add constraint catalog_prices_kind_check check(kind in ('product','consultation','report'));

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete restrict,
  source text not null default 'customer_cancellation' check (source in ('customer_cancellation','operator','provider')),
  reason text not null default '',
  policy_percent smallint not null check (policy_percent between 0 and 100),
  eligible_amount bigint not null check (eligible_amount >= 0),
  gateway_refund_id text unique,
  status text not null default 'requested' check (status in ('requested','processing','processed','not_due','review_required')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  last_error text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists refund_appointment_unique on public.refund_requests(appointment_id) where appointment_id is not null;
create index if not exists refund_user_requested_idx on public.refund_requests(user_id,requested_at desc);
create index if not exists refund_status_requested_idx on public.refund_requests(status,requested_at);

alter table public.refund_requests enable row level security;
revoke all on public.refund_requests from public,anon,authenticated;
grant all on public.refund_requests to service_role;

-- Only one Worker request may create a provider refund. Review retries are cooled
-- down so an ambiguous provider response has time to become queryable first.
create or replace function public.claim_refund_issue(p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.refund_requests set status='processing',attempts=attempts+1,last_error=null,updated_at=now()
    where id=p_request_id and eligible_amount>0 and attempts<20
      and (status='requested' or (status='review_required' and updated_at<now()-interval '2 minutes'));
  return found;
end $$;

create or replace function public.create_operator_refund(p_transaction_id uuid,p_amount bigint,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.payment_transactions; a public.appointments; r public.refund_requests; percentage smallint; pending_amount bigint;
begin
  select * into t from public.payment_transactions where id=p_transaction_id for update;
  if not found or t.status<>'paid' or t.gateway_payment_id is null then raise exception 'Captured payment not found'; end if;
  select coalesce(sum(eligible_amount),0) into pending_amount from public.refund_requests where transaction_id=t.id and status in ('requested','processing','review_required');
  if p_amount<=0 or p_amount>t.amount-t.refunded_amount-pending_amount then raise exception 'Refund exceeds the remaining captured amount'; end if;
  if coalesce(length(trim(p_reason)),0)<5 or length(trim(p_reason))>500 then raise exception 'A clear refund reason is required'; end if;
  percentage:=least(100,floor(p_amount*100.0/t.amount)::int)::smallint;
  if t.kind='consultation' and p_amount=t.amount-t.refunded_amount-pending_amount then
    select * into a from public.appointments where payment_reference=t.gateway_payment_id for update;
  end if;
  insert into public.refund_requests(transaction_id,user_id,appointment_id,source,reason,policy_percent,eligible_amount)
    values(t.id,t.user_id,a.id,'operator',left(trim(p_reason),500),percentage,p_amount) returning * into r;
  update public.payment_transactions set refund_status='pending',raw_status='operator_refund_requested',updated_at=now() where id=t.id;
  if a.id is not null then
    update public.appointments set status='cancelled',updated_at=now() where id=a.id and status in ('held','confirmed');
    update public.consultation_requests set status='cancelled',updated_at=now() where appointment_id=a.id;
  end if;
  return jsonb_build_object('id',r.id,'transactionId',t.id,'status',r.status,'policyPercent',percentage,'eligibleAmount',p_amount);
end $$;

-- Cancel atomically and calculate the published policy from server time.
create or replace function public.request_consultation_cancellation(p_user_id uuid,p_appointment_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  a public.appointments;
  t public.payment_transactions;
  r public.refund_requests;
  hours_remaining numeric;
  percentage smallint;
  refundable bigint;
  pending_amount bigint;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if not found or a.user_id<>p_user_id then raise exception 'Appointment not found'; end if;

  select * into r from public.refund_requests where appointment_id=a.id;
  if found then
    return jsonb_build_object('id',r.id,'appointmentId',a.id,'status',r.status,'policyPercent',r.policy_percent,
      'eligibleAmount',r.eligible_amount,'gatewayRefundId',r.gateway_refund_id);
  end if;

  if a.status='held' then
    update public.appointments set status='cancelled',hold_expires_at=null,updated_at=now() where id=a.id;
    update public.consultation_requests set status='cancelled',updated_at=now() where appointment_id=a.id;
    return jsonb_build_object('appointmentId',a.id,'status','not_due','policyPercent',0,'eligibleAmount',0);
  end if;
  if a.status<>'confirmed' then raise exception 'Only an active appointment can be cancelled'; end if;
  if a.start_at<=now() then raise exception 'Past appointments cannot be cancelled online'; end if;

  select * into t from public.payment_transactions
    where gateway_payment_id=a.payment_reference and user_id=p_user_id and kind='consultation' and status in ('paid','refunded')
    for update;
  if not found then raise exception 'Paid consultation transaction not found'; end if;

  hours_remaining:=extract(epoch from (a.start_at-now()))/3600.0;
  percentage:=case when hours_remaining>=20 then 75 when hours_remaining>=12 then 50 when hours_remaining>=5 then 25 else 0 end;
  select coalesce(sum(eligible_amount),0) into pending_amount from public.refund_requests
    where transaction_id=t.id and status in ('requested','processing','review_required');
  refundable:=greatest(0,least(floor(t.amount*percentage/100.0)::bigint,t.amount-t.refunded_amount-pending_amount));

  insert into public.refund_requests(transaction_id,user_id,appointment_id,reason,policy_percent,eligible_amount,status,processed_at)
  values(t.id,p_user_id,a.id,left(trim(coalesce(p_reason,'')),500),percentage,refundable,
    case when refundable=0 then 'not_due' else 'requested' end,case when refundable=0 then now() else null end)
  returning * into r;

  update public.appointments set status='cancelled',updated_at=now() where id=a.id;
  update public.consultation_requests set status='cancelled',updated_at=now() where appointment_id=a.id;
  update public.payment_transactions set refund_status=case when refundable=0 then refund_status else 'pending' end,
    raw_status=case when refundable=0 then 'cancelled_no_refund_due' else 'refund_requested' end,updated_at=now() where id=t.id;

  return jsonb_build_object('id',r.id,'appointmentId',a.id,'status',r.status,'policyPercent',percentage,
    'eligibleAmount',refundable,'paymentId',t.gateway_payment_id);
end $$;

-- Provider callbacks may arrive more than once; cumulative refunded amount is authoritative.
create or replace function public.record_payment_refund(p_payment text,p_refund text,p_refund_amount bigint,p_total_refunded bigint,p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.payment_transactions; resulting_status text;
begin
  select * into t from public.payment_transactions where gateway_payment_id=p_payment for update;
  if not found or p_refund_amount<=0 or p_total_refunded<p_refund_amount or p_total_refunded>t.amount then
    raise exception 'Refund requires reconciliation';
  end if;
  resulting_status:=case when p_total_refunded=t.amount then 'full' else 'partial' end;
  update public.payment_transactions set refunded_amount=greatest(refunded_amount,p_total_refunded),refund_status=resulting_status,
    status=case when p_total_refunded=t.amount then 'refunded' else 'paid' end,
    raw_status=case when p_total_refunded=t.amount then 'fully_refunded' else 'partially_refunded' end,updated_at=now() where id=t.id;

  if p_request_id is not null then
    update public.refund_requests set gateway_refund_id=coalesce(gateway_refund_id,p_refund),status='processed',
      processed_at=coalesce(processed_at,now()),last_error=null,updated_at=now()
      where id=p_request_id and transaction_id=t.id and eligible_amount=p_refund_amount;
  else
    update public.refund_requests set status='processed',processed_at=coalesce(processed_at,now()),last_error=null,updated_at=now()
      where transaction_id=t.id and gateway_refund_id=p_refund;
  end if;

  update public.product_orders set payment_status=case when p_total_refunded=t.amount then 'refunded' else payment_status end,updated_at=now()
    where payment_reference=p_payment;
  update public.report_purchases set status=case when p_total_refunded=t.amount then 'refunded' else status end
    where payment_reference=p_payment;
  return jsonb_build_object('status',resulting_status,'refundedAmount',p_total_refunded,'transactionId',t.id);
end $$;

-- Keep the old callback compatible while routing it through the cumulative ledger.
create or replace function public.record_full_refund(p_payment text,p_amount bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.record_payment_refund(p_payment,'legacy_full_refund',p_amount,p_amount,null);
  update public.appointments set status='cancelled',updated_at=now() where payment_reference=p_payment and status='confirmed';
end $$;

-- Product prices already published on the storefront, with complimentary delivery.
insert into public.catalog_prices(kind,slug,variant,name,unit_amount,shipping_amount,active)
select 'product',p.slug,v.variant,p.name,p.amount,0,true
from (values
  ('clear-quartz-bracelet','Clear Quartz Bracelet',110000),('green-aventurine-bracelet','Green Aventurine Bracelet',110000),
  ('lapis-lazuli-bracelet','Lapis Lazuli Bracelet',110000),('mohini-ittar','Mohini Ittar',250000),
  ('moon-stone-bracelet','Moon Stone Bracelet',110000),('pyrite-bracelet','Pyrite Bracelet',110000),
  ('raksha-nazar-kavach','Raksha Nazar Kavach',2200000),('red-hakik-bracelet','Red Hakik Bracelet',110000),
  ('red-jesper-bracelet','Red Jesper Bracelet',110000),('rose-quartz-bracelet','Rose Quartz Bracelet',110000),
  ('sarkar-kajal','Sarkar Kajal',510000),('tiger-eye-bracelet','Tiger Eye Bracelet',110000),
  ('yellow-citrine-bracelet','Yellow Citrine Bracelet',110000)
) p(slug,name,amount)
cross join lateral unnest(case
  when p.slug like '%bracelet' then array['S · 6.5 in','M · 7 in','L · 7.5 in']
  when p.slug='mohini-ittar' then array['6 ml','12 ml']
  else array['Standard'] end) v(variant)
on conflict(kind,slug,variant) do update set name=excluded.name,unit_amount=excluded.unit_amount,shipping_amount=0,active=true;

insert into public.catalog_prices(kind,slug,variant,name,unit_amount,shipping_amount,active)
values('report','compatibility-report','15-day-access','Complete Compatibility Report · 15-day access',9900,0,true)
on conflict(kind,slug,variant) do update set name=excluded.name,unit_amount=9900,shipping_amount=0,active=true;

-- Atomic payment ledger and fulfilment, including protected 15-day reports.
create or replace function public.capture_payment(p_order text,p_payment text,p_amount bigint,p_currency text,p_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.payment_transactions; a public.appointments; c public.consultation_requests; report_id uuid; needs_review boolean := false;
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
  elsif t.kind='report' then
    if t.item_slug<>'compatibility-report' or jsonb_typeof(t.metadata->'reportPayload')<>'object' then raise exception 'Report payload is not configured'; end if;
    insert into public.report_purchases(user_id,report_type,title,payment_reference,status)
      values(t.user_id,'compatibility','Complete Mulank & Bhagyank Compatibility Guidance',p_payment,'paid') returning id into report_id;
    insert into public.report_documents(report_id,payload) values(report_id,t.metadata->'reportPayload');
  else raise exception 'Unsupported fulfilment kind';
  end if;
  update public.payment_transactions set status='paid',gateway_payment_id=p_payment,method=left(p_method,40),paid_at=now(),updated_at=now(),
    raw_status=case when needs_review then 'paid_after_hold_expiry_requires_review' else 'captured' end,
    metadata=metadata||jsonb_build_object('requires_review',needs_review) where id=t.id;
  return jsonb_build_object('status','paid','id',t.id,'reportId',report_id,'requiresReview',needs_review);
end $$;

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
    (select occurred_at::date day,count(*) filter(where event_name='page_view') views,count(distinct session_id) sessions from filtered group by occurred_at::date) d),
  business as (select
    (select count(*) from public.consultation_requests where submitted_at >= (select since from bounds)) consultations,
    (select count(*) from public.payment_transactions where created_at >= (select since from bounds)) payment_attempts,
    (select count(*) from public.payment_transactions where status in ('paid','refunded') and paid_at >= (select since from bounds)) paid_orders,
    (select coalesce(sum(amount-refunded_amount),0) from public.payment_transactions where status in ('paid','refunded') and paid_at >= (select since from bounds)) revenue_paise,
    (select count(*) from public.refund_requests where status in ('requested','processing','review_required')) refunds_pending)
  select jsonb_build_object('periodDays',least(greatest(requested_days,1),365),'totals',to_jsonb(totals.*),'business',to_jsonb(business.*),'topPages',pages.value,'topClicks',clicks.value,'daily',daily.value)
  from totals,business,pages,clicks,daily;
$$;

revoke all on function public.claim_refund_issue(uuid),public.create_operator_refund(uuid,bigint,text),public.request_consultation_cancellation(uuid,uuid,text),public.record_payment_refund(text,text,bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function public.claim_refund_issue(uuid),public.create_operator_refund(uuid,bigint,text),public.request_consultation_cancellation(uuid,uuid,text),public.record_payment_refund(text,text,bigint,bigint,uuid),public.record_full_refund(text,bigint),public.capture_payment(text,text,bigint,text,text),public.admin_dashboard_summary(integer) to service_role;
commit;
