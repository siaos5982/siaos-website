-- Consultation requests are saved first and then continued as a customer-initiated
-- WhatsApp conversation. Razorpay remains available only for products and reports.
-- Apply after 20260918_refunds_catalog.sql.
begin;

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check(status in ('held','requested','confirmed','cancelled','completed','no_show'));

alter table public.appointments
  add column if not exists direct_payment_amount bigint not null default 0,
  add column if not exists direct_payment_method text,
  add column if not exists direct_payment_reference text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists direct_refund_amount bigint not null default 0,
  add column if not exists direct_refund_percent smallint not null default 0,
  add column if not exists direct_refund_status text not null default 'none',
  add column if not exists direct_refund_reference text;
alter table public.appointments
  drop constraint if exists appointments_direct_payment_amount_check,
  add constraint appointments_direct_payment_amount_check check(direct_payment_amount>=0),
  drop constraint if exists appointments_direct_refund_amount_check,
  add constraint appointments_direct_refund_amount_check check(direct_refund_amount between 0 and direct_payment_amount),
  drop constraint if exists appointments_direct_refund_percent_check,
  add constraint appointments_direct_refund_percent_check check(direct_refund_percent between 0 and 100),
  drop constraint if exists appointments_direct_refund_status_check,
  add constraint appointments_direct_refund_status_check check(direct_refund_status in ('none','required','not_due','processed'));

drop index if exists public.appointments_active_start_idx;
create unique index appointments_active_start_idx on public.appointments(start_at)
  where status in ('held','requested','confirmed');

-- Old consultation catalogue rows are retained for audit history but cannot be used.
update public.catalog_prices set active=false where kind='consultation' and active=true;

create or replace function public.available_appointment_slots(p_date date)
returns table(start_at timestamptz,label text) language sql stable security definer set search_path='' as $$
  select s.t,to_char(s.t at time zone 'Asia/Kolkata','FMHH12:MI AM')||' – '||to_char((s.t+interval '30 minutes') at time zone 'Asia/Kolkata','FMHH12:MI AM')
  from (select make_timestamptz(extract(year from p_date)::int,extract(month from p_date)::int,extract(day from p_date)::int,h,0,0,'Asia/Kolkata') t from generate_series(10,18) h) s
  where p_date between (now() at time zone 'Asia/Kolkata')::date and (now() at time zone 'Asia/Kolkata')::date+31
    and extract(isodow from p_date) between 1 and 6 and s.t>now()
    and not exists(select 1 from public.appointments a where a.start_at=s.t and (a.status in ('requested','confirmed') or (a.status='held' and a.hold_expires_at>now())))
  order by s.t;
$$;

create or replace function public.save_consultation(p_user_id uuid,p_appointment_id uuid,p_service text,p_service_name text,p_related_service text,p_details jsonb)
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
  update public.appointments set status='requested',hold_expires_at=null,updated_at=now() where id=a.id;
  return result;
end $$;

