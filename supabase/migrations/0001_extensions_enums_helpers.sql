-- =============================================================================
-- Forest Gastos — 0001 · Extensions, enums, and role helper functions
-- =============================================================================
-- All identifiers in English. Money is stored as BIGINT (integer COP pesos).
-- Timezone for all date logic: America/Bogota (enforced in triggers, not CHECKs,
-- because now()/current_date are not IMMUTABLE and cannot live in a CHECK).
-- =============================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'contabilidad', 'usuario');
exception when duplicate_object then null; end $$;

-- Expense lifecycle. Display layer renders 'en_revision' as "en revisión".
do $$ begin
  create type public.expense_status as enum (
    'borrador', 'enviado', 'en_revision', 'aprobado', 'pagado', 'rechazado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.anticipo_estado as enum ('activo', 'liquidado', 'cerrado');
exception when duplicate_object then null; end $$;

-- Cómo se entregó el anticipo / cómo se paga el reembolso.
do $$ begin
  create type public.payment_method as enum ('efectivo', 'transferencia', 'otro');
exception when duplicate_object then null; end $$;

-- Resultado del cierre: ¿a favor de quién queda el saldo?
do $$ begin
  create type public.saldo_direccion as enum (
    'a_favor_operario',  -- Forest le debe al operario (reembolso)
    'a_favor_forest',    -- El operario debe devolver a Forest (devolución)
    'neutro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.siigo_push_status as enum ('pending', 'success', 'error', 'dry_run');
exception when duplicate_object then null; end $$;

-- Current date in Colombia timezone — used by triggers/defaults for date checks.
-- (No dependency on public.users, so it can live here and be used as a default
--  in 0002. The role helpers, which read public.users, are defined in 0003.)
create or replace function public.bogota_today()
returns date
language sql stable
as $$ select (now() at time zone 'America/Bogota')::date; $$;
