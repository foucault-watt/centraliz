alter table public.users
  add column if not exists theme_color text null,
  add column if not exists theme_color_dark text null;
