-- The private reporting Worker uses Supabase's service role to export orders.
-- Keep the grant read-only; order creation and updates remain inside trusted RPCs.
grant select on table public.product_orders to service_role;
