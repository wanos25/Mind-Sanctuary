-- Manual migration: storage bucket for doctor-authored activity media.
-- Apply via Supabase SQL editor on project fsterbxivhhzipfgpvou.
--
-- IDEMPOTENT & PRODUCTION-SAFE:
--   * Bucket creation uses ON CONFLICT DO NOTHING.
--   * Each policy is guarded with a pg_policies existence check so re-running
--     this script after partial failure (or against an already-bootstrapped
--     project) is a no-op. No DROP POLICY statements — existing policies are
--     preserved verbatim. Safe to run any number of times.
--
-- Verification (run after apply):
--   select id, public from storage.buckets where id = 'activity-media';
--   select policyname from pg_policies
--     where schemaname = 'storage' and tablename = 'objects'
--       and policyname in (
--         'Doctors can upload activity media',
--         'Doctors can update activity media',
--         'Doctors can delete activity media',
--         'Anyone can read activity media'
--       );

-- 1. Bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('activity-media', 'activity-media', true)
on conflict (id) do nothing;

-- 2. Policies (guarded; no drops, no overrides)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Doctors can upload activity media'
  ) then
    create policy "Doctors can upload activity media"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'activity-media'
        and public.has_role(auth.uid(), 'doctor'::public.app_role)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Doctors can update activity media'
  ) then
    create policy "Doctors can update activity media"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'activity-media'
        and public.has_role(auth.uid(), 'doctor'::public.app_role)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Doctors can delete activity media'
  ) then
    create policy "Doctors can delete activity media"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'activity-media'
        and public.has_role(auth.uid(), 'doctor'::public.app_role)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Anyone can read activity media'
  ) then
    create policy "Anyone can read activity media"
      on storage.objects for select
      to public
      using (bucket_id = 'activity-media');
  end if;
end
$$;
