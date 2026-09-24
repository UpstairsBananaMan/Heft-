-- Seed for local `supabase db reset` / `supabase start`.
-- Clearly seed: Pensacola pricing rules and one admin login.
-- No jobs, payouts, or revenue rows.

insert into public.pricing_rules (
  market, vehicle_type, size_category, base_cents, per_mile_cents, min_cents, size_multiplier, active
) values
  ('pensacola', 'pickup', 'small', 4500, 250, 5500, 1.00, true),
  ('pensacola', 'pickup', 'medium', 4500, 250, 5500, 1.15, true),
  ('pensacola', 'pickup', 'large', 4500, 250, 5500, 1.35, true),
  ('pensacola', 'pickup', 'xl', 4500, 250, 5500, 1.60, true),
  ('pensacola', 'cargo_van', 'small', 5500, 300, 7000, 1.00, true),
  ('pensacola', 'cargo_van', 'medium', 5500, 300, 7000, 1.15, true),
  ('pensacola', 'cargo_van', 'large', 5500, 300, 7000, 1.35, true),
  ('pensacola', 'cargo_van', 'xl', 5500, 300, 7000, 1.60, true),
  ('pensacola', 'box_truck', 'small', 8500, 400, 11000, 1.00, true),
  ('pensacola', 'box_truck', 'medium', 8500, 400, 11000, 1.15, true),
  ('pensacola', 'box_truck', 'large', 8500, 400, 11000, 1.35, true),
  ('pensacola', 'box_truck', 'xl', 8500, 400, 11000, 1.60, true),
  ('pensacola', 'flatbed', 'small', 9500, 450, 12500, 1.00, true),
  ('pensacola', 'flatbed', 'medium', 9500, 450, 12500, 1.15, true),
  ('pensacola', 'flatbed', 'large', 9500, 450, 12500, 1.35, true),
  ('pensacola', 'flatbed', 'xl', 9500, 450, 12500, 1.60, true)
on conflict (market, vehicle_type, size_category) where active do nothing;

-- Local admin. Password is seed-only: heft-admin-seed
-- Email: admin@heft.local
do $$
declare
  v_user_id uuid := 'a0000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from auth.users where id = v_user_id) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      recovery_token,
      phone_change,
      phone_change_token,
      reauthentication_token,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@heft.local',
      extensions.crypt('heft-admin-seed', extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"Seed Admin","role":"admin"}',
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      false,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@heft.local'),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  -- Signup trigger refuses self-serve admin and may have inserted a customer row.
  update public.users
  set role = 'admin',
      display_name = 'Seed Admin'
  where id = v_user_id;

  delete from public.customer_profiles where user_id = v_user_id;
end $$;
