-- Heft MVP schema. Locked 2026-09-21.
-- Lat/lng columns plus haversine (PostGIS not required).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.vehicle_rank(v text)
returns integer
language sql
immutable
as $$
  select case v
    when 'pickup' then 1
    when 'cargo_van' then 2
    when 'box_truck' then 3
    when 'flatbed' then 4
    else 0
  end;
$$;

create or replace function public.distance_miles(
  lat1 float8,
  lng1 float8,
  lat2 float8,
  lng2 float8
)
returns numeric
language sql
immutable
as $$
  select round((
    3958.7613 * acos(
      least(1.0::float8, greatest(-1.0::float8,
        cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
        + sin(radians(lat1)) * sin(radians(lat2))
      ))
    )
  )::numeric, 2);
$$;

create or replace function public.in_pensacola(lat float8, lng float8)
returns boolean
language sql
immutable
as $$
  select lat between 30.1 and 30.7 and lng between -87.6 and -86.9;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('customer', 'driver', 'admin')),
  display_name text not null,
  phone text,
  avatar_url text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create table public.customer_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  default_address text,
  default_lat float8,
  default_lng float8,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0
);

create table public.driver_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  vehicle_type text not null check (vehicle_type in ('pickup', 'cargo_van', 'box_truck', 'flatbed')),
  capacity_lbs integer check (capacity_lbs is null or capacity_lbs > 0),
  bed_length_ft numeric(4, 1) check (bed_length_ft is null or bed_length_ft > 0),
  service_lat float8 not null,
  service_lng float8 not null,
  service_radius_miles numeric(5, 1) not null default 25 check (service_radius_miles > 0),
  stripe_connect_account_id text,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  is_online boolean not null default false,
  current_lat float8,
  current_lng float8,
  last_seen_at timestamptz
);

create table public.jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_id uuid not null references public.users (id),
  driver_id uuid references public.users (id),
  status text not null default 'draft' check (status in (
    'draft', 'priced', 'open', 'assigned',
    'en_route_pickup', 'at_pickup', 'en_route_dropoff', 'at_dropoff',
    'delivered', 'paid', 'cancelled', 'disputed'
  )),
  pickup_address text not null,
  pickup_lat float8 not null,
  pickup_lng float8 not null,
  pickup_notes text,
  dropoff_address text not null,
  dropoff_lat float8 not null,
  dropoff_lng float8 not null,
  dropoff_notes text,
  item_description text not null,
  size_category text not null check (size_category in ('small', 'medium', 'large', 'xl')),
  vehicle_required text not null check (vehicle_required in ('pickup', 'cargo_van', 'box_truck', 'flatbed')),
  distance_miles numeric(6, 2),
  estimate_cents integer check (estimate_cents is null or estimate_cents >= 0),
  final_cents integer check (final_cents is null or final_cents >= 0),
  platform_fee_cents integer check (platform_fee_cents is null or platform_fee_cents >= 0),
  driver_payout_cents integer check (driver_payout_cents is null or driver_payout_cents >= 0),
  stripe_payment_intent_id text,
  scheduled_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_status_idx on public.jobs (status);
create index jobs_customer_id_idx on public.jobs (customer_id);
create index jobs_driver_id_idx on public.jobs (driver_id);
create index jobs_created_at_idx on public.jobs (created_at desc);
create index jobs_pickup_lat_lng_idx on public.jobs (pickup_lat, pickup_lng);

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create table public.job_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('item', 'pod')),
  created_at timestamptz not null default now()
);

create index job_photos_job_id_idx on public.job_photos (job_id);

