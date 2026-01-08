-- Supabase RLS policies for sensitive tables

-- Enable RLS on table usuarios
alter table public.usuarios enable row level security;

-- Policy: authenticated users can read
create policy "usuarios_read_authenticated" on public.usuarios
for select
using (
    auth.role() <> 'anon'
);

-- Policy: authenticated users can insert/update
create policy "usuarios_write_authenticated" on public.usuarios
for insert, update
with check (
    auth.role() <> 'anon'
);

-- Policy: prevent delete by anon
create policy "usuarios_delete_authenticated" on public.usuarios
for delete
using (
    auth.role() <> 'anon'
);

-- Enable RLS on table llegadas_tarde
alter table public.llegadas_tarde enable row level security;

create policy "llegadas_tarde_read" on public.llegadas_tarde
for select
using (
    auth.role() <> 'anon'
);

-- New policy: allow anonymous users to read late arrivals
create policy "llegadas_tarde_read_anon" on public.llegadas_tarde
for select
using (
    auth.role() = 'anon'
);

create policy "llegadas_tarde_insert" on public.llegadas_tarde
for insert
with check (
    auth.role() <> 'anon'
);

-- Allow the dashboard (which uses the anon key) to register late arrivals
create policy "llegadas_tarde_insert_anon" on public.llegadas_tarde
for insert
with check (
    auth.role() = 'anon'
    and registrado_por is not null
    and exists (
        select 1
        from public.usuarios u
        where u.id = registrado_por
          and u.activo = true
    )
);

create policy "llegadas_tarde_update" on public.llegadas_tarde
for update
with check (
    auth.role() <> 'anon'
);

create policy "llegadas_tarde_delete" on public.llegadas_tarde
for delete
using (
    auth.role() <> 'anon'
);

-- Existing policies remain valid after adding indexes; no policy changes
-- are required for idx_llegadas_tarde_fecha or idx_llegadas_tarde_estudiante.

-- Enable RLS on table autorizaciones_salida
alter table public.autorizaciones_salida enable row level security;

create policy "autorizaciones_salida_read" on public.autorizaciones_salida
for select
using (
    auth.role() <> 'anon'
);

-- Allow anonymous dashboard access
create policy "autorizaciones_salida_read_anon" on public.autorizaciones_salida
for select
using (
    auth.role() = 'anon'
);

create policy "autorizaciones_salida_insert" on public.autorizaciones_salida
for insert
with check (
    auth.role() <> 'anon'
);

create policy "autorizaciones_salida_update" on public.autorizaciones_salida
for update
with check (
    auth.role() <> 'anon'
);

create policy "autorizaciones_salida_delete" on public.autorizaciones_salida
for delete
using (
    auth.role() <> 'anon'
);

-- Enable RLS on table audit_logs
alter table public.audit_logs enable row level security;

-- Allow authenticated users to read audit logs
create policy "audit_logs_read" on public.audit_logs
for select
using (
    auth.role() <> 'anon'
);

-- Allow authenticated users to insert audit logs
create policy "audit_logs_insert" on public.audit_logs
for insert
with check (
    auth.role() <> 'anon'
);

-- Allow anonymous users to insert audit logs before authentication
create policy "audit_logs_insert_anon" on public.audit_logs
for insert
with check (
    auth.role() = 'anon'
    and usuario_id is null
);

-- Enable RLS on table personal_colegio
alter table public.personal_colegio enable row level security;

create policy "personal_colegio_read" on public.personal_colegio
for select
using (
    auth.role() <> 'anon'
);

create policy "personal_colegio_write" on public.personal_colegio
for insert, update
with check (
    auth.role() <> 'anon'
);

create policy "personal_colegio_delete" on public.personal_colegio
for delete
using (
    auth.role() <> 'anon'
);

-- Enable RLS on table autorizaciones_personal
alter table public.autorizaciones_personal enable row level security;

create policy "autorizaciones_personal_read" on public.autorizaciones_personal
for select
using (
    auth.role() <> 'anon'
);

-- Allow anonymous dashboard access to read staff authorizations
create policy "autorizaciones_personal_read_anon" on public.autorizaciones_personal
for select
using (
    auth.role() = 'anon'
);

create policy "autorizaciones_personal_insert" on public.autorizaciones_personal
for insert
with check (
    auth.role() <> 'anon'
);

-- Allow the dashboard (anon key) to register staff exits when linked to valid users
create policy "autorizaciones_personal_insert_anon" on public.autorizaciones_personal
for insert
with check (
    auth.role() = 'anon'
    and usuario_autorizador_id is not null
    and exists (
        select 1
        from public.usuarios u
        where u.id = usuario_autorizador_id
          and u.activo = true
    )
    and colaborador_id is not null
    and exists (
        select 1
        from public.personal_colegio pc
        where pc.id = colaborador_id
          and pc.activo = true
    )
);

create policy "autorizaciones_personal_update" on public.autorizaciones_personal
for update
with check (
    auth.role() <> 'anon'
);

-- Allow anonymous dashboard workflows to update confirmations with valid user references
create policy "autorizaciones_personal_update_anon" on public.autorizaciones_personal
for update
with check (
    auth.role() = 'anon'
    and (
        usuario_autorizador_id is null
        or exists (
            select 1
            from public.usuarios u
            where u.id = usuario_autorizador_id
              and u.activo = true
        )
    )
    and (
        vigilante_id is null
        or exists (
            select 1
            from public.usuarios u
            where u.id = vigilante_id
              and u.activo = true
        )
    )
    and (
        vigilante_regreso_id is null
        or exists (
            select 1
            from public.usuarios u
            where u.id = vigilante_regreso_id
              and u.activo = true
        )
    )
);

