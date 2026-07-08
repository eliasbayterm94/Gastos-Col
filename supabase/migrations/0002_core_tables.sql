-- =============================================================================
-- Forest Gastos — 0002 · Core tables
-- =============================================================================
-- Money: BIGINT COP integer pesos, always CHECK (> 0) where applicable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users — application profile, 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  nombre      text not null,
  rol         public.user_role not null default 'usuario',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.users is 'Perfil de aplicación. rol e active gobiernan permisos vía RLS.';

-- ---------------------------------------------------------------------------
-- expense_types — nivel superior (Viaje, Compra de café, Trilladora, ...)
-- expense_categories — detalle bajo cada tipo (transporte, alimentación, ...)
-- Nota: la clasificación CONTABLE para Siigo (compra/gasto, retenciones,
-- cuentas) es un concepto aparte que define contabilidad al momento del push
-- y se implementa en una fase posterior. Estos campos son operativos.
-- ---------------------------------------------------------------------------
create table if not exists public.expense_types (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  type_id     uuid not null references public.expense_types (id) on delete restrict,
  nombre      text not null,
  descripcion text,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (type_id, nombre)
);

-- ---------------------------------------------------------------------------
-- locations — sitios administrables; is_milling marca trilladoras
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  is_milling  boolean not null default false,   -- true = trilladora
  descripcion text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reimbursement_closures — cierre / liquidación (declared before expenses &
-- anticipos because both FK into it). Filled atomically by the closure engine.
-- ---------------------------------------------------------------------------
create table if not exists public.reimbursement_closures (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id),      -- operario liquidado
  fecha             date not null default public.bogota_today(),
  total_gastos      bigint not null default 0 check (total_gastos >= 0),
  anticipo_id       uuid,                                            -- FK added after anticipos exists
  anticipo_aplicado bigint not null default 0 check (anticipo_aplicado >= 0),
  saldo             bigint not null default 0,   -- total_gastos - anticipo_aplicado (con signo)
  saldo_direccion   public.saldo_direccion not null default 'neutro',
  metodo_pago       public.payment_method,       -- método del reembolso / devolución
  observaciones     text,
  reopened          boolean not null default false,
  created_by        uuid not null references public.users (id),      -- contabilidad
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.reimbursement_closures is
  'Un cierre puede liquidar un anticipo Y pagar gastos sin anticipo del mismo operario (flujos combinados).';

-- ---------------------------------------------------------------------------
-- anticipos — adelanto entregado a un operario
-- ---------------------------------------------------------------------------
create table if not exists public.anticipos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id),         -- operario que recibe
  monto          bigint not null check (monto > 0),
  fecha          date not null default public.bogota_today(),
  metodo_entrega public.payment_method not null default 'transferencia',
  estado         public.anticipo_estado not null default 'activo',
  descripcion    text,
  closure_id     uuid references public.reimbursement_closures (id) on delete set null,
  created_by     uuid not null references public.users (id),         -- contabilidad
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Deferred FK: closure -> anticipo (single anticipo liquidated per closure in MVP)
alter table public.reimbursement_closures
  drop constraint if exists reimbursement_closures_anticipo_id_fkey;
alter table public.reimbursement_closures
  add constraint reimbursement_closures_anticipo_id_fkey
  foreign key (anticipo_id) references public.anticipos (id) on delete set null;

