-- Partner names come from security-definer RPCs. PostgREST cannot embed users
-- on driver_partnerships: lead_id, partner_id, and ended_by all reference users.
-- can_read_user also does not cover a partner, so the embed would be empty
-- even if the relationship were named.
--
-- A customer insert().select('id') needs a SELECT policy that can see the
-- new row. can_read_job looks the row up again, and that lookup cannot see
-- the row still being inserted.
--
-- Column-level REVOKE does not remove the table-level GRANT in
-- 20260921120000 (grant insert, update on all tables to authenticated).
-- Those revokes never took effect. This migration revokes the table
-- privileges and grants the columns a signed-in customer or admin may write.
-- protect_job_pricing remains the backstop for locked pricing columns.

alter table public.jobs
  add column if not exists payment_captured_at timestamptz;

alter table public.driver_partnerships
  add column if not exists invite_pushed_at timestamptz;

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
    new.payment_captured_at := old.payment_captured_at;
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
    new.payment_captured_at := null;
  end if;
  return new;
end;
$$;

-- Table-level insert/update made the earlier column revokes a no-op.
revoke insert, update on table public.jobs from authenticated;

grant insert (
  customer_id,
  status,
  pickup_address,
  pickup_lat,
  pickup_lng,
  pickup_notes,
  dropoff_address,
  dropoff_lat,
  dropoff_lng,
  dropoff_notes,
  item_description,
  item_type,
  size_category,
  size_tier,
  vehicle_required,
  stairs_pickup_flights,
  stairs_dropoff_flights,
  weight_band,
  dropoff_placement
) on table public.jobs to authenticated;

grant update (
  customer_id,
  status,
  pickup_address,
  pickup_lat,
  pickup_lng,
  pickup_notes,
  dropoff_address,
  dropoff_lat,
  dropoff_lng,
  dropoff_notes,
  item_description,
  item_type,
  size_category,
  size_tier,
  vehicle_required,
  stairs_pickup_flights,
  stairs_dropoff_flights,
  weight_band,
  dropoff_placement
) on table public.jobs to authenticated;

drop policy if exists jobs_select_own on public.jobs;
create policy jobs_select_own on public.jobs
for select to authenticated
using (customer_id = auth.uid());

create or replace function public.my_partnerships()
returns table (
  id uuid,
  lead_id uuid,
  partner_id uuid,
  status text,
  shift_date date,
  lead_first_name text,
  lead_avatar_url text,
  partner_first_name text,
  partner_avatar_url text,
  phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.lead_id,
    p.partner_id,
    p.status,
    p.shift_date,
    split_part(coalesce(lead.display_name, ''), ' ', 1),
    lead.avatar_url,
    split_part(coalesce(partner.display_name, ''), ' ', 1),
    partner.avatar_url,
    case
      when p.lead_id is distinct from auth.uid() then null
      when p.shift_date = public.chicago_today() and p.status in ('pending', 'accepted') then partner.phone
      else nullif(right(regexp_replace(coalesce(partner.phone, ''), '\D', '', 'g'), 4), '')
    end
  from public.driver_partnerships p
  join public.users lead on lead.id = p.lead_id
  join public.users partner on partner.id = p.partner_id
  where auth.uid() is not null
    and (p.lead_id = auth.uid() or p.partner_id = auth.uid());
$$;

create or replace function public.partnership_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select to_jsonb(row) into result
  from public.my_partnerships() row
  where row.id = p_id;
  return result;
end;
$$;

-- Recent rows only show the last 4 digits. Re-inviting looks the number up here.
create or replace function public.reinvite_partner(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lead uuid := auth.uid();
  number text;
begin
  if lead is null then
    raise exception 'Sign in first';
  end if;
  if not exists (
    select 1 from public.driver_partnerships
    where lead_id = lead and partner_id = p_partner_id
  ) then
    raise exception 'No past partnership with that driver';
  end if;
  select users.phone into number from public.users where users.id = p_partner_id;
  return public.invite_partner(number);
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
  profile public.driver_profiles;
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
    if exists (
      select 1 from public.driver_partnerships p
      where p.id <> row.id
        and p.shift_date = public.chicago_today()
        and (
          (p.status = 'accepted' and (p.lead_id = row.partner_id or p.partner_id = row.partner_id))
          or (p.status = 'pending' and p.lead_id = row.partner_id)
        )
    ) then
      raise exception 'You already have a partner for today';
    end if;
    select * into profile from public.driver_profiles where user_id = row.partner_id;
    if profile.user_id is null
      or profile.status <> 'approved'
      or profile.background_check_at is null
      or profile.stripe_connect_account_id is null then
      raise exception 'You need to be approved with a background check and payouts set up';
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
    return jsonb_build_object('status', 'none', 'message', 'No job to release');
  end if;
  return jsonb_build_object('status', 'released', 'message', 'Job released, no penalty');
end;
$$;

revoke all on function public.my_partnerships() from public;
grant execute on function public.my_partnerships() to authenticated;

revoke all on function public.partnership_detail(uuid) from public;
grant execute on function public.partnership_detail(uuid) to authenticated;

revoke all on function public.reinvite_partner(uuid) from public;
grant execute on function public.reinvite_partner(uuid) to authenticated;

revoke all on function public.release_partner_job() from public;
grant execute on function public.release_partner_job() to authenticated;
