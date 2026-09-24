-- Local demo only. Not applied by `supabase start`.
-- One customer, one approved online driver, one open Pensacola job.
-- This is seed, not live traffic. It does not insert payouts or revenue.
-- Logins (password is seed-only):
--   customer@heft.local / heft-customer-seed
--   driver@heft.local   / heft-driver-seed

create or replace function public._seed_demo_auth(
  p_id uuid,
  p_email text,
  p_password text,
  p_name text,
  p_role text,
  p_phone text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from auth.users where id = p_id) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current,
      recovery_token, phone_change, phone_change_token, reauthentication_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      p_id,
      'authenticated',
      'authenticated',
      p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('display_name', p_name, 'role', p_role, 'phone', p_phone),
      now(), now(),
      '', '', '', '', '', '', '', '',
      false, false
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      p_id,
      p_id,
      jsonb_build_object('sub', p_id::text, 'email', p_email),
      'email',
      p_id::text,
      now(), now(), now()
    );
  end if;

  update public.users
  set display_name = p_name,
      phone = p_phone,
      role = p_role
  where id = p_id;
end;
$$;

select public._seed_demo_auth(
  'b0000000-0000-4000-8000-000000000002',
  'customer@heft.local',
  'heft-customer-seed',
  'Demo Customer',
  'customer',
  '8505550101'
);

select public._seed_demo_auth(
  'c0000000-0000-4000-8000-000000000003',
  'driver@heft.local',
  'heft-driver-seed',
  'Demo Driver',
  'driver',
  '8505550102'
);

delete from public.customer_profiles where user_id = 'c0000000-0000-4000-8000-000000000003';

insert into public.driver_profiles (
  user_id, status, vehicle_type, capacity_lbs, bed_length_ft,
  service_lat, service_lng, service_radius_miles, is_online
) values (
  'c0000000-0000-4000-8000-000000000003',
  'approved',
  'pickup',
  1500,
  6.0,
  30.4213,
  -87.2169,
  25,
  true
)
on conflict (user_id) do update set
  status = 'approved',
  vehicle_type = excluded.vehicle_type,
  capacity_lbs = excluded.capacity_lbs,
  bed_length_ft = excluded.bed_length_ft,
  service_lat = excluded.service_lat,
  service_lng = excluded.service_lng,
  service_radius_miles = excluded.service_radius_miles,
  is_online = true;

-- Palafox → Cordova Mall, pickup / small. 4.66 mi → 5665 cents. Sandbox hold.
insert into public.jobs (
  id, customer_id, status,
  pickup_address, pickup_lat, pickup_lng,
  dropoff_address, dropoff_lat, dropoff_lng,
  item_description, size_category, vehicle_required,
  distance_miles, estimate_cents, final_cents, platform_fee_cents, driver_payout_cents,
  stripe_payment_intent_id
) values (
  'd0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000002',
  'open',
  '21 E Government St, Pensacola, FL', 30.4088, -87.2166,
  '5100 N 9th Ave, Pensacola, FL', 30.4758, -87.208,
  'Demo sofa — seed, not a real order',
  'small',
  'pickup',
  4.66,
  5665,
  5665,
  850,
  4815,
  'pi_sandbox_demo'
)
on conflict (id) do update set
  status = 'open',
  driver_id = null,
  cancelled_at = null,
  cancel_reason = null,
  accepted_at = null,
  stripe_payment_intent_id = 'pi_sandbox_demo'
where public.jobs.status in ('draft', 'priced', 'open', 'cancelled');

insert into public.job_events (id, job_id, type, actor_id, payload)
values (
  'e0000000-0000-4000-8000-000000000005',
  'd0000000-0000-4000-8000-000000000004',
  'open',
  'b0000000-0000-4000-8000-000000000002',
  '{"seed":"demo","note":"Sample Pensacola job for the local loop."}'::jsonb
)
on conflict (id) do nothing;

drop function public._seed_demo_auth(uuid, text, text, text, text, text);
