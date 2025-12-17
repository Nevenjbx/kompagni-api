-- ==============================================================================
-- SUPABASE AUTH SYNC TRIGGERS
-- ==============================================================================
-- This script synchronizes the "auth.users" table (Supabase) with the 
-- public "users" table (Prisma).
--
-- Features:
-- 1. Automatic Insert on SignUp
-- 2. Soft Delete on Auth User Deletion (scrambles email to allow re-registration)
--
-- USAGE: 
-- Run this script in the Supabase SQL Editor or via a migration tool.
-- ==============================================================================

-- 1. FUNCTION: Handle New User (Insert)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (
    id, 
    email, 
    name, 
    role, 
    "isDeleted", 
    "createdAt", 
    "updatedAt"
  )
  values (
    new.id::text,                         -- Users.id is String (UUID)
    new.email,
    new.raw_user_meta_data->>'full_name', -- Map 'full_name' from metadata
    'CLIENT',                             -- Default Role
    false,
    now(),
    now()
  );
  return new;
end;
$$;

-- 2. TRIGGER: On Insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. FUNCTION: Handle User Deletion (Soft Delete)
create or replace function public.handle_user_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Mark as deleted and scramble email to satisfy UNIQUE constraint
  -- allowing the user to potentially sign up again with the same email.
  update public.users
  set 
    "isDeleted" = true,
    "updatedAt" = now(),
    "email" = 'deleted_' || extract(epoch from now()) || '_' || old.email
  where id = old.id::text;
  
  return old;
end;
$$;

-- 4. TRIGGER: On Delete
drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute procedure public.handle_user_delete();

-- 5. PERMISSIONS
-- Grant access to the `auth` role usually used by these triggers if needed,
-- though SECURITY DEFINER handles most context. 
-- Ensure the postgres/service_role can access the public table.

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on table public.users to postgres, service_role;
grant select on table public.users to anon, authenticated;
