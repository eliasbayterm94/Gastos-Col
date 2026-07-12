-- =============================================================================
-- Forest Gastos — 0008 · Áreas, regiones de cliente y modelo orthogonal
-- =============================================================================
-- Cambios de estructura (los datos de catálogo van en seed.sql, idempotente):
--  - areas (catálogo) + users.area_id
--  - client_regions (catálogo) + expenses.client_region_id (opcional)
--  - expense_types.is_client (marca el tipo que pide región de cliente)
--  - expense_categories desacoplada de expense_types (tipo y categoría
--    ahora son dimensiones independientes -> mejor análisis)
-- =============================================================================

-- ── Áreas (en el usuario) ────────────────────────────────────────────────────
create table if not exists public.areas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.users
  add column if not exists area_id uuid references public.areas (id) on delete set null;

-- ── Regiones de cliente (en el gasto, opcional) ──────────────────────────────
create table if not exists public.client_regions (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.expenses
  add column if not exists client_region_id uuid references public.client_regions (id) on delete set null;

-- ── Tipo "cliente": dispara el campo de región en el formulario ──────────────
alter table public.expense_types
  add column if not exists is_client boolean not null default false;

-- ── Desacople tipo/categoría ─────────────────────────────────────────────────
alter table public.expense_categories alter column type_id drop not null;
alter table public.expense_categories drop constraint if exists expense_categories_type_id_nombre_key;
-- Resolver posibles nombres duplicados antes del índice único (renombra, no borra;
-- así no rompe FKs de gastos existentes).
with d as (
  select id, row_number() over (partition by nombre order by created_at, id) rn
  from public.expense_categories
)
update public.expense_categories c
   set nombre = c.nombre || ' (' || left(c.id::text, 4) || ')'
  from d where d.id = c.id and d.rn > 1;
create unique index if not exists uq_expense_categories_nombre on public.expense_categories (nombre);

-- ── updated_at para las nuevas tablas ────────────────────────────────────────
drop trigger if exists trg_areas_updated_at on public.areas;
create trigger trg_areas_updated_at before update on public.areas
  for each row execute function public.set_updated_at();
drop trigger if exists trg_client_regions_updated_at on public.client_regions;
create trigger trg_client_regions_updated_at before update on public.client_regions
  for each row execute function public.set_updated_at();

-- ── RLS: lectura para todos; escritura solo admin (igual que catálogos) ──────
alter table public.areas          enable row level security;
alter table public.client_regions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['areas','client_regions'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists %1$s_admin_all on public.%1$s', t);
    execute format('create policy %1$s_admin_all on public.%1$s for all to authenticated
                    using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
