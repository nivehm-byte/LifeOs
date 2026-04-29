-- Trigger: auto-create a public.users row when a new auth user signs up.
-- Also backfills any existing auth.users who have no public.users row yet.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Fire after every new Supabase Auth sign-up
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill: create public.users rows for any auth user that doesn't have one yet
-- (covers the account that already exists before this migration ran)
insert into public.users (id, email, name)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1))
from auth.users au
where not exists (
  select 1 from public.users pu where pu.id = au.id
);