create policy "autorizaciones_personal_delete" on public.autorizaciones_personal
for delete
using (
    auth.role() <> 'anon'
);

-- Enable RLS on visitor catalog tables
alter table public.perfiles_visitante enable row level security;
alter table public.areas_visitante enable row level security;
alter table public.estados_visitante enable row level security;

create policy "perfiles_visitante_read" on public.perfiles_visitante
for select
using (
    auth.role() <> 'anon'
);

create policy "perfiles_visitante_read_anon" on public.perfiles_visitante
for select
using (
    auth.role() = 'anon'
);

create policy "perfiles_visitante_write" on public.perfiles_visitante
for insert, update
with check (
    auth.role() <> 'anon'
);

create policy "perfiles_visitante_delete" on public.perfiles_visitante
for delete
using (
    auth.role() <> 'anon'
);

create policy "areas_visitante_read" on public.areas_visitante
for select
using (
    auth.role() <> 'anon'
);

create policy "areas_visitante_read_anon" on public.areas_visitante
for select
using (
    auth.role() = 'anon'
);

create policy "areas_visitante_write" on public.areas_visitante
for insert, update
with check (
    auth.role() <> 'anon'
);

create policy "areas_visitante_delete" on public.areas_visitante
for delete
using (
    auth.role() <> 'anon'
);

create policy "estados_visitante_read" on public.estados_visitante
for select
using (
    auth.role() <> 'anon'
);

create policy "estados_visitante_read_anon" on public.estados_visitante
for select
using (
    auth.role() = 'anon'
);

create policy "estados_visitante_write" on public.estados_visitante
for insert, update
with check (
    auth.role() <> 'anon'
);

create policy "estados_visitante_delete" on public.estados_visitante
for delete
using (
    auth.role() <> 'anon'
);

-- Enable RLS on visitantes
alter table public.visitantes enable row level security;

create policy "visitantes_read" on public.visitantes
for select
using (
    auth.role() <> 'anon'
);

create policy "visitantes_read_anon" on public.visitantes
for select
using (
    auth.role() = 'anon'
);

create policy "visitantes_insert" on public.visitantes
for insert
with check (
    auth.role() <> 'anon'
);

create policy "visitantes_insert_anon" on public.visitantes
for insert
with check (
    auth.role() = 'anon'
    and documento is not null
    and nombre is not null
);

create policy "visitantes_update" on public.visitantes
for update
with check (
    auth.role() <> 'anon'
);

create policy "visitantes_update_anon" on public.visitantes
for update
with check (
    auth.role() = 'anon'
    and documento is not null
    and nombre is not null
);

create policy "visitantes_delete" on public.visitantes
for delete
using (
    auth.role() <> 'anon'
);

-- Enable RLS on ingresos_visitantes
alter table public.ingresos_visitantes enable row level security;

create policy "ingresos_visitantes_read" on public.ingresos_visitantes
for select
using (
    auth.role() <> 'anon'
);

create policy "ingresos_visitantes_read_anon" on public.ingresos_visitantes
for select
using (
    auth.role() = 'anon'
);

create policy "ingresos_visitantes_insert" on public.ingresos_visitantes
for insert
with check (
    auth.role() <> 'anon'
);

create policy "ingresos_visitantes_insert_anon" on public.ingresos_visitantes
for insert
with check (
    auth.role() = 'anon'
    and vigilante_id is not null
    and exists (
        select 1
        from public.usuarios u
        where u.id = vigilante_id
          and u.activo = true
    )
    and visitante_id is not null
    and exists (
        select 1
        from public.visitantes v
        where v.id = visitante_id
          and v.activo = true
    )
);

create policy "ingresos_visitantes_update" on public.ingresos_visitantes
for update
with check (
    auth.role() <> 'anon'
);

create policy "ingresos_visitantes_delete" on public.ingresos_visitantes
for delete
using (
    auth.role() <> 'anon'
);

-- Enable RLS on observaciones_visitante
alter table public.observaciones_visitante enable row level security;

create policy "observaciones_visitante_read" on public.observaciones_visitante
for select
using (
    auth.role() <> 'anon'
);

create policy "observaciones_visitante_read_anon" on public.observaciones_visitante
for select
using (
    auth.role() = 'anon'
);

create policy "observaciones_visitante_insert" on public.observaciones_visitante
for insert
with check (
    auth.role() <> 'anon'
);

create policy "observaciones_visitante_insert_anon" on public.observaciones_visitante
for insert
with check (
    auth.role() = 'anon'
    and registrado_por is not null
    and exists (
        select 1
        from public.usuarios u
        where u.id = registrado_por
          and u.activo = true
    )
    and visitante_id is not null
    and exists (
        select 1
        from public.visitantes v
        where v.id = visitante_id
          and v.activo = true
    )
);

create policy "observaciones_visitante_update" on public.observaciones_visitante
for update
with check (
    auth.role() <> 'anon'
);

create policy "observaciones_visitante_delete" on public.observaciones_visitante
for delete
using (
    auth.role() <> 'anon'
);
