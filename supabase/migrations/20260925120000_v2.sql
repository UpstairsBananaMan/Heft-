-- Heft v2: itemized quotes, stairs/helper, driver documents, assigned driver card.
-- Anonymous (still role authenticated) customers may already insert their own drafts.
-- publish-job rejects anonymous sessions in the edge function.

alter table public.jobs
  add column if not exists item_type text,
  add column if not exists stairs_pickup_flights int not null default 0,
  add column if not exists stairs_dropoff_flights int not null default 0,
  add column if not exists needs_helper boolean not null default false,
  add column if not exists dropoff_placement text not null default 'inside',
  add column if not exists quote_lines jsonb;

alter table public.jobs drop constraint if exists jobs_dropoff_placement_check;
alter table public.jobs
  add constraint jobs_dropoff_placement_check check (dropoff_placement in ('inside', 'curbside'));

alter table public.driver_profiles
  add column if not exists plate text,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_color text,
  add column if not exists service_zip text;

alter table public.job_photos drop constraint if exists job_photos_kind_check;
alter table public.job_photos
  add constraint job_photos_kind_check check (kind in ('item', 'pickup', 'pod'));

create table if not exists public.driver_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  driver_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('vehicle_photo', 'license', 'insurance')),
  storage_path text not null,
  status text not null default 'in_review' check (status in ('needed', 'in_review', 'approved', 'rejected')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users (id)
);

alter table public.driver_documents enable row level security;

drop policy if exists driver_documents_select on public.driver_documents;
create policy driver_documents_select on public.driver_documents
for select to authenticated
using (driver_id = auth.uid() or public.is_admin());

drop policy if exists driver_documents_insert on public.driver_documents;
create policy driver_documents_insert on public.driver_documents
for insert to authenticated
with check (driver_id = auth.uid() or public.is_admin());

drop policy if exists driver_documents_update on public.driver_documents;
create policy driver_documents_update on public.driver_documents
for update to authenticated
using (driver_id = auth.uid() or public.is_admin())
with check (driver_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public)
values ('driver-docs', 'driver-docs', false)
on conflict (id) do nothing;

drop policy if exists driver_docs_storage_select on storage.objects;
create policy driver_docs_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'driver-docs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists driver_docs_storage_insert on storage.objects;
create policy driver_docs_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'driver-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Customer of an active job can read the assigned driver's card. Table policies stay narrow.
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
    'approved_documents', license_ok and insurance_ok and profile.status = 'approved'
  );
end;
$$;

revoke all on function public.assigned_driver_card(uuid) from public;
grant execute on function public.assigned_driver_card(uuid) to authenticated;
