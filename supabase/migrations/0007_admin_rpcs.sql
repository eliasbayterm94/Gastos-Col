-- =============================================================================
-- Forest Gastos — 0007 · Admin override RPCs
-- =============================================================================
-- Herramientas de administrador. SECURITY INVOKER: la RLS sigue exigiendo admin;
-- estos RPCs solo permiten pasar el motivo (app.change_comment) y el UPDATE/DELETE
-- en la misma transacción para que los triggers de 0003 dejen el rastro.
-- =============================================================================

-- Editar campos de un gasto (incl. pagado). Motivo obligatorio; queda en audit_log.
create or replace function public.admin_update_expense(
  p_id uuid, p_patch jsonb, p_motivo text
) returns public.expenses
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  allowed text[] := array['monto','category_id','type_id','location_id',
                          'descripcion','proveedor_nombre','proveedor_nit','fecha_gasto'];
  k text; setters text[] := '{}'; v_row public.expenses;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede usar esta herramienta.'
      using errcode = 'insufficient_privilege';
  end if;
  if nullif(p_motivo, '') is null then
    raise exception 'El motivo es obligatorio.' using errcode = 'check_violation';
  end if;

  perform set_config('app.change_comment', p_motivo, true);

  for k in select jsonb_object_keys(p_patch) loop
    if k = any(allowed) then
      setters := setters || format('%I = %L', k, p_patch ->> k);
    end if;
  end loop;
  if array_length(setters, 1) is null then
    raise exception 'No hay campos válidos para actualizar.' using errcode = 'check_violation';
  end if;

  execute format('update public.expenses set %s where id = %L returning *',
                 array_to_string(setters, ', '), p_id)
    into v_row;
  if v_row.id is null then
    raise exception 'Gasto % no encontrado.', p_id using errcode = 'no_data_found';
  end if;
  return v_row;
end $$;

-- Eliminar un gasto (tombstone en audit_log vía trigger). Motivo obligatorio.
create or replace function public.admin_delete_expense(
  p_id uuid, p_motivo text
) returns void
language plpgsql security invoker set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede eliminar.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(p_motivo, '') is null then
    raise exception 'El motivo es obligatorio.' using errcode = 'check_violation';
  end if;
  perform set_config('app.change_comment', p_motivo, true);
  delete from public.expenses where id = p_id;
  if not found then
    raise exception 'Gasto % no encontrado.', p_id using errcode = 'no_data_found';
  end if;
end $$;

comment on function public.admin_update_expense is
  'Admin: edita campos de un gasto (incl. pagado) con motivo obligatorio, registrado en audit_log.';
comment on function public.admin_delete_expense is
  'Admin: elimina un gasto dejando tombstone con motivo en audit_log.';
