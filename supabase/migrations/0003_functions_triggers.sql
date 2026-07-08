-- =============================================================================
-- Forest Gastos — 0003 · Functions & triggers (lifecycle, audit, integrity)
-- =============================================================================
-- The expense status machine is enforced HERE at the DB level. No UI-only rules.
-- Motivo/comentario for status changes, admin overrides and deletes is passed
-- by the API via a transaction-local GUC:
--     select set_config('app.change_comment', 'texto del motivo', true);
-- before issuing the UPDATE/DELETE. Read back with current_setting(..., true).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role helper functions (defined here, after public.users exists in 0002).
-- SECURITY DEFINER so RLS on public.users does not recurse when a policy needs
-- to know the caller's role.
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.user_role
language sql stable security definer set search_path = public, pg_temp
as $$ select rol from public.users where id = auth.uid() and active = true; $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select public.current_app_role() = 'admin'; $$;

create or replace function public.is_contabilidad_or_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select public.current_app_role() in ('contabilidad', 'admin'); $$;

comment on function public.current_app_role() is
  'Rol del usuario autenticado (auth.uid()). SECURITY DEFINER para evitar recursión de RLS.';

-- ---------------------------------------------------------------------------
-- Generic updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'users','expense_types','expense_categories','locations',
    'anticipos','expenses','reimbursement_closures'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New auth user -> application profile (rol usuario por defecto; admin ajusta)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.users (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    'usuario'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Expense status machine
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_expense_transition(
  old_status public.expense_status, new_status public.expense_status)
returns boolean language sql immutable as $$
  select (old_status, new_status) in (
    ('borrador','enviado'),
    ('enviado','en_revision'),
    ('en_revision','aprobado'),
    ('en_revision','rechazado'),
    ('rechazado','enviado'),   -- reenvío tras corrección
    ('aprobado','pagado')      -- vía cierre
  );
$$;

-- BEFORE UPDATE guard: pagado immutability, valid transitions, motivos, fecha.
create or replace function public.expenses_before_update_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role    public.user_role := public.current_app_role();
  v_comment text := nullif(current_setting('app.change_comment', true), '');
begin
  -- Fecha del gasto nunca en el futuro (America/Bogota).
  if new.fecha_gasto > public.bogota_today() then
    raise exception 'La fecha del gasto no puede ser futura (%).', new.fecha_gasto
      using errcode = 'check_violation';
  end if;

  -- Registro en estado 'pagado': solo admin puede tocarlo, y con motivo.
  if old.estado = 'pagado' and v_role is distinct from 'admin' then
    raise exception 'Solo un administrador puede modificar un gasto en estado pagado.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Cambios de estado.
  if new.estado is distinct from old.estado then
    if not public.is_valid_expense_transition(old.estado, new.estado) then
      if v_role is distinct from 'admin' then
        raise exception 'Transición de estado inválida: % -> %.', old.estado, new.estado
          using errcode = 'check_violation';
      elsif v_comment is null then
        raise exception 'Override de estado por admin requiere motivo (app.change_comment).'
          using errcode = 'check_violation';
      end if;
    end if;

    if new.estado = 'rechazado' and nullif(new.motivo_rechazo, '') is null then
      raise exception 'El rechazo requiere un motivo (motivo_rechazo).'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Admin editando un gasto pagado (con o sin cambio de estado): deja rastro.
  if old.estado = 'pagado' and v_role = 'admin' then
    if v_comment is null then
      raise exception 'Editar un gasto pagado requiere motivo (app.change_comment).'
        using errcode = 'check_violation';
    end if;
    insert into public.audit_log (actor_id, action, entity_type, entity_id, motivo, detail)
    values (auth.uid(), 'override_pagado', 'expense', old.id, v_comment,
            jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  end if;

  return new;
end $$;

drop trigger if exists trg_expenses_before_update on public.expenses;
create trigger trg_expenses_before_update
  before update on public.expenses
  for each row execute function public.expenses_before_update_guard();

-- AFTER INSERT/UPDATE: bitácora inmutable de estado (SECURITY DEFINER escribe
-- saltándose la RLS restrictiva de expense_status_log).
create or replace function public.expenses_log_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_comment text := nullif(current_setting('app.change_comment', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.expense_status_log (expense_id, from_estado, to_estado, changed_by, comentario)
    values (new.id, null, new.estado, auth.uid(), v_comment);
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    insert into public.expense_status_log (expense_id, from_estado, to_estado, changed_by, comentario)
    values (new.id, old.estado, new.estado, auth.uid(),
            coalesce(v_comment, case when new.estado = 'rechazado' then new.motivo_rechazo end));
  end if;
  return null;
end $$;

drop trigger if exists trg_expenses_log_insert on public.expenses;
create trigger trg_expenses_log_insert
  after insert on public.expenses
  for each row execute function public.expenses_log_status();

drop trigger if exists trg_expenses_log_update on public.expenses;
create trigger trg_expenses_log_update
  after update on public.expenses
  for each row execute function public.expenses_log_status();

-- BEFORE INSERT: fecha no futura + coherencia anticipo/operario.
create or replace function public.expenses_before_insert_guard()
returns trigger language plpgsql as $$
begin
  if new.fecha_gasto > public.bogota_today() then
    raise exception 'La fecha del gasto no puede ser futura (%).', new.fecha_gasto
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_expenses_before_insert on public.expenses;
create trigger trg_expenses_before_insert
  before insert on public.expenses
  for each row execute function public.expenses_before_insert_guard();

-- El anticipo vinculado debe pertenecer al mismo operario del gasto.
create or replace function public.check_anticipo_owner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid;
begin
  if new.anticipo_id is not null then
    select user_id into v_owner from public.anticipos where id = new.anticipo_id;
    if v_owner is distinct from new.user_id then
      raise exception 'El anticipo pertenece a otro operario.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_expenses_anticipo_owner on public.expenses;
create trigger trg_expenses_anticipo_owner
  before insert or update of anticipo_id, user_id on public.expenses
  for each row execute function public.check_anticipo_owner();

-- ---------------------------------------------------------------------------
-- Tombstone delete guard: solo admin borra; deja snapshot inmutable + motivo.
-- Aplicado a expenses, anticipos, reimbursement_closures.
-- ---------------------------------------------------------------------------
create or replace function public.tombstone_before_delete()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_comment text := nullif(current_setting('app.change_comment', true), '');
  v_detail  jsonb := jsonb_build_object('row', to_jsonb(old));
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede eliminar registros.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_comment is null then
    raise exception 'Eliminar requiere motivo (app.change_comment).'
      using errcode = 'check_violation';
  end if;
  if tg_table_name = 'expenses' then
    v_detail := v_detail || jsonb_build_object(
      'status_log', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
                     from public.expense_status_log l where l.expense_id = old.id));
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, motivo, detail)
  values (auth.uid(), 'delete', tg_table_name, old.id, v_comment, v_detail);
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array['expenses','anticipos','reimbursement_closures'] loop
    execute format('drop trigger if exists trg_%1$s_tombstone on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_tombstone before delete on public.%1$s
       for each row execute function public.tombstone_before_delete()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Closure saldo direction — deriva la dirección desde el saldo con signo.
-- ---------------------------------------------------------------------------
create or replace function public.closures_set_direction()
returns trigger language plpgsql as $$
begin
  new.saldo := new.total_gastos - new.anticipo_aplicado;
  new.saldo_direccion := case
    when new.saldo > 0 then 'a_favor_operario'::public.saldo_direccion  -- Forest debe
    when new.saldo < 0 then 'a_favor_forest'::public.saldo_direccion    -- operario devuelve
    else 'neutro'::public.saldo_direccion
  end;
  return new;
end $$;

drop trigger if exists trg_closures_direction on public.reimbursement_closures;
create trigger trg_closures_direction
  before insert or update on public.reimbursement_closures
  for each row execute function public.closures_set_direction();

-- ---------------------------------------------------------------------------
-- Live anticipo balance view. security_invoker => respeta RLS de las tablas.
-- saldo = monto - sum(gastos vinculados aprobados/pagados).
-- ---------------------------------------------------------------------------
create or replace view public.anticipo_balances
  with (security_invoker = true) as
select
  a.id                as anticipo_id,
  a.user_id,
  a.monto,
  a.estado,
  coalesce(sum(e.monto) filter (where e.estado in ('aprobado','pagado')), 0) as gastos_aplicados,
  a.monto - coalesce(sum(e.monto) filter (where e.estado in ('aprobado','pagado')), 0) as saldo
from public.anticipos a
left join public.expenses e on e.anticipo_id = a.id
group by a.id, a.user_id, a.monto, a.estado;

comment on view public.anticipo_balances is
  'Saldo vivo del anticipo. saldo>0 = queda anticipo por gastar; saldo<0 = gastos exceden el anticipo.';
