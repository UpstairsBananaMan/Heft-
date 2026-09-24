-- Moves around town: opted-in, admin-approved before-and-after posts.
-- Demo rows never come from this table. The app only inserts pending, non-demo posts.

alter table public.driver_profiles
  add column if not exists show_name_in_feed boolean not null default false;

alter table public.ratings
  add column if not exists share_photos boolean not null default false;

create table if not exists public.feed_posts (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid references public.jobs (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  is_demo boolean not null default false,
  item_label text not null,
  size_label text not null,
  item_type text,
  size_category text,
  pickup_area text not null,
  dropoff_area text not null,
  month_label text not null,
  driver_name text,
  rating_avg numeric,
  rating_count int,
  before_key text,
  after_key text,
  approved_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feed_posts enable row level security;

drop policy if exists feed_posts_select on public.feed_posts;
create policy feed_posts_select on public.feed_posts
for select to authenticated
using (
  public.is_admin()
  or status = 'approved'
  or exists (
    select 1 from public.jobs j
    where j.id = job_id and j.customer_id = auth.uid()
  )
);

drop policy if exists feed_posts_insert on public.feed_posts;
create policy feed_posts_insert on public.feed_posts
for insert to authenticated
with check (
  status = 'pending'
  and is_demo = false
  and exists (
    select 1 from public.jobs j
    where j.id = job_id and j.customer_id = auth.uid()
  )
);

drop policy if exists feed_posts_update on public.feed_posts;
create policy feed_posts_update on public.feed_posts
for update to authenticated
using (public.is_admin())
with check (public.is_admin());
