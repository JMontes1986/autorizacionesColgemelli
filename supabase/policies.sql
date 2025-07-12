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
