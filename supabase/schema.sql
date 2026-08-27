-- Jeff / Mise · vollständiges Supabase-Schema
-- Im Supabase SQL Editor als ein Block ausführen.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0), tracking_type text not null check (tracking_type in ('exact','basic')),
  quantity numeric check (quantity is null or quantity >= 0), unit text, location text not null check (location in ('Kühlschrank','Gefrierfach','Vorratsschrank','Arbeitsfläche')),
  status text not null default 'vorhanden' check (status in ('vorhanden','wenig','leer')), best_before date, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0), start_date date, end_date date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.shopping_lists(id) on delete cascade, name text not null check (char_length(trim(name)) > 0),
  quantity text, note text, category text not null check (category in ('Gemüse & Obst','Brot, Trockenware & Saucen','Kühlregal','Fleischtheke & Käse','Tiefkühl','Getränke & Snacks','Küchenabteilung')),
  position integer not null default 0, is_checked boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0), cook_date date, servings smallint not null default 1 check (servings between 1 and 24),
  learning_focus text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.recipe_prep_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, position integer not null default 0,
  text text not null check (char_length(trim(text)) > 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, position integer not null default 0,
  title text not null check (char_length(trim(title)) > 0), instruction text not null,
  duration text, temperature text, goal text, science text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Macht das Schema auch bei bereits bestehenden Jeff-Projekten aktualisierbar.
alter table public.recipe_steps add column if not exists science text;

create table if not exists public.cooking_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, prep_progress jsonb not null default '{}'::jsonb,
  step_progress jsonb not null default '{}'::jsonb, completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.recipe_notes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, content text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, recipe_id)
);

create index if not exists inventory_user_idx on public.inventory_items(user_id);
create index if not exists shopping_lists_user_idx on public.shopping_lists(user_id);
create index if not exists shopping_items_list_idx on public.shopping_items(list_id, position);
create index if not exists recipes_user_date_idx on public.recipes(user_id, cook_date desc);
create index if not exists recipe_steps_recipe_idx on public.recipe_steps(recipe_id, position);
create index if not exists sessions_recipe_idx on public.cooking_sessions(recipe_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$ declare t text; begin
  foreach t in array array['profiles','inventory_items','shopping_lists','shopping_items','recipes','recipe_prep_items','recipe_steps','cooking_sessions','recipe_notes'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))) on conflict do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.inventory_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_prep_items enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.cooking_sessions enable row level security;
alter table public.recipe_notes enable row level security;

do $$ declare t text; begin
  foreach t in array array['profiles','inventory_items','shopping_lists','shopping_items','recipes','recipe_prep_items','recipe_steps','cooking_sessions','recipe_notes'] loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all using (auth.uid() = %I) with check (auth.uid() = %I)', t, case when t = 'profiles' then 'id' else 'user_id' end, case when t = 'profiles' then 'id' else 'user_id' end);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
