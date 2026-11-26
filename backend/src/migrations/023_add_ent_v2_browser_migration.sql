begin;

alter table public.users add column ent_password_migration_id uuid;

-- A request started by an old session cannot recreate a server copy.
create function public.reject_browser_ent_password()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  storage_mode text;
begin
  select u.ent_password_storage into storage_mode
    from public.users u where u.ent_username = new.ent_username for share;
  if storage_mode = 'browser' then
    raise exception 'ENT password belongs in the browser' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reject_browser_ent_password
before insert or update of ent_username, encrypted_password on public.passwords
for each row execute function public.reject_browser_ent_password();

revoke all on function public.reject_browser_ent_password()
  from public, anon, authenticated;

create function public.migrate_ent_v2_to_browser(
  account_name text, ent_name text, expected_password text, migration_id uuid
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  account public.users%rowtype;
begin
  -- Lock in the same order as a password update followed by its trigger.
  perform 1 from public.passwords where ent_username = ent_name for update;
  select * into account from public.users where username = account_name for update;
  if not found or account.ent_username is distinct from ent_name then
    return false;
  end if;
  if account.ent_password_storage = 'browser' then
    return account.ent_password_migration_id is not distinct from migration_id
      and migration_id is not null;
  end if;
  if migration_id is null or expected_password is null
      or expected_password not like 'v2:%' then
    return false;
  end if;

  delete from public.passwords
    where ent_username = ent_name and encrypted_password = expected_password;
  if not found then
    return false;
  end if;
  update public.users set ent_password_storage = 'browser',
    ent_password_migration_id = migration_id
    where username = account_name;
  return true;
end;
$$;

revoke all on function public.migrate_ent_v2_to_browser(text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.migrate_ent_v2_to_browser(text, text, text, uuid)
  to service_role;

commit;
