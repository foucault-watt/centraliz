-- Verify that the backend uses a server secret / service_role before applying.
-- Apply before deploying the application. Existing accounts keep their mode.
begin;

alter table public.users
  add column ent_password_storage text not null default 'legacy'
  check (ent_password_storage in ('legacy', 'browser'));

-- Both tables are accessed by Express with its server-side Supabase credentials.
-- Direct client access would expose historical credentials and let clients
-- change the mode assigned to a user's account.
alter table public.passwords enable row level security;
alter table public.users enable row level security;
revoke all privileges on table public.passwords, public.users
  from public, anon, authenticated;

commit;

-- After deploying and validating the backend and frontend together, enable the
-- new mode for future accounts only:
-- alter table public.users alter column ent_password_storage set default 'browser';
-- To suspend enrollment, set the default back to 'legacy'. This does not change
-- any account already created in browser mode.
