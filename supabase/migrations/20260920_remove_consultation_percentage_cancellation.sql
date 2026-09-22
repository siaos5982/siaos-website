begin;

-- Consultation payments and changes are handled directly through the verified
-- SIAOS WhatsApp conversation. Retire the former percentage-based customer
-- cancellation/refund RPCs while preserving historical appointment records.
revoke all on function public.request_consultation_cancellation(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.record_direct_consultation_refund(uuid, text, uuid)
  from public, anon, authenticated, service_role;

drop function if exists public.request_consultation_cancellation(uuid, uuid, text);
drop function if exists public.record_direct_consultation_refund(uuid, text, uuid);

commit;
