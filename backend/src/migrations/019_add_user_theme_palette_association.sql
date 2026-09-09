alter table public.users
  add column if not exists theme_palette_association_id uuid null
    references public.theme_palette_associations(id) on delete set null;
