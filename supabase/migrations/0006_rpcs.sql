-- =============================================================================
-- Forest Gastos — 0006 · RPCs (backend logic as atomic, RLS-respecting funcs)
-- =============================================================================
-- All RPCs are SECURITY INVOKER: they run as the caller, so RLS (0004) and the
-- lifecycle triggers (0003) remain the single source of truth. The RPCs exist
-- only to (a) set the transaction-local motivo GUC and the UPDATE in ONE
-- transaction, and (b) make multi-row operations (closures) atomic.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- write_audit_log — escritor de audit_log para RPCs (SECURITY DEFINER, ya que
-- audit_log no tiene política de INSERT: solo lo escribe código definer, igual
-- que los triggers de 0003).
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action text, p_entity_type text, p_entity_id uuid, p_motivo text, p_detail jsonb
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, motivo, detail)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_motivo, p_detail);
$$;

-- ---------------------------------------------------------------------------
-- set_expense_status — cambia el estado de un gasto pasando el motivo en la
-- misma transacción. RLS decide si el caller puede; los triggers validan la
-- transición y escriben la bitácora. Devuelve el gasto actualizado.
-- ---------------------------------------------------------------------------
create or replace function public.set_expense_status(
  p_expense_id uuid,
  p_new_status public.expense_status,
  p_comment    text default null
) returns public.expenses
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_row public.expenses;
begin
  perform set_config('app.change_comment', coalesce(p_comment, ''), true);

  update public.expenses
     set estado = p_new_status,
         motivo_rechazo = case
           when p_new_status = 'rechazado' then p_comment
           else motivo_rechazo
         end
   where id = p_expense_id
   returning * into v_row;

  if not found then
    -- 0 filas: o no existe, o la RLS no permite al caller tocar esta fila.
    raise exception 'No se pudo cambiar el estado del gasto % (no existe o sin permiso).', p_expense_id
      using errcode = 'insufficient_privilege';
  end if;

  return v_row;
end $$;

comment on function public.set_expense_status is
  'Transición de estado de un gasto con motivo, en una sola transacción. RLS + triggers gobiernan permiso y validez.';

-- ---------------------------------------------------------------------------
-- create_closure — motor de cierre atómico.
-- Toma gastos APROBADOS de un operario (y opcionalmente un anticipo), genera
-- el registro de cierre, mueve los gastos a 'pagado' y liquida el anticipo.
-- total_gastos = suma de los gastos seleccionados; saldo lo calcula el trigger.
-- Un cierre puede combinar gastos vinculados a un anticipo + gastos directos.
-- ---------------------------------------------------------------------------
create or replace function public.create_closure(
  p_user_id       uuid,
  p_expense_ids   uuid[],
  p_anticipo_id   uuid    default null,
  p_metodo_pago   public.payment_method default null,
  p_observaciones text    default null
) returns public.reimbursement_closures
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_total     bigint;
  v_count     int;
  v_anticipo  bigint := 0;
  v_closure   public.reimbursement_closures;
begin
  if p_expense_ids is null or array_length(p_expense_ids, 1) is null then
    raise exception 'Debe incluir al menos un gasto en el cierre.'
      using errcode = 'check_violation';
  end if;

  -- Todos los gastos deben ser del operario, estar APROBADOS y sin cierre previo.
  select count(*), coalesce(sum(monto), 0)
    into v_count, v_total
    from public.expenses
   where id = any(p_expense_ids)
     and user_id = p_user_id
     and estado = 'aprobado'
     and closure_id is null;

  if v_count is distinct from array_length(p_expense_ids, 1) then
    raise exception 'Algún gasto no es del operario, no está aprobado, o ya está en un cierre.'
      using errcode = 'check_violation';
  end if;

  -- Anticipo opcional: debe ser del mismo operario y estar activo.
  if p_anticipo_id is not null then
    select monto into v_anticipo
      from public.anticipos
     where id = p_anticipo_id and user_id = p_user_id and estado = 'activo';
    if not found then
      raise exception 'El anticipo no existe, no es del operario, o no está activo.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Crear el cierre (RLS INSERT exige contabilidad/admin; trigger calcula saldo).
  insert into public.reimbursement_closures
    (user_id, total_gastos, anticipo_id, anticipo_aplicado, metodo_pago, observaciones, created_by)
  values
    (p_user_id, v_total, p_anticipo_id, v_anticipo, p_metodo_pago, p_observaciones, auth.uid())
  returning * into v_closure;

  -- Mover gastos a 'pagado' y vincularlos al cierre.
  perform set_config('app.change_comment', 'Cierre de reembolso ' || v_closure.id, true);
  update public.expenses
     set estado = 'pagado', closure_id = v_closure.id
   where id = any(p_expense_ids);

  -- Liquidar el anticipo.
  if p_anticipo_id is not null then
    update public.anticipos
       set estado = 'liquidado', closure_id = v_closure.id
     where id = p_anticipo_id;
  end if;

  return v_closure;
end $$;

comment on function public.create_closure is
  'Cierre atómico: agrupa gastos aprobados de un operario, opcionalmente liquida un anticipo, y deja saldo con dirección. Todo o nada.';

-- ---------------------------------------------------------------------------
-- reopen_closure — solo admin. Revierte un cierre: gastos vuelven a 'aprobado',
-- el anticipo vuelve a 'activo', y queda registrado en audit_log.
-- ---------------------------------------------------------------------------
create or replace function public.reopen_closure(
  p_closure_id uuid,
  p_motivo     text
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_closure public.reimbursement_closures;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede reabrir un cierre.'
      using errcode = 'insufficient_privilege';
  end if;
  if nullif(p_motivo, '') is null then
    raise exception 'Reabrir un cierre requiere motivo.' using errcode = 'check_violation';
  end if;

  select * into v_closure from public.reimbursement_closures where id = p_closure_id;
  if not found then
    raise exception 'Cierre % no encontrado.', p_closure_id using errcode = 'no_data_found';
  end if;

  -- Gastos pagados del cierre -> aprobado. (RLS: solo admin puede editar pagado.)
  perform set_config('app.change_comment', 'Reapertura de cierre: ' || p_motivo, true);
  update public.expenses
     set estado = 'aprobado', closure_id = null
   where closure_id = p_closure_id and estado = 'pagado';

  -- Anticipo liquidado -> activo.
  if v_closure.anticipo_id is not null then
    update public.anticipos
       set estado = 'activo', closure_id = null
     where id = v_closure.anticipo_id;
  end if;

  update public.reimbursement_closures set reopened = true where id = p_closure_id;

  perform public.write_audit_log('reopen_closure', 'closure', p_closure_id, p_motivo, to_jsonb(v_closure));
end $$;

comment on function public.reopen_closure is
  'Solo admin. Revierte un cierre (gastos a aprobado, anticipo a activo) y lo registra en audit_log.';
