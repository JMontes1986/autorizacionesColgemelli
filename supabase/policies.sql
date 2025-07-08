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

create policy "llegadas_tarde_write" on public.llegadas_tarde
for insert, update
with check (
    auth.role() <> 'anon'
);

create policy "llegadas_tarde_delete" on public.llegadas_tarde
for delete
using (
    auth.role() <> 'anon'
);
