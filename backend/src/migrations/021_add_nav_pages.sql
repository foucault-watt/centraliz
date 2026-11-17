-- Pages de la navbar du bas, pilotées depuis l'admin.
-- promos : promos de base autorisées (ex: {G1,G2}). Tableau vide = toutes les promos.
create table if not exists public.nav_pages (
  id text primary key,
  is_active boolean not null default false,
  promos text[] not null default '{}',
  display_order integer not null default 0,
  updated_at timestamp with time zone not null default now()
);

create index if not exists nav_pages_display_order_idx on public.nav_pages(display_order);

insert into public.nav_pages (id, is_active, display_order) values
  ('links', true, 0),
  ('calendars', true, 1),
  ('communication', true, 2),
  ('cekilui', true, 3),
  ('notes', false, 4),
  ('pokemon', false, 5),
  ('bibli', false, 6)
on conflict (id) do nothing;
