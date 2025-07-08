-- Supabase table definitions
-- Tabla para registrar llegadas tarde de estudiantes
create table if not exists public.llegadas_tarde (
    id bigserial primary key,
    estudiante_id bigint not null references public.estudiantes(id),
    fecha timestamp with time zone not null default now(),
    observacion text,
    registrado_por bigint references public.usuarios(id),
    created_at timestamp with time zone default now()
);
