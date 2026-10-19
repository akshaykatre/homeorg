-- Home Base: initial schema
-- Run this once in the Supabase dashboard (SQL Editor) on a fresh project.

create extension if not exists pgcrypto;

-- ============================================================================
-- Households & membership
-- ============================================================================

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- One row per auth user. household_id is null until the user creates or
-- joins a household. This is also the "people" collection from SPEC.md.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references households (id) on delete set null,
  display_name text,
  seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users (id),
  used_by uuid references auth.users (id),
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used throughout RLS policies below.
create function public.current_household_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Household bootstrapping (security definer: these run the validation that
-- RLS alone can't express, e.g. "you may only belong to one household" and
-- "a household has at most two members").
-- ----------------------------------------------------------------------------

create function public.create_household(household_name text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household households;
begin
  if exists (
    select 1 from profiles where id = auth.uid() and household_id is not null
  ) then
    raise exception 'User already belongs to a household';
  end if;

  insert into households (name) values (household_name)
    returning * into new_household;

  update profiles set household_id = new_household.id where id = auth.uid();

  return new_household;
end;
$$;

create function public.create_household_invite()
returns household_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  hh_id uuid := current_household_id();
  new_invite household_invites;
begin
  if hh_id is null then
    raise exception 'User does not belong to a household';
  end if;

  insert into household_invites (household_id, code, created_by)
  values (hh_id, encode(gen_random_bytes(6), 'hex'), auth.uid())
  returning * into new_invite;

  return new_invite;
end;
$$;

create function public.join_household(invite_code text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  inv household_invites;
  member_count int;
  joined_household households;
begin
  if exists (
    select 1 from profiles where id = auth.uid() and household_id is not null
  ) then
    raise exception 'User already belongs to a household';
  end if;

  select * into inv from household_invites
    where code = invite_code and used_at is null and expires_at > now();

  if inv is null then
    raise exception 'Invite not found or expired';
  end if;

  select count(*) into member_count from profiles where household_id = inv.household_id;
  if member_count >= 2 then
    raise exception 'Household already has two members';
  end if;

  update household_invites set used_at = now(), used_by = auth.uid() where id = inv.id;
  update profiles set household_id = inv.household_id where id = auth.uid();

  select * into joined_household from households where id = inv.household_id;
  return joined_household;
end;
$$;

-- ============================================================================
-- Domain tables (see docs/SPEC.md "Data model")
-- ============================================================================

create table projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  lead_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  text text not null,
  project_id uuid references projects (id) on delete cascade,
  owner_id uuid references auth.users (id),
  done boolean not null default false,
  done_by uuid references auth.users (id),
  done_at timestamptz,
  unsure boolean not null default false,
  created_at timestamptz not null default now()
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create table listitems (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  list_id uuid not null references lists (id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- id convention from the prototype: kind__slug(text)
create table catalog (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  kind text not null,
  text text not null,
  uses integer not null default 0,
  gone boolean not null default false,
  created_at timestamptz not null default now()
);

create table dumps (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  text text not null,
  by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table routines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  owner_id uuid references auth.users (id),
  days int[] not null default '{}',
  followups jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- id convention from the prototype: routineId_YYYY-MM-DD
create table routinelog (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  routine_id uuid not null references routines (id) on delete cascade,
  date date not null,
  done boolean not null default false,
  done_by uuid references auth.users (id),
  helper_id uuid references auth.users (id),
  needs_hand boolean not null default false
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  type text not null,
  by uuid references auth.users (id),
  subject text,
  extra jsonb,
  created_at timestamptz not null default now()
);

create table timers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  routine_id uuid references routines (id) on delete cascade,
  routine_name text,
  text text,
  due_at timestamptz not null,
  rest jsonb not null default '[]',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index on profiles (household_id);
create index on projects (household_id);
create index on tasks (household_id);
create index on tasks (project_id);
create index on lists (household_id);
create index on listitems (household_id);
create index on listitems (list_id);
create index on catalog (household_id, kind);
create index on dumps (household_id);
create index on routines (household_id);
create index on routinelog (household_id);
create index on routinelog (routine_id);
create index on activity (household_id);
create index on timers (household_id);

-- ============================================================================
-- Row level security: every household-scoped table is only visible to /
-- writable by members of that same household.
-- ============================================================================

alter table households enable row level security;
alter table profiles enable row level security;
alter table household_invites enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table lists enable row level security;
alter table listitems enable row level security;
alter table catalog enable row level security;
alter table dumps enable row level security;
alter table routines enable row level security;
alter table routinelog enable row level security;
alter table activity enable row level security;
alter table timers enable row level security;

create policy "households_select" on households
  for select using (id = current_household_id());

create policy "profiles_select" on profiles
  for select using (id = auth.uid() or household_id = current_household_id());
create policy "profiles_update_self" on profiles
  for update using (id = auth.uid());

-- Direct table access to invites is limited to existing members (e.g. to list
-- invites they've created). Redeeming a code happens through join_household(),
-- a security-definer RPC, so someone without a household yet can still use it.
create policy "invites_select" on household_invites
  for select using (household_id = current_household_id());

create policy "projects_all" on projects for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy "tasks_all" on tasks for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy "lists_all" on lists for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy "listitems_all" on listitems for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy "catalog_all" on catalog for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy "dumps_all" on dumps for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy "routines_all" on routines for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy "routinelog_all" on routinelog for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy "activity_all" on activity for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy "timers_all" on timers for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
