-- Supabase table definitions
-- Tabla para registrar llegadas tarde de estudiantes
create table if not exists public.llegadas_tarde (
    id bigserial primary key,
    estudiante_id bigint not null references public.estudiantes(id),
    grado_id bigint references public.grados(id),
    hora time,
    excusa boolean,
    fecha timestamp with time zone not null default now(),
    observacion text,
    registrado_por bigint references public.usuarios(id),
    created_at timestamp with time zone default now()
);

-- Index to quickly filter late arrivals by date
create index if not exists idx_llegadas_tarde_fecha
    on public.llegadas_tarde (fecha);

-- Index to efficiently query records for a particular student
create index if not exists idx_llegadas_tarde_estudiante
    on public.llegadas_tarde (estudiante_id);


-- Tabla de auditoría para registrar eventos de seguridad
create table if not exists public.audit_logs (
    id bigserial primary key,
    usuario_id bigint references public.usuarios(id),
    tipo text,
    accion text,
    detalles jsonb,
    ip_address text,
    user_agent text,
    exitoso boolean,
    timestamp timestamptz default now()
);

-- Index para consultas por fecha
create index if not exists idx_audit_logs_timestamp
    on public.audit_logs (timestamp);
