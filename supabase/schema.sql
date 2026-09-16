-- Plus 25: customer accounts. Run once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: every statement checks for what already exists.
--
-- Security model (row level security):
--   * A signed-in customer can read their own profile and orders, and change only their display name.
--   * Nobody can make themselves a member, or create, edit or delete orders, from the website. Those are written by
--     the team in the Supabase dashboard, or later by the payment provider's webhook (a Supabase Edge Function) using the
--     secret service_role key, which bypasses these rules and must never be put in the site.
--   * Never store Steam usernames or passwords in any table.

-- ---------------------------------------------------------------- profiles: one row per customer
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  avatar_url   text,
  is_member    boolean not null default false,   -- member pricing; set by the team, not by customers
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Customers read their own profile" on public.profiles;
create policy "Customers read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Customers update their own profile" on public.profiles;
create policy "Customers update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Column-level limits on top of the policies: the site may only change display_name.
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- ---------------------------------------------------------------- orders: read-only for customers
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  service     text not null check (service in ('mmr_boost', 'replay_analysis', 'coaching')),
  status      text not null default 'pending' check (status in ('pending', 'paid', 'in_progress', 'paused', 'completed', 'cancelled')),
  summary     text,                                  -- one line for the account page, e.g. "Haste · 2,500 → 3,500 MMR"
  details     jsonb not null default '{}'::jsonb,    -- the choices made in the order form (no credentials)
  total_usd   numeric(10, 2) check (total_usd >= 0),
  progress    smallint check (progress between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists orders_user_id_created_at_idx on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

drop policy if exists "Customers read their own orders" on public.orders;
create policy "Customers read their own orders" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on table public.orders from anon, authenticated;

-- ---------------------------------------------------------------- keep updated_at current
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- create a profile when someone signs up
-- Uses the name and avatar the login provider shares (Discord, Google), or the start of the email address.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ), 60),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
