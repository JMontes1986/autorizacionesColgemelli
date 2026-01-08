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


-- Tabla para gestionar el personal del colegio
create table if not exists public.personal_colegio (
    id bigserial primary key,
    cedula text not null unique,
    nombre text not null,
    cargo text not null,
    activo boolean default true,
    created_at timestamp with time zone default now()
);

create index if not exists idx_personal_colegio_activo
    on public.personal_colegio (activo);


-- Catálogos para visitantes externos
create table if not exists public.perfiles_visitante (
    id bigserial primary key,
    nombre text not null,
    activo boolean default true,
    created_at timestamp with time zone default now()
);

create table if not exists public.areas_visitante (
    id bigserial primary key,
    nombre text not null,
    activo boolean default true,
    created_at timestamp with time zone default now()
);

create table if not exists public.estados_visitante (
    id bigserial primary key,
    nombre text not null,
    activo boolean default true,
    created_at timestamp with time zone default now()
);

create table if not exists public.visitantes (
    id bigserial primary key,
    documento text not null unique,
    nombre text not null,
    perfil_id bigint references public.perfiles_visitante(id),
    activo boolean default true,
    created_at timestamp with time zone default now()
);

create index if not exists idx_visitantes_documento
    on public.visitantes (documento);

create table if not exists public.ingresos_visitantes (
    id bigserial primary key,
    visitante_id bigint not null references public.visitantes(id),
    vigilante_id bigint references public.usuarios(id),
    fecha date not null,
    hora time,
    motivo text not null,
    area_id bigint references public.areas_visitante(id),
    estado_id bigint references public.estados_visitante(id),
    observaciones text,
    salida_efectiva timestamp with time zone,
    salida_observaciones text,
    salida_vigilante_id bigint references public.usuarios(id),
    created_at timestamp with time zone default now()
);

create index if not exists idx_ingresos_visitantes_fecha
    on public.ingresos_visitantes (fecha);

create index if not exists idx_ingresos_visitantes_visitante
    on public.ingresos_visitantes (visitante_id);

create table if not exists public.observaciones_visitante (
    id bigserial primary key,
    visitante_id bigint not null references public.visitantes(id),
    observacion text not null,
    registrado_por bigint references public.usuarios(id),
    created_at timestamp with time zone default now()
);

create index if not exists idx_observaciones_visitante_visitante
    on public.observaciones_visitante (visitante_id);


-- Tabla de autorizaciones de salida para personal del colegio
create table if not exists public.autorizaciones_personal (
    id bigserial primary key,
    colaborador_id bigint not null references public.personal_colegio(id),
    motivo_id bigint references public.motivos(id),
    usuario_autorizador_id bigint not null references public.usuarios(id),
    fecha_salida date not null,
    hora_salida time,
    requiere_regreso boolean default false,
    hora_regreso_estimada time,
    observaciones text,
    autorizada boolean default true,
    fecha_creacion timestamp with time zone default now(),
    salida_efectiva timestamp with time zone,
    vigilante_id bigint references public.usuarios(id),
    regreso_efectivo timestamp with time zone,
    vigilante_regreso_id bigint references public.usuarios(id)
);

-- Ensure recently added tracking columns exist even if the table was created before
-- they were introduced in the application. The IF NOT EXISTS guard allows the script
-- to be applied safely on already updated databases without raising errors.
alter table if exists public.autorizaciones_personal
    add column if not exists requiere_regreso boolean default false;

alter table if exists public.autorizaciones_personal
    add column if not exists hora_regreso_estimada time;

alter table if exists public.autorizaciones_personal
    alter column hora_salida drop not null;

alter table if exists public.autorizaciones_personal
    add column if not exists regreso_efectivo timestamp with time zone;

alter table if exists public.autorizaciones_personal
    add column if not exists vigilante_regreso_id bigint references public.usuarios(id);

create index if not exists idx_autorizaciones_personal_fecha
    on public.autorizaciones_personal (fecha_salida);

create index if not exists idx_autorizaciones_personal_colaborador
    on public.autorizaciones_personal (colaborador_id);


-- Seguimiento de modificaciones en autorizaciones de estudiantes
alter table if exists public.autorizaciones_salida
    add column if not exists ultima_modificacion timestamp with time zone;

alter table if exists public.autorizaciones_salida
    add column if not exists usuario_modifico_id bigint references public.usuarios(id);

alter table if exists public.autorizaciones_salida
    add column if not exists detalle_modificaciones text;


-- Rol de Talento Humano
insert into public.roles (nombre, descripcion)
select 'talento_humano', 'Talento Humano'
where not exists (
    select 1 from public.roles where nombre = 'talento_humano'
);

insert into public.usuarios (nombre, email, password_hash, rol_id, activo)
select 'Gestión Administrativa', 'gadministrativa@colgemelli.edu.co', 'sha256$3b1996e11b61defa2f2c53ea4ea3eec3810170bd1042f7b149498b7d181cf65b', r.id, true
from public.roles r
where r.nombre = 'talento_humano'
and not exists (
    select 1 from public.usuarios where email = 'gadministrativa@colgemelli.edu.co'
);


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
