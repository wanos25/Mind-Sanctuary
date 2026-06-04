-- R6 — Doctor bootstrap helpers
-- Apply once via the Supabase SQL editor (or psql). Idempotent.
--
-- Provides two SECURITY DEFINER RPCs used by /doctor-login:
--   * doctor_bootstrap_available()  — read-only probe
--   * claim_doctor_bootstrap()      — first-time self-claim of 'doctor' role
--
-- Bootstrap closes automatically once any doctor/admin exists in user_roles.

create or replace function public.doctor_bootstrap_available()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists(
    select 1 from public.user_roles
    where role in ('doctor', 'admin')
  );
$$;

revoke all on function public.doctor_bootstrap_available() from public;
grant execute on function public.doctor_bootstrap_available() to authenticated;

create or replace function public.claim_doctor_bootstrap()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exists boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select exists(
    select 1 from public.user_roles
    where role in ('doctor', 'admin')
  ) into v_exists;

  if v_exists then
    raise exception 'bootstrap_closed';
  end if;

  insert into public.user_roles (user_id, role)
  values (v_uid, 'doctor')
  on conflict (user_id, role) do nothing;

  return true;
end;
$$;

revoke all on function public.claim_doctor_bootstrap() from public;
grant execute on function public.claim_doctor_bootstrap() to authenticated;
