-- Stores Web Push subscriptions for each browser/device.
-- One user can have multiple subscriptions (phone, laptop, etc.).
create table public.push_subscriptions (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references public.users (id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  user_agent text,
  created_at timestamptz not null default now(),

  unique (endpoint)
);

create index idx_push_subs_user_id on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: own rows only"
  on public.push_subscriptions
  for all
  using  (is_owner(user_id))
  with check (is_owner(user_id));
