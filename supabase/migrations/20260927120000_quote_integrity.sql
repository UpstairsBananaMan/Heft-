-- Quote integrity and the real partner path.
-- Customers cannot write pricing columns. The quote function owns them.
-- A partner can end the day, accept an invite, and replace a partner who backed out.

alter table public.jobs
  add column if not exists quoted_pickup_lat double precision,
  add column if not exists quoted_pickup_lng double precision,
  add column if not exists quoted_dropoff_lat double precision,
  add column if not exists quoted_dropoff_lng double precision;

create or replace function public.protect_job_pricing()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.distance_miles := old.distance_miles;
    new.billable_miles := old.billable_miles;
    new.distance_source := old.distance_source;
    new.pickup_in_zone := old.pickup_in_zone;
    new.dropoff_in_zone := old.dropoff_in_zone;
    new.pickup_zip := old.pickup_zip;
    new.dropoff_zip := old.dropoff_zip;
    new.estimate_cents := old.estimate_cents;
    new.final_cents := old.final_cents;
    new.platform_fee_cents := old.platform_fee_cents;
    new.driver_share_cents := old.driver_share_cents;
    new.driver_payout_cents := old.driver_payout_cents;
    new.lead_payout_cents := old.lead_payout_cents;
    new.helper_payout_cents := old.helper_payout_cents;
    new.est_job_minutes := old.est_job_minutes;
    new.rates_version := old.rates_version;
    new.quoted_at := old.quoted_at;
    new.needs_second_person := old.needs_second_person;
    new.quoted_pickup_lat := old.quoted_pickup_lat;
    new.quoted_pickup_lng := old.quoted_pickup_lng;
    new.quoted_dropoff_lat := old.quoted_dropoff_lat;
    new.quoted_dropoff_lng := old.quoted_dropoff_lng;
    new.quote_lines := old.quote_lines;
  else
    new.distance_miles := null;
    new.billable_miles := null;
    new.distance_source := null;
    new.pickup_in_zone := null;
    new.dropoff_in_zone := null;
    new.pickup_zip := null;
    new.dropoff_zip := null;
    new.estimate_cents := null;
    new.final_cents := null;
    new.platform_fee_cents := null;
    new.driver_share_cents := null;
    new.driver_payout_cents := null;
    new.lead_payout_cents := null;
    new.helper_payout_cents := null;
    new.est_job_minutes := null;
    new.rates_version := null;
    new.quoted_at := null;
    new.needs_second_person := false;
    new.quoted_pickup_lat := null;
    new.quoted_pickup_lng := null;
    new.quoted_dropoff_lat := null;
    new.quoted_dropoff_lng := null;
    new.quote_lines := null;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_protect_pricing on public.jobs;
create trigger jobs_protect_pricing
before insert or update on public.jobs
for each row execute function public.protect_job_pricing();

revoke update (
  distance_miles,
  billable_miles,
  distance_source,
  pickup_in_zone,
  dropoff_in_zone,
  pickup_zip,
  dropoff_zip,
  estimate_cents,
  final_cents,
  platform_fee_cents,
  driver_share_cents,
  driver_payout_cents,
  lead_payout_cents,
  helper_payout_cents,
  est_job_minutes,
  rates_version,
  quoted_at,
  needs_second_person,
  quoted_pickup_lat,
  quoted_pickup_lng,
  quoted_dropoff_lat,
  quoted_dropoff_lng,
  quote_lines
) on public.jobs from authenticated, anon;

revoke insert (
  distance_miles,
  billable_miles,
  distance_source,
  pickup_in_zone,
  dropoff_in_zone,
  pickup_zip,
  dropoff_zip,
  estimate_cents,
  final_cents,
  platform_fee_cents,
  driver_share_cents,
  driver_payout_cents,
  lead_payout_cents,
  helper_payout_cents,
  est_job_minutes,
  rates_version,
  quoted_at,
  needs_second_person,
  quoted_pickup_lat,
  quoted_pickup_lng,
  quoted_dropoff_lat,
  quoted_dropoff_lng,
  quote_lines
) on public.jobs from authenticated, anon;

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
  lead_profile public.driver_profiles;
  row_id uuid;
begin
  if lead is null then
    raise exception 'Sign in first';
  end if;
  select * into lead_profile from public.driver_profiles where user_id = lead;
  if lead_profile.user_id is null or lead_profile.status <> 'approved' or lead_profile.partner_only then
    raise exception 'Only an approved lead can invite a partner';
  end if;
  if exists (
    select 1 from public.driver_partnerships p
    where p.partner_id = lead and p.status = 'accepted' and p.shift_date = public.chicago_today()
  ) then
    raise exception 'You are partnered today';
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
    if exists (
      select 1 from public.jobs j
      where j.driver_id = row.partner_id
        and j.status in ('assigned', 'en_route_pickup', 'at_pickup', 'en_route_dropoff', 'at_dropoff')
    ) then
      raise exception 'Finish your current job first';
    end if;
    update public.driver_partnerships
    set status = 'accepted', responded_at = now()
    where id = p_id;
    update public.jobs
    set partner_driver_id = row.partner_id, partner_lost_at = null
    where driver_id = row.lead_id
      and needs_second_person
      and partner_lost_at is not null
      and status in ('assigned', 'en_route_pickup');
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
  where status = 'accepted'
    and shift_date = public.chicago_today()
    and (lead_id = auth.uid() or partner_id = auth.uid())
  for update;
  if row.id is null then
    return jsonb_build_object('status', 'none');
  end if;
  if exists (
    select 1 from public.jobs j
    where j.driver_id = row.lead_id
      and j.needs_second_person
      and j.partner_driver_id = row.partner_id
      and j.status in ('at_pickup', 'en_route_dropoff', 'at_dropoff', 'delivered')
  ) then
    raise exception 'Finish your current 2-person job first.';
  end if;
  update public.jobs
  set partner_lost_at = now(), partner_driver_id = null
  where driver_id = row.lead_id
    and needs_second_person
    and status in ('assigned', 'en_route_pickup');
  update public.driver_partnerships
  set status = 'ended', ended_at = now(), ended_by = auth.uid()
  where id = row.id;
  return jsonb_build_object('status', 'ended');
end;
$$;

create or replace function public.release_partner_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.jobs
  set status = 'open',
      driver_id = null,
      partner_driver_id = null,
      accepted_at = null,
      partner_lost_at = null
  where driver_id = auth.uid()
    and partner_lost_at is not null
    and status in ('assigned', 'en_route_pickup');
  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('status', 'none', 'message', 'Job released, no penalty');
  end if;
  return jsonb_build_object('status', 'released', 'message', 'Job released, no penalty');
end;
$$;

revoke all on function public.release_partner_job() from public;
grant execute on function public.release_partner_job() to authenticated;
