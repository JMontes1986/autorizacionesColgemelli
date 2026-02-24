-- Migración recomendada para mover autenticación a Supabase Auth
-- Ejecutar en el SQL Editor con un rol con permisos sobre auth.users.

begin;

-- 1) Relacionar perfil interno (public.usuarios) con usuario de Auth.
alter table if exists public.usuarios
    add column if not exists auth_user_id uuid;

alter table if exists public.usuarios
    add constraint usuarios_auth_user_id_unique unique (auth_user_id);

alter table if exists public.usuarios
    add constraint usuarios_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users(id)
    on delete set null;

-- 2) Sincronizar auth.users -> public.usuarios por email.
create or replace function public.sync_usuario_with_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.usuarios
       set auth_user_id = new.id
     where lower(email) = lower(new.email)
       and (auth_user_id is null or auth_user_id = new.id);

    return new;
end;
$$;

-- Reemplaza trigger si ya existe

do $$
begin
    if exists (
        select 1
          from pg_trigger
         where tgname = 'on_auth_user_created_sync_public_usuario'
    ) then
        drop trigger on_auth_user_created_sync_public_usuario on auth.users;
    end if;
end $$;

create trigger on_auth_user_created_sync_public_usuario
after insert on auth.users
for each row
execute function public.sync_usuario_with_auth_user();

commit;

-- 3) Migración de usuarios existentes (manual, recomendado):
--    a) Crea/reinicia contraseña de cada usuario en Auth (Dashboard > Authentication > Users)
--    b) Luego ejecuta:
--       update public.usuarios u
--          set auth_user_id = a.id
--         from auth.users a
--        where lower(u.email) = lower(a.email)
--          and u.auth_user_id is null;
--
-- IMPORTANTE: no reutilizar password_hash legado en frontend.
