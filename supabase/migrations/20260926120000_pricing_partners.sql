-- Pricing + partners. Renames the second-person flag and adds the approved quote inputs.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'needs_helper'
  ) then
    alter table public.jobs rename column needs_helper to needs_second_person;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'needs_second_person'
  ) then
    alter table public.jobs add column needs_second_person boolean not null default false;
  end if;
end $$;

alter table public.jobs drop constraint if exists jobs_size_category_check;
alter table public.jobs
  add constraint jobs_size_category_check check (size_category in ('small', 'medium', 'large', 'xl', 'truckload'));

alter table public.jobs
  add column if not exists size_tier text,
  add column if not exists weight_band text,
  add column if not exists billable_miles int,
  add column if not exists distance_source text,
  add column if not exists est_job_minutes int,
  add column if not exists rates_version text,
  add column if not exists quoted_at timestamptz,
  add column if not exists pickup_zip text,
  add column if not exists dropoff_zip text,
  add column if not exists pickup_in_zone boolean,
  add column if not exists dropoff_in_zone boolean,
  add column if not exists driver_share_cents int,
  add column if not exists lead_payout_cents int,
  add column if not exists helper_payout_cents int,
  add column if not exists partner_driver_id uuid references public.users (id),
  add column if not exists partner_lost_at timestamptz;

update public.jobs set size_tier = size_category where size_tier is null;

alter table public.jobs drop constraint if exists jobs_size_tier_check;
alter table public.jobs
  add constraint jobs_size_tier_check check (size_tier is null or size_tier in ('small', 'medium', 'large', 'xl', 'truckload'));

alter table public.jobs drop constraint if exists jobs_pickup_flights_check;
alter table public.jobs drop constraint if exists jobs_dropoff_flights_check;
alter table public.jobs
  add constraint jobs_pickup_flights_check check (stairs_pickup_flights between 0 and 6),
  add constraint jobs_dropoff_flights_check check (stairs_dropoff_flights between 0 and 6);

alter table public.jobs drop constraint if exists jobs_weight_band_check;
alter table public.jobs
  add constraint jobs_weight_band_check check (weight_band is null or weight_band in ('under_150', '150_300', 'over_300'));

alter table public.jobs drop constraint if exists jobs_distance_source_check;
alter table public.jobs
  add constraint jobs_distance_source_check check (distance_source is null or distance_source in ('maps', 'estimated'));

alter table public.driver_profiles
  add column if not exists partner_only boolean not null default false,
  add column if not exists background_check_at timestamptz,
  add column if not exists background_check_by uuid references public.users (id);

alter table public.driver_profiles alter column vehicle_type drop not null;
alter table public.driver_profiles alter column service_lat drop not null;
alter table public.driver_profiles alter column service_lng drop not null;

alter table public.driver_profiles drop constraint if exists driver_profiles_lead_vehicle_check;
alter table public.driver_profiles
  add constraint driver_profiles_lead_vehicle_check check (partner_only or vehicle_type is not null);

alter table public.driver_documents drop constraint if exists driver_documents_kind_check;
alter table public.driver_documents
  add constraint driver_documents_kind_check check (kind in ('vehicle_photo', 'license', 'insurance', 'profile_photo'));

drop index if exists public.payouts_job_id_idx;
alter table public.payouts add column if not exists role text not null default 'lead';
alter table public.payouts drop constraint if exists payouts_role_check;
alter table public.payouts add constraint payouts_role_check check (role in ('lead', 'partner'));
create unique index if not exists payouts_job_driver_idx on public.payouts (job_id, driver_id);

create table if not exists public.service_zone_zips (
  market text not null,
  zip text not null,
  primary key (market, zip)
);

insert into public.service_zone_zips (market, zip) values
  ('pensacola', '32501'), ('pensacola', '32502'), ('pensacola', '32503'), ('pensacola', '32504'),
  ('pensacola', '32505'), ('pensacola', '32506'), ('pensacola', '32507'), ('pensacola', '32508'),
  ('pensacola', '32509'), ('pensacola', '32511'), ('pensacola', '32512'), ('pensacola', '32513'),
  ('pensacola', '32514'), ('pensacola', '32516'), ('pensacola', '32520'), ('pensacola', '32521'),
  ('pensacola', '32522'), ('pensacola', '32523'), ('pensacola', '32524'), ('pensacola', '32526'),
  ('pensacola', '32530'), ('pensacola', '32533'), ('pensacola', '32534'), ('pensacola', '32559'),
  ('pensacola', '32560'), ('pensacola', '32561'), ('pensacola', '32562'), ('pensacola', '32563'),
  ('pensacola', '32570'), ('pensacola', '32571'), ('pensacola', '32572'), ('pensacola', '32577'),
  ('pensacola', '32583'), ('pensacola', '32591')