create table public.job_events (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  type text not null,
  actor_id uuid references public.users (id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index job_events_job_id_created_idx on public.job_events (job_id, created_at);

create table public.ratings (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs (id),
  from_user_id uuid not null references public.users (id),
  to_user_id uuid not null references public.users (id),
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (job_id, from_user_id)
);

create table public.disputes (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs (id),
  opened_by uuid not null references public.users (id),
  reason text not null,
  status text not null default 'open' check (status in (
    'open', 'investigating', 'resolved_customer', 'resolved_driver', 'closed'
  )),
  resolution_notes text,
  resolved_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index disputes_one_active_idx
  on public.disputes (job_id)
  where status in ('open', 'investigating');

create table public.pricing_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  market text not null default 'pensacola',
  vehicle_type text not null check (vehicle_type in ('pickup', 'cargo_van', 'box_truck', 'flatbed')),
  size_category text not null check (size_category in ('small', 'medium', 'large', 'xl')),
  base_cents integer not null check (base_cents >= 0),
  per_mile_cents integer not null check (per_mile_cents >= 0),
  min_cents integer not null check (min_cents >= 0),
  size_multiplier numeric(4, 2) not null default 1 check (size_multiplier > 0),
  active boolean not null default true,
  effective_from timestamptz not null default now()
);

create unique index pricing_rules_one_active_idx
  on public.pricing_rules (market, vehicle_type, size_category)
  where active;

create table public.payouts (
  id uuid primary key default extensions.gen_random_uuid(),
  driver_id uuid not null references public.users (id),
  job_id uuid not null references public.jobs (id),
  amount_cents integer not null check (amount_cents >= 0),
  stripe_transfer_id text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

create index payouts_driver_id_idx on public.payouts (driver_id);
create unique index payouts_job_id_idx on public.payouts (job_id);

create table public.device_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create trigger device_tokens_set_updated_at
before update on public.device_tokens
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth signup: one role, admin is not self-serve
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  name text;
begin
  r := coalesce(new.raw_user_meta_data->>'role', 'customer');
  if r not in ('customer', 'driver') then
    r := 'customer';
  end if;
  name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  if name is null then
    name := split_part(coalesce(new.email, 'member'), '@', 1);
  end if;
  insert into public.users (id, role, display_name, phone)
  values (new.id, r, name, nullif(new.raw_user_meta_data->>'phone', ''));
  if r = 'customer' then
    insert into public.customer_profiles (user_id) values (new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     or new.stripe_customer_id is distinct from old.stripe_customer_id then
    if auth.uid() is null
       or public.is_admin()
       or coalesce(auth.role(), '') = 'service_role' then
      return new;
    end if;
    raise exception 'role and billing ids are not self-serve';
  end if;
  return new;
end;
$$;

create trigger users_protect_role
before update on public.users
for each row execute function public.protect_user_role();

create or replace function public.protect_driver_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if auth.uid() is not null
       and not public.is_admin()
       and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'only an admin can change driver approval';
    end if;
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'driver profile owner cannot change';
  end if;
  -- Throttle live location to every 8 seconds while a job is active.
  if (new.current_lat is distinct from old.current_lat
      or new.current_lng is distinct from old.current_lng)
     and old.last_seen_at is not null
     and now() < old.last_seen_at + interval '8 seconds'
     and auth.uid() is not null
     and not public.is_admin() then
    new.current_lat := old.current_lat;
    new.current_lng := old.current_lng;
    new.last_seen_at := old.last_seen_at;
  end if;
  return new;
end;
$$;

create trigger driver_profiles_protect
before update on public.driver_profiles
for each row execute function public.protect_driver_profile();

create or replace function public.apply_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  avg numeric(3, 2);
  cnt integer;
begin
  select role into target_role from public.users where id = new.to_user_id;
  select round(avg(stars)::numeric, 2), count(*)::integer
    into avg, cnt
  from public.ratings
  where to_user_id = new.to_user_id;
  if target_role = 'driver' then
    update public.driver_profiles
    set rating_avg = coalesce(avg, 0), rating_count = cnt
    where user_id = new.to_user_id;
  elsif target_role = 'customer' then
    update public.customer_profiles
    set rating_avg = coalesce(avg, 0), rating_count = cnt
    where user_id = new.to_user_id;
  end if;
  return new;
end;
$$;

create trigger ratings_apply
after insert on public.ratings
for each row execute function public.apply_rating();

create or replace function public.on_dispute_opened()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prev text;
begin
  select status into prev from public.jobs where id = new.job_id;
  update public.jobs
  set status = 'disputed'
  where id = new.job_id
    and status not in ('cancelled', 'disputed');
  insert into public.job_events (job_id, type, actor_id, payload)
  values (
    new.job_id,
    'disputed',
    new.opened_by,
    jsonb_build_object(
      'reason', new.reason,
      'previous_status', prev,
      'dispute_id', new.id
    )
  );
  return new;
end;
$$;

create trigger disputes_open_job
after insert on public.disputes
for each row execute function public.on_dispute_opened();

-- ---------------------------------------------------------------------------
-- Visibility helpers (security definer so policies do not recurse)
-- ---------------------------------------------------------------------------

create or replace function public.can_read_job(p_job_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  j public.jobs;
  uid uuid := auth.uid();
begin
  if uid is null then
    return false;
  end if;
  if public.is_admin() then
    return true;
  end if;
  select * into j from public.jobs where id = p_job_id;
  if not found then
    return false;
  end if;
  if j.customer_id = uid or j.driver_id = uid then
    return true;
  end if;
  if j.status <> 'open' then
    return false;
  end if;
  return exists (
    select 1
    from public.driver_profiles d
    where d.user_id = uid
      and d.status = 'approved'
      and d.is_online
      and public.vehicle_rank(d.vehicle_type) >= public.vehicle_rank(j.vehicle_required)
      and public.distance_miles(d.service_lat, d.service_lng, j.pickup_lat, j.pickup_lng)
          <= d.service_radius_miles
  );
end;
$$;

create or replace function public.can_read_driver_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    auth.uid() = p_user_id
    or public.is_admin()
    or exists (
      select 1
      from public.jobs j
      where j.driver_id = p_user_id
        and j.customer_id = auth.uid()
        and j.status in (
          'assigned', 'en_route_pickup', 'at_pickup', 'en_route_dropoff',
          'at_dropoff', 'delivered', 'paid', 'disputed'
        )
    )
  );
$$;

-- Own row, admin, or the other party on a shared job (so names render).
create or replace function public.can_read_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    auth.uid() = p_user_id
    or public.is_admin()
    or exists (
      select 1 from public.jobs j
      where (j.customer_id = auth.uid() and j.driver_id = p_user_id)
         or (j.driver_id = auth.uid() and j.customer_id = p_user_id)
    )
  );
$$;

create or replace function public.dispute_window_open(p_job_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  j public.jobs;
  paid_at timestamptz;
  uid uuid := auth.uid();
begin
  if uid is null then
    return false;
  end if;
  select * into j from public.jobs where id = p_job_id;
  if not found then
    return false;
  end if;
  if uid <> j.customer_id and uid <> j.driver_id then
    return false;
  end if;
  if j.driver_id is null then
    return false;
  end if;
  if j.status not in (
    'assigned', 'en_route_pickup', 'at_pickup', 'en_route_dropoff',
    'at_dropoff', 'delivered', 'paid'
  ) then
    return false;
  end if;
  if j.status = 'paid' then
    select e.created_at into paid_at
    from public.job_events e
    where e.job_id = p_job_id and e.type = 'paid'
    order by e.created_at desc
    limit 1;
    if paid_at is null or paid_at < now() - interval '72 hours' then
      return false;
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.storage_owner_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  folder text := split_part(object_name, '/', 1);
begin
  if folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return folder::uuid;
  end if;
  return null;
end;
$$;

-- Atomic first-accept. Service role only (edge function).
create or replace function public.accept_job(p_job_id uuid, p_driver_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.driver_profiles;
  j public.jobs;
begin
  select * into d from public.driver_profiles where user_id = p_driver_id for update;
  if not found then
    raise exception 'driver profile required';
  end if;
  if d.status <> 'approved' then
    raise exception 'driver is not approved';
  end if;
  if not d.is_online then
    raise exception 'driver is offline';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'job not found';
  end if;
  if j.status <> 'open' or j.driver_id is not null then
    raise exception 'job is no longer open';
  end if;
  if public.vehicle_rank(d.vehicle_type) < public.vehicle_rank(j.vehicle_required) then
    raise exception 'vehicle class is too small for this job';
  end if;
  if public.distance_miles(d.service_lat, d.service_lng, j.pickup_lat, j.pickup_lng) > d.service_radius_miles then
    raise exception 'pickup is outside your service radius';
  end if;

  update public.jobs
  set status = 'assigned',
      driver_id = p_driver_id,
      accepted_at = now()
  where id = p_job_id
    and status = 'open'
    and driver_id is null
  returning * into j;

  if j.id is null then
    raise exception 'job is no longer open';
  end if;

  insert into public.job_events (job_id, type, actor_id, payload)
  values (p_job_id, 'accepted', p_driver_id, jsonb_build_object('driver_id', p_driver_id));

  return j;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_events enable row level security;
alter table public.ratings enable row level security;
alter table public.disputes enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.payouts enable row level security;
alter table public.device_tokens enable row level security;

create policy users_select on public.users
for select to authenticated
using (public.can_read_user(id));

create policy users_update on public.users
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy customer_profiles_select on public.customer_profiles
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy customer_profiles_insert on public.customer_profiles
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer')
);

create policy customer_profiles_update on public.customer_profiles
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy driver_profiles_select on public.driver_profiles
for select to authenticated
using (public.can_read_driver_profile(user_id));

create policy driver_profiles_insert on public.driver_profiles
for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'driver')
);

create policy driver_profiles_update on public.driver_profiles
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy jobs_select on public.jobs
for select to authenticated
using (public.can_read_job(id));

create policy jobs_insert on public.jobs
for insert to authenticated
with check (
  customer_id = auth.uid()
  and status = 'draft'
  and driver_id is null
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer')
);

create policy jobs_update_draft on public.jobs
for update to authenticated
using (customer_id = auth.uid() and status in ('draft', 'priced'))
with check (customer_id = auth.uid() and status = 'draft' and driver_id is null);

create policy jobs_update_admin on public.jobs
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy job_photos_select on public.job_photos
for select to authenticated
using (public.can_read_job(job_id));

create policy job_photos_insert on public.job_photos
for insert to authenticated
with check (
  (
    kind = 'item'
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.customer_id = auth.uid()
    )
  )
  or (
    kind = 'pod'
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.driver_id = auth.uid()
        and j.status in ('at_dropoff', 'delivered', 'disputed')
    )
  )
);