create or replace function public.confirm_whatsapp_consultation(p_appointment_id uuid,p_amount bigint,p_method text,p_reference text,p_admin_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Appointment not found'; end if;
  if a.status='confirmed' then
    if a.direct_payment_amount<>p_amount or a.direct_payment_method<>trim(p_method) or a.direct_payment_reference<>trim(p_reference) then
      raise exception 'Appointment is already confirmed with different payment details';
    end if;
    return jsonb_build_object('appointmentId',a.id,'status',a.status,'amount',a.direct_payment_amount);
  end if;
  if a.status<>'requested' or a.start_at<=now() then raise exception 'Only a future WhatsApp booking request can be confirmed'; end if;
  if p_amount<=0 or p_amount>100000000 or coalesce(length(trim(p_method)),0) not between 2 and 50 or coalesce(length(trim(p_reference)),0) not between 2 and 120 then
    raise exception 'Valid direct payment details are required';
  end if;
  update public.appointments set status='confirmed',direct_payment_amount=p_amount,direct_payment_method=trim(p_method),
    direct_payment_reference=trim(p_reference),confirmed_at=now(),updated_at=now() where id=a.id;
  update public.consultation_requests set status='scheduled',updated_at=now() where appointment_id=a.id;
  insert into public.admin_audit_log(user_id,action,target) values(p_admin_user_id,'whatsapp_consultation_confirmed',a.id::text);
  return jsonb_build_object('appointmentId',a.id,'status','confirmed','amount',p_amount);
end $$;

create or replace function public.record_direct_consultation_refund(p_appointment_id uuid,p_reference text,p_admin_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Appointment not found'; end if;
  if a.direct_refund_status='processed' then
    if a.direct_refund_reference<>trim(p_reference) then raise exception 'Refund is already recorded with a different reference'; end if;
    return jsonb_build_object('appointmentId',a.id,'status','processed','amount',a.direct_refund_amount);
  end if;
  if a.status<>'cancelled' or a.direct_refund_status<>'required' or a.direct_refund_amount<=0 then
    raise exception 'No direct consultation refund is awaiting completion';
  end if;
  if coalesce(length(trim(p_reference)),0) not between 2 and 120 then raise exception 'Valid direct refund reference is required'; end if;
  update public.appointments set direct_refund_status='processed',direct_refund_reference=trim(p_reference),updated_at=now() where id=a.id;
  insert into public.admin_audit_log(user_id,action,target) values(p_admin_user_id,'direct_consultation_refund_recorded',a.id::text);
  return jsonb_build_object('appointmentId',a.id,'status','processed','amount',a.direct_refund_amount);
end $$;

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

  if a.status in ('held','requested') then
    update public.appointments set status='cancelled',hold_expires_at=null,updated_at=now() where id=a.id;
    update public.consultation_requests set status='cancelled',updated_at=now() where appointment_id=a.id;
    return jsonb_build_object('appointmentId',a.id,'status','not_due','policyPercent',0,'eligibleAmount',0,
      'message','Booking request cancelled. Contact SIAOS on WhatsApp if you already paid directly.');
  end if;
  if a.status<>'confirmed' then raise exception 'Only an active appointment can be cancelled'; end if;
  if a.start_at<=now() then raise exception 'Past appointments cannot be cancelled online'; end if;

  select * into t from public.payment_transactions
    where gateway_payment_id=a.payment_reference and user_id=p_user_id and kind='consultation' and status in ('paid','refunded')
    for update;
  if not found then
    hours_remaining:=extract(epoch from (a.start_at-now()))/3600.0;
    percentage:=case when hours_remaining>=20 then 75 when hours_remaining>=12 then 50 when hours_remaining>=5 then 25 else 0 end;
    refundable:=greatest(0,floor(a.direct_payment_amount*percentage/100.0)::bigint);
    update public.appointments set status='cancelled',direct_refund_amount=refundable,direct_refund_percent=percentage,
      direct_refund_status=case when refundable>0 then 'required' else 'not_due' end,updated_at=now() where id=a.id;
    update public.consultation_requests set status='cancelled',updated_at=now() where appointment_id=a.id;
    return jsonb_build_object('appointmentId',a.id,'status',case when refundable>0 then 'manual_refund_required' else 'not_due' end,
      'policyPercent',percentage,'eligibleAmount',refundable,
      'message',case when refundable>0 then 'Appointment cancelled. Your time-based refund is recorded for SIAOS to return directly.' else 'Appointment cancelled. No refund is due under the published schedule.' end);
  end if;

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

revoke all on function public.available_appointment_slots(date),public.save_consultation(uuid,uuid,text,text,text,jsonb),public.confirm_whatsapp_consultation(uuid,bigint,text,text,uuid),public.record_direct_consultation_refund(uuid,text,uuid),public.request_consultation_cancellation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.available_appointment_slots(date) to anon,authenticated;
grant execute on function public.save_consultation(uuid,uuid,text,text,text,jsonb),public.confirm_whatsapp_consultation(uuid,bigint,text,text,uuid),public.record_direct_consultation_refund(uuid,text,uuid),public.request_consultation_cancellation(uuid,uuid,text) to service_role;

commit;