on conflict do nothing;

create table if not exists public.rate_cards (
  id uuid primary key default extensions.gen_random_uuid(),
  market text not null,
  vehicle_type text not null,
  rates_version text not null,
  active boolean not null default true,
  base_cents int not null,
  per_mile_cents int not null,
  min_fare_cents int not null,
  platform_fee_bps int not null,
  stairs_per_flight_cents int not null,
  second_person_per_hour_cents int not null,
  second_person_min_cents int not null,
  second_person_step_cents int not null,
  out_of_town_per_mile_cents int not null,
  max_loaded_miles int not null,
  max_flights_per_stop int not null,
  est_deadhead_miles numeric not null,
  est_city_min_per_mile numeric not null,
  est_highway_min_per_mile numeric not null,
  est_highway_after_miles numeric not null,
  est_admin_minutes int not null,
  est_minutes_per_flight int not null,
  unique (market, vehicle_type, rates_version)
);

create table if not exists public.size_tier_rates (
  rate_card_id uuid not null references public.rate_cards (id) on delete cascade,
  size_tier text not null check (size_tier in ('small', 'medium', 'large', 'xl', 'truckload')),
  addon_cents int not null,
  est_load_minutes int not null,
  primary key (rate_card_id, size_tier)
);

insert into public.rate_cards (
  market, vehicle_type, rates_version, active,
  base_cents, per_mile_cents, min_fare_cents, platform_fee_bps,
  stairs_per_flight_cents, second_person_per_hour_cents, second_person_min_cents, second_person_step_cents,
  out_of_town_per_mile_cents, max_loaded_miles, max_flights_per_stop,
  est_deadhead_miles, est_city_min_per_mile, est_highway_min_per_mile, est_highway_after_miles,
  est_admin_minutes, est_minutes_per_flight
) values (
  'pensacola', 'pickup', '2026-09-24', true,
  3900, 200, 5500, 1500,
  1500, 3000, 4500, 500,
  175, 70, 6,
  15, 2.0, 1.2, 25,
  10, 5
) on conflict (market, vehicle_type, rates_version) do nothing;

insert into public.size_tier_rates (rate_card_id, size_tier, addon_cents, est_load_minutes)
select id, tier, addon, minutes
from public.rate_cards
cross join (values
  ('small', 0, 10),
  ('medium', 2000, 20),
  ('large', 4000, 30),
  ('xl', 6500, 45),
  ('truckload', 12000, 120)
) as sizes(tier, addon, minutes)
where rates_version = '2026-09-24' and vehicle_type = 'pickup'
on conflict do nothing;