create policy job_events_select on public.job_events
for select to authenticated
using (public.can_read_job(job_id));

create policy job_events_insert_admin on public.job_events
for insert to authenticated
with check (public.is_admin());

create policy ratings_select on public.ratings
for select to authenticated
using (
  public.is_admin()
  or from_user_id = auth.uid()
  or to_user_id = auth.uid()
  or public.can_read_job(job_id)
);

create policy ratings_insert on public.ratings
for insert to authenticated
with check (
  from_user_id = auth.uid()
  and exists (
    select 1 from public.jobs j
    where j.id = job_id
      and j.status in ('delivered', 'paid', 'disputed')
      and (
        (j.customer_id = auth.uid() and to_user_id = j.driver_id)
        or (j.driver_id = auth.uid() and to_user_id = j.customer_id)
      )
  )
);

create policy disputes_select on public.disputes
for select to authenticated
using (
  public.is_admin()
  or opened_by = auth.uid()
  or exists (
    select 1 from public.jobs j
    where j.id = job_id
      and (j.customer_id = auth.uid() or j.driver_id = auth.uid())
  )
);

create policy disputes_insert on public.disputes
for insert to authenticated
with check (
  opened_by = auth.uid()
  and public.dispute_window_open(job_id)
);

create policy disputes_update_admin on public.disputes
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy pricing_rules_select on public.pricing_rules
for select to authenticated
using (true);