-- ---------------------------------------------------------------------------
-- expenses — gasto. id doubles as the idempotency key for Siigo pushes.
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id),        -- operario dueño
  anticipo_id      uuid references public.anticipos (id) on delete set null, -- null = reembolso directo
  type_id          uuid not null references public.expense_types (id) on delete restrict,
  category_id      uuid not null references public.expense_categories (id) on delete restrict,
  location_id      uuid references public.locations (id) on delete set null,  -- opcional
  descripcion      text,
  fecha_gasto      date not null,                    -- <= bogota_today() (trigger)
  monto            bigint not null check (monto > 0),
  proveedor_nombre text,                             -- persona / tercero
  proveedor_nit    text,
  estado           public.expense_status not null default 'borrador',
  soporte_pendiente boolean not null default true,   -- true = sin soporte adjunto; contabilidad debe resolver
  motivo_rechazo   text,                             -- obligatorio al pasar a 'rechazado' (trigger)
  closure_id       uuid references public.reimbursement_closures (id) on delete set null,
  siigo_document_id text,                            -- id devuelto por Siigo tras push exitoso
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on column public.expenses.id is 'PK y clave de idempotencia para el push a Siigo.';
comment on column public.expenses.soporte_pendiente is
  'Soporte es opcional al enviar; si no hay archivo, queda pendiente y contabilidad debe resolverlo antes de aprobar.';

create index if not exists idx_expenses_user     on public.expenses (user_id);
create index if not exists idx_expenses_estado   on public.expenses (estado);
create index if not exists idx_expenses_anticipo on public.expenses (anticipo_id);
create index if not exists idx_expenses_closure  on public.expenses (closure_id);
create index if not exists idx_expenses_fecha    on public.expenses (fecha_gasto);

-- ---------------------------------------------------------------------------
-- expense_status_log — bitácora inmutable de cada cambio de estado
-- ---------------------------------------------------------------------------
create table if not exists public.expense_status_log (
  id          bigint generated always as identity primary key,
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  from_estado public.expense_status,               -- null en la creación
  to_estado   public.expense_status not null,
  changed_by  uuid references public.users (id),
  comentario  text,                                -- motivo (obligatorio en rechazo / override admin)
  created_at  timestamptz not null default now()
);
create index if not exists idx_status_log_expense on public.expense_status_log (expense_id);

-- ---------------------------------------------------------------------------
-- file_attachments — fotos/escaneados de soportes (varios por gasto)
-- ---------------------------------------------------------------------------
create table if not exists public.file_attachments (
  id           uuid primary key default gen_random_uuid(),
  expense_id   uuid not null references public.expenses (id) on delete cascade,
  storage_path text not null,                      -- ruta en el bucket 'soportes'
  file_name    text,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references public.users (id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_attachments_expense on public.file_attachments (expense_id);

-- ---------------------------------------------------------------------------
-- siigo_pushes — log de cada push de documento soporte a Siigo
-- ---------------------------------------------------------------------------
create table if not exists public.siigo_pushes (
  id               uuid primary key default gen_random_uuid(),
  expense_id       uuid not null references public.expenses (id) on delete cascade,
  idempotency_key  uuid not null,                  -- = expense_id, evita duplicados
  status           public.siigo_push_status not null default 'pending',
  siigo_document_id text,
  request_payload  jsonb,
  response         jsonb,
  error_message    text,
  dry_run          boolean not null default false,
  pushed_by        uuid references public.users (id),
  created_at       timestamptz not null default now()
);
-- Un solo push exitoso por gasto (idempotencia dura); reintentos tras error sí se permiten.
create unique index if not exists uq_siigo_push_success
  on public.siigo_pushes (idempotency_key)
  where status = 'success';
create index if not exists idx_siigo_pushes_expense on public.siigo_pushes (expense_id);

-- ---------------------------------------------------------------------------
-- audit_log — bitácora general de acciones sensibles (borrados, overrides,
-- reaperturas, gestión de usuarios/categorías). Inmutable.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.users (id),
  action      text not null,                       -- 'delete' | 'override_pagado' | 'reopen_closure' | ...
  entity_type text not null,                       -- 'expense' | 'anticipo' | 'closure' | 'user' | ...
  entity_id   uuid,
  motivo      text,                                -- obligatorio en acciones admin (trigger)
  detail      jsonb,                               -- snapshot del registro (tombstone) u otros datos
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_actor  on public.audit_log (actor_id);
create index if not exists idx_audit_entity on public.audit_log (entity_type, entity_id);
create index if not exists idx_audit_action on public.audit_log (action);
create index if not exists idx_audit_created on public.audit_log (created_at);