create table if not exists public.driver_partnerships (
  id uuid primary key default extensions.gen_random_uuid(),
  lead_id uuid not null references public.users (id),
  partner_id uuid not null references public.users (id),
  shift_date date not null,
  status text not null check (status in ('pending', 'accepted', 'declined', 'ended')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.users (id),
  check (lead_id <> partner_id)
);

create unique index if not exists driver_partnerships_one_lead_day
  on public.driver_partnerships (lead_id, shift_date)
  where status in ('pending', 'accepted');

create unique index if not exists driver_partnerships_one_partner_day
  on public.driver_partnerships (partner_id, shift_date)
  where status = 'accepted';

alter table public.service_zone_zips enable row level security;
alter table public.rate_cards enable row level security;
alter table public.size_tier_rates enable row level security;
alter table public.driver_partnerships enable row level security;

drop policy if exists zone_read on public.service_zone_zips;
create policy zone_read on public.service_zone_zips for select to authenticated using (true);

drop policy if exists rates_read on public.rate_cards;
create policy rates_read on public.rate_cards for select to authenticated using (true);

drop policy if exists tiers_read on public.size_tier_rates;
create policy tiers_read on public.size_tier_rates for select to authenticated using (true);

drop policy if exists partnerships_read on public.driver_partnerships;
create policy partnerships_read on public.driver_partnerships
for select to authenticated
using (lead_id = auth.uid() or partner_id = auth.uid() or public.is_admin());

create or replace function public.chicago_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Chicago')::date;
$$;

create or replace function public.active_partner(p_lead_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.partner_id
  from public.driver_partnerships p
  join public.driver_profiles d on d.user_id = p.partner_id
  where p.lead_id = p_lead_id
    and p.status = 'accepted'
    and p.shift_date = public.chicago_today()
    and d.status = 'approved'
    and d.background_check_at is not null
    and d.stripe_connect_account_id is not null
  limit 1;
$$;

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
  profile public.driver_profiles;
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
  if j.customer_id = uid or j.driver_id = uid or j.partner_driver_id = uid then
    return true;
  end if;
  if j.status <> 'open' then
    return false;
  end if;
  select * into profile from public.driver_profiles where user_id = uid;
  if profile.user_id is null or profile.partner_only or profile.status <> 'approved' or not profile.is_online then
    return false;
  end if;
  if exists (
    select 1 from public.driver_partnerships p
    where p.partner_id = uid and p.status = 'accepted' and p.shift_date = public.chicago_today()
  ) then
    return false;
  end if;
  return public.vehicle_rank(profile.vehicle_type) >= public.vehicle_rank(j.vehicle_required)
    and profile.service_lat is not null
    and profile.service_lng is not null
    and public.distance_miles(profile.service_lat, profile.service_lng, j.pickup_lat, j.pickup_lng) <= profile.service_radius_miles;
end;
$$;

create or replace function public.accept_job(p_job_id uuid, p_driver_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.driver_profiles;
  j public.jobs;
  partner uuid;
begin
  select * into d from public.driver_profiles where user_id = p_driver_id for update;
  if not found then
    raise exception 'driver profile required';
  end if;
  if d.partner_only then
    raise exception 'partner-only accounts cannot accept jobs as a lead';
  end if;
  if d.status <> 'approved' then
    raise exception 'driver is not approved';
  end if;
  if not d.is_online then
    raise exception 'driver is offline';
  end if;
  if exists (
    select 1 from public.driver_partnerships p
    where p.partner_id = p_driver_id and p.status = 'accepted' and p.shift_date = public.chicago_today()
  ) then
    raise exception 'You are partnered today';
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
  if d.service_lat is null or d.service_lng is null
     or public.distance_miles(d.service_lat, d.service_lng, j.pickup_lat, j.pickup_lng) > d.service_radius_miles then
    raise exception 'pickup is outside your service radius';
  end if;

  partner := null;
  if j.needs_second_person then
    partner := public.active_partner(p_driver_id);
    if partner is null then
      raise exception 'Add a partner first';
    end if;
  end if;

  update public.jobs
  set status = 'assigned',
      driver_id = p_driver_id,
      partner_driver_id = partner,
      accepted_at = now(),
      partner_lost_at = null
  where id = p_job_id
    and status = 'open'
    and driver_id is null
  returning * into j;

  if j.id is null then
    raise exception 'job is no longer open';
  end if;

  insert into public.job_events (job_id, type, actor_id, payload)
  values (p_job_id, 'accepted', p_driver_id, jsonb_build_object('driver_id', p_driver_id, 'partner_driver_id', partner));

  return j;
end;
$$;

create or replace function public.invite_partner(phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lead uuid := auth.uid();
  digits text := right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10);
  person public.users;
  profile public.driver_profiles;
  row_id uuid;
begin
  if lead is null then
    raise exception 'Sign in first';
  end if;
  if length(digits) < 10 then
    return jsonb_build_object('status', 'no_account');
  end if;
  select * into person from public.users
  where right(regexp_replace(coalesce(users.phone, ''), '\D', '', 'g'), 10) = digits
  limit 1;
  if person.id is null then
    return jsonb_build_object('status', 'no_account');
  end if;
  if person.id = lead then
    raise exception 'You cannot be your own partner';
  end if;
  select * into profile from public.driver_profiles where user_id = person.id;
  if profile.user_id is null or profile.status <> 'approved' or profile.background_check_at is null then
    return jsonb_build_object('status', 'pending_approval', 'name', person.display_name);
  end if;
  if profile.stripe_connect_account_id is null then
    return jsonb_build_object('status', 'no_payouts', 'name', person.display_name);
  end if;
  if exists (
    select 1 from public.driver_partnerships
    where lead_id = lead and shift_date = public.chicago_today() and status in ('pending', 'accepted')
  ) then
    raise exception 'You already have a partner for today';
  end if;
  insert into public.driver_partnerships (lead_id, partner_id, shift_date, status)
  values (lead, person.id, public.chicago_today(), 'pending')
  returning id into row_id;
  return jsonb_build_object('status', 'invited', 'partnership_id', row_id, 'name', person.display_name, 'auto_accept', false);
end;
$$;

create or replace function public.respond_partner(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.driver_partnerships;
begin
  select * into row from public.driver_partnerships where id = p_id for update;
  if row.id is null or row.partner_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;
  if row.status <> 'pending' or row.shift_date <> public.chicago_today() then
    raise exception 'This invite is no longer open';
  end if;
  if p_accept then
    update public.driver_partnerships
    set status = 'accepted', responded_at = now()
    where id = p_id;
    return jsonb_build_object('status', 'accepted');
  end if;
  update public.driver_partnerships
  set status = 'declined', responded_at = now()
  where id = p_id;
  return jsonb_build_object('status', 'declined');
end;
$$;

create or replace function public.end_partnership()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.driver_partnerships;
begin
  select * into row from public.driver_partnerships
  where lead_id = auth.uid() and status = 'accepted' and shift_date = public.chicago_today()
  for update;
  if row.id is null then
    return jsonb_build_object('status', 'none');
  end if;
  if exists (
    select 1 from public.jobs j
    where j.driver_id = auth.uid()
      and j.needs_second_person
      and j.partner_driver_id = row.partner_id
      and j.status in ('at_pickup', 'en_route_dropoff', 'at_dropoff', 'delivered')
  ) then
    raise exception 'Finish your current 2-person job first.';
  end if;
  update public.jobs
  set partner_lost_at = now(), partner_driver_id = null
  where driver_id = auth.uid()
    and needs_second_person
    and status in ('assigned', 'en_route_pickup');
  update public.driver_partnerships
  set status = 'ended', ended_at = now(), ended_by = auth.uid()
  where id = row.id;
  return jsonb_build_object('status', 'ended');
end;
$$;

create or replace function public.release_lost_partners()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.jobs
  set status = 'open', driver_id = null, partner_driver_id = null, accepted_at = null, partner_lost_at = null
  where partner_lost_at is not null
    and partner_lost_at < now() - interval '10 minutes'
    and status in ('assigned', 'en_route_pickup');
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.end_expired_partnerships()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.driver_partnerships
  set status = 'ended', ended_at = now()
  where status in ('pending', 'accepted')
    and shift_date < public.chicago_today();
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.assigned_driver_card(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs;
  person public.users;
  profile public.driver_profiles;
  partner public.users;
  partner_profile public.driver_profiles;
  license_ok boolean;
  insurance_ok boolean;
begin
  select * into j from public.jobs where id = p_job_id;
  if j.id is null then
    return null;
  end if;
  if auth.uid() is distinct from j.customer_id and not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if j.driver_id is null then
    return null;
  end if;
  select * into person from public.users where id = j.driver_id;
  select * into profile from public.driver_profiles where user_id = j.driver_id;
  select * into partner from public.users where id = j.partner_driver_id;
  select * into partner_profile from public.driver_profiles where user_id = j.partner_driver_id;
  select exists (
    select 1 from public.driver_documents d
    where d.driver_id = j.driver_id and d.kind = 'license' and d.status = 'approved'
  ) into license_ok;
  select exists (
    select 1 from public.driver_documents d
    where d.driver_id = j.driver_id and d.kind = 'insurance' and d.status = 'approved'
  ) into insurance_ok;
  return jsonb_build_object(
    'display_name', person.display_name,
    'phone', person.phone,
    'avatar_url', person.avatar_url,
    'rating_avg', coalesce(profile.rating_avg, 0),
    'rating_count', coalesce(profile.rating_count, 0),
    'vehicle_color', profile.vehicle_color,
    'vehicle_make', profile.vehicle_make,
    'vehicle_model', profile.vehicle_model,
    'vehicle_type', profile.vehicle_type,
    'plate', profile.plate,
    'status', profile.status,
    'approved_documents', (not coalesce(profile.partner_only, false) and license_ok and insurance_ok and profile.status = 'approved')
      or (coalesce(profile.partner_only, false) and license_ok and profile.status = 'approved'),
    'partner_display_name', partner.display_name,
    'partner_first_name', split_part(coalesce(partner.display_name, ''), ' ', 1),
    'partner_avatar_url', partner.avatar_url,
    'partner_approved', partner_profile.status = 'approved'
  );
end;
$$;

revoke all on function public.invite_partner(text) from public;
revoke all on function public.respond_partner(uuid, boolean) from public;
revoke all on function public.end_partnership() from public;
grant execute on function public.invite_partner(text) to authenticated;
grant execute on function public.respond_partner(uuid, boolean) to authenticated;
grant execute on function public.end_partnership() to authenticated;
grant execute on function public.active_partner(uuid) to authenticated;
