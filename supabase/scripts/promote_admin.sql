-- Promote an existing auth user to admin. Hosted projects cannot use the
-- local auth.users seed. Create the user in the dashboard (or sign up), then
-- run this in the SQL editor with their email.
--
-- This is an operator script, not seed data and not a metric.

update public.users
set role = 'admin'
where id = (
  select id from auth.users where email = 'admin@heft.local'
);

-- Drop a customer profile if signup created one before promotion.
delete from public.customer_profiles
where user_id = (
  select id from auth.users where email = 'admin@heft.local'
);
