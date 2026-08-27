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
  title text not null check (char_length(trim(title)) > 0), start_date date, end_date date, completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.shopping_lists(id) on delete cascade, name text not null check (char_length(trim(name)) > 0),
  quantity text, note text, category text not null check (category in ('Gemüse & Obst','Brot, Trockenware & Saucen','Kühlregal','Fleischtheke & Käse','Tiefkühl','Getränke & Snacks','Küchenabteilung')),
  position integer not null default 0, is_checked boolean not null default false, added_to_inventory boolean not null default false,
  inventory_tracking_type text not null default 'exact' check (inventory_tracking_type in ('exact','basic')),
  inventory_quantity numeric check (inventory_quantity is null or inventory_quantity >= 0), inventory_unit text not null default '',
  inventory_location text not null default 'Vorratsschrank' check (inventory_location in ('Kühlschrank','Gefrierfach','Vorratsschrank','Arbeitsfläche')),
  remember_for_next boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0), cook_date date, servings smallint not null default 1 check (servings between 1 and 24),
  learning_focus text, is_favorite boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.shopping_lists add column if not exists completed_at timestamptz;
alter table public.shopping_items add column if not exists added_to_inventory boolean not null default false;
alter table public.shopping_items add column if not exists inventory_tracking_type text not null default 'exact' check (inventory_tracking_type in ('exact','basic'));
alter table public.shopping_items add column if not exists inventory_quantity numeric check (inventory_quantity is null or inventory_quantity >= 0);
alter table public.shopping_items add column if not exists inventory_unit text not null default '';
alter table public.shopping_items add column if not exists inventory_location text not null default 'Vorratsschrank' check (inventory_location in ('Kühlschrank','Gefrierfach','Vorratsschrank','Arbeitsfläche'));
alter table public.shopping_items add column if not exists remember_for_next boolean not null default false;
alter table public.recipes add column if not exists is_favorite boolean not null default false;

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

create table if not exists public.recipe_consumptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, position integer not null default 0,
  inventory_name text not null check (char_length(trim(inventory_name)) > 0), quantity numeric not null check (quantity >= 0),
  unit text not null default '', tracking_type text not null default 'exact' check (tracking_type in ('exact','basic')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

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
create index if not exists recipe_consumptions_recipe_idx on public.recipe_consumptions(recipe_id, position);
create index if not exists sessions_recipe_idx on public.cooking_sessions(recipe_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$ declare t text; begin
  foreach t in array array['profiles','inventory_items','shopping_lists','shopping_items','recipes','recipe_prep_items','recipe_steps','recipe_consumptions','cooking_sessions','recipe_notes'] loop
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
alter table public.recipe_consumptions enable row level security;
alter table public.cooking_sessions enable row level security;
alter table public.recipe_notes enable row level security;

do $$ declare t text; begin
  foreach t in array array['profiles','inventory_items','shopping_lists','shopping_items','recipes','recipe_prep_items','recipe_steps','recipe_consumptions','cooking_sessions','recipe_notes'] loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all using (auth.uid() = %I) with check (auth.uid() = %I)', t, case when t = 'profiles' then 'id' else 'user_id' end, case when t = 'profiles' then 'id' else 'user_id' end);
  end loop;
end $$;

create or replace function public.checkout_shopping_list(p_list_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare
  entry record;
  existing_id uuid;
begin
  if not exists (select 1 from public.shopping_lists where id = p_list_id and user_id = auth.uid() and completed_at is null) then
    raise exception 'Einkaufsliste ist nicht offen oder gehört nicht zum Nutzer';
  end if;

  for entry in
    select * from public.shopping_items
    where list_id = p_list_id and user_id = auth.uid() and is_checked and not added_to_inventory
    order by position
  loop
    existing_id := null;
    select id into existing_id from public.inventory_items
      where user_id = auth.uid()
        and lower(name) = lower(entry.name)
        and tracking_type = entry.inventory_tracking_type
        and (entry.inventory_tracking_type = 'basic' or (unit = entry.inventory_unit and location = entry.inventory_location))
      order by created_at limit 1;

    if existing_id is not null then
      if entry.inventory_tracking_type = 'basic' then
        update public.inventory_items set status = 'vorhanden' where id = existing_id;
      else
        update public.inventory_items
          set quantity = coalesce(quantity, 0) + coalesce(entry.inventory_quantity, 0), status = 'vorhanden'
          where id = existing_id;
      end if;
    else
      insert into public.inventory_items (user_id, name, tracking_type, quantity, unit, location, status, note)
      values (
        auth.uid(), entry.name, entry.inventory_tracking_type,
        case when entry.inventory_tracking_type = 'exact' then coalesce(entry.inventory_quantity, 0) else null end,
        entry.inventory_unit, entry.inventory_location, 'vorhanden', 'Aus Einkauf übernommen'
      );
    end if;

    update public.shopping_items set added_to_inventory = true where id = entry.id;
  end loop;

  update public.shopping_items
    set remember_for_next = false
    where list_id = p_list_id and user_id = auth.uid() and is_checked;

  update public.shopping_lists set completed_at = now() where id = p_list_id and user_id = auth.uid();
end $$;

create or replace function public.complete_cooking_session(p_session_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare
  recipe_to_finish uuid;
  already_finished timestamptz;
  usage record;
  existing_id uuid;
begin
  select recipe_id, completed_at into recipe_to_finish, already_finished
    from public.cooking_sessions where id = p_session_id and user_id = auth.uid();
  if recipe_to_finish is null then raise exception 'Koch-Session nicht gefunden'; end if;
  if already_finished is not null then return; end if;

  for usage in
    select * from public.recipe_consumptions
    where recipe_id = recipe_to_finish and user_id = auth.uid() and tracking_type = 'exact'
    order by position
  loop
    existing_id := null;
    select id into existing_id from public.inventory_items
      where user_id = auth.uid() and lower(name) = lower(usage.inventory_name)
        and tracking_type = 'exact' and unit = usage.unit
      order by created_at limit 1;
    if existing_id is not null then
      update public.inventory_items
        set quantity = greatest(0, coalesce(quantity, 0) - usage.quantity),
            status = case when greatest(0, coalesce(quantity, 0) - usage.quantity) = 0 then 'leer' else 'vorhanden' end
        where id = existing_id;
    end if;
  end loop;

  update public.cooking_sessions set completed_at = now() where id = p_session_id and user_id = auth.uid();
end $$;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke execute on function public.checkout_shopping_list(uuid) from public, anon;
revoke execute on function public.complete_cooking_session(uuid) from public, anon;
grant execute on function public.checkout_shopping_list(uuid) to authenticated;
grant execute on function public.complete_cooking_session(uuid) to authenticated;
