create table if not exists public.theme_palette_associations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_primary text not null,
  color_primary_dark text null,
  icon_filename text null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists theme_palette_associations_display_order_idx
  on public.theme_palette_associations(display_order);

create index if not exists theme_palette_associations_is_active_idx
  on public.theme_palette_associations(is_active);

-- Placeholder entries so the picker has something to show; replace/manage
-- these from the admin panel (Assos & couleurs admin) with real associations.
insert into public.theme_palette_associations (id, name, color_primary, color_primary_dark, display_order)
values
  ('11111111-1111-1111-1111-111111111101', 'Association Test 1', '#597ee5', '#4267ce', 0),
  ('11111111-1111-1111-1111-111111111102', 'Association Test 2', '#7c5cff', '#6342d9', 1),
  ('11111111-1111-1111-1111-111111111103', 'Association Test 3', '#14b8a6', '#0f9488', 2),
  ('11111111-1111-1111-1111-111111111104', 'Association Test 4', '#ec4899', '#db2777', 3),
  ('11111111-1111-1111-1111-111111111105', 'Association Test 5', '#f59e0b', '#d97706', 4),
  ('11111111-1111-1111-1111-111111111106', 'Association Test 6', '#22c55e', '#16a34a', 5)
on conflict (id) do nothing;
