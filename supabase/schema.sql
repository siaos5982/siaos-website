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

alter table public.profiles enable row level security;
alter table public.readings enable row level security;
alter table public.report_purchases enable row level security;
alter table public.report_documents enable row level security;

revoke all on table public.profiles,public.readings,public.report_purchases,public.report_documents from anon,authenticated;
grant select,insert,update,delete on table public.profiles to authenticated;
grant select,insert,delete on table public.readings to authenticated;
grant select on table public.report_purchases,public.report_documents to authenticated;

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

-- Payment webhooks use the server-only service role to insert a purchase and document.
-- Never put the service-role key in browser JavaScript or GitHub.
