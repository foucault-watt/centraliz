create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  username text not null references public.users(username) on update cascade on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  device_label text null,
  platform text null,
  is_active boolean not null default true,
  last_seen_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_username_idx
  on public.push_subscriptions(username);

create index if not exists push_subscriptions_is_active_idx
  on public.push_subscriptions(is_active);

create index if not exists push_subscriptions_last_seen_at_idx
  on public.push_subscriptions(last_seen_at desc);

create table if not exists public.push_test_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by text not null references public.users(username) on update cascade on delete restrict,
  title text not null,
  body text not null,
  icon_url text null,
  image_url text null,
  click_url text null,
  tag text null,
  require_interaction boolean not null default false,
  target_mode text not null default 'manual_users',
  target_snapshot jsonb not null default '[]'::jsonb,
  payload_json jsonb not null default '{}'::jsonb,
  sent_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  invalidated_count integer not null default 0,
  created_at timestamp with time zone not null default now()
);

create index if not exists push_test_campaigns_created_by_idx
  on public.push_test_campaigns(created_by);

create index if not exists push_test_campaigns_created_at_idx
  on public.push_test_campaigns(created_at desc);

create table if not exists public.push_test_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.push_test_campaigns(id) on delete cascade,
  username text not null references public.users(username) on update cascade on delete cascade,
  subscription_id uuid null references public.push_subscriptions(id) on update cascade on delete set null,
  status text not null,
  error_code text null,
  error_message text null,
  provider_response text null,
  created_at timestamp with time zone not null default now()
);

create index if not exists push_test_campaign_deliveries_campaign_id_idx
  on public.push_test_campaign_deliveries(campaign_id);

create index if not exists push_test_campaign_deliveries_username_idx
  on public.push_test_campaign_deliveries(username);

create index if not exists push_test_campaign_deliveries_created_at_idx
  on public.push_test_campaign_deliveries(created_at desc);
