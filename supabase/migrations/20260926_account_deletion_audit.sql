-- Privacy-safe account deletion audit for operations reporting.
begin;

create table if not exists public.account_deletion_audit (
  id bigint generated always as identity primary key,
  account_id uuid not null unique,
  account_created_at timestamptz,
  deleted_at timestamptz not null default now(),
  deletion_source text not null default 'customer_self_service'
    check (deletion_source in ('customer_self_service','administrator','retention_policy'))
);

create index if not exists account_deletion_audit_deleted_idx
  on public.account_deletion_audit(deleted_at desc);

alter table public.account_deletion_audit enable row level security;
revoke all on public.account_deletion_audit from public,anon,authenticated;
grant all on public.account_deletion_audit to service_role;

create or replace function public.delete_browser_account_with_audit(p_account_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  created_time timestamptz;
  deletion_time timestamptz := now();
begin
  delete from public.browser_accounts
  where id=p_account_id
  returning created_at into created_time;

  if not found then
    return null;
  end if;

  insert into public.account_deletion_audit(account_id,account_created_at,deleted_at,deletion_source)
  values(p_account_id,created_time,deletion_time,'customer_self_service')
  on conflict(account_id) do nothing;

  return jsonb_build_object('deleted',true,'deletedAt',deletion_time);
end;
$$;

revoke all on function public.delete_browser_account_with_audit(uuid) from public,anon,authenticated;
grant execute on function public.delete_browser_account_with_audit(uuid) to service_role;

commit;