create policy pricing_rules_insert_admin on public.pricing_rules
for insert to authenticated
with check (public.is_admin());

create policy pricing_rules_update_admin on public.pricing_rules
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy pricing_rules_delete_admin on public.pricing_rules
for delete to authenticated
using (public.is_admin());

create policy payouts_select on public.payouts
for select to authenticated
using (driver_id = auth.uid() or public.is_admin());

create policy device_tokens_all on public.device_tokens
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;

revoke all on function public.accept_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_job(uuid, uuid) to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

do $$
begin
  grant execute on function public.handle_new_user() to supabase_auth_admin;
exception
  when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Storage (private buckets, signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('pod', 'pod', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy job_photos_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'job-photos'
  and (
    public.is_admin()
    or public.can_read_job(public.storage_owner_id(name))
  )
);

create policy job_photos_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'job-photos'
  and exists (
    select 1 from public.jobs j
    where j.id = public.storage_owner_id(name)
      and j.customer_id = auth.uid()
  )
);

create policy pod_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'pod'
  and (
    public.is_admin()
    or public.can_read_job(public.storage_owner_id(name))
  )
);

create policy pod_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'pod'
  and exists (
    select 1 from public.jobs j
    where j.id = public.storage_owner_id(name)
      and j.driver_id = auth.uid()
      and j.status in ('at_dropoff', 'delivered', 'disputed')
  )
);

create policy avatars_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or public.storage_owner_id(name) = auth.uid()
  )
);

create policy avatars_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and public.storage_owner_id(name) = auth.uid()
);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.jobs replica identity full;
alter table public.driver_profiles replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.jobs;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.driver_profiles;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
