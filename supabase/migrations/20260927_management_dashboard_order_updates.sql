-- Allow the MFA-protected Worker to update fulfilment fields only.
grant update(status,tracking_reference,updated_at) on table public.product_orders to service_role;
