-- =============================================================================
-- Forest Gastos — 0010 · Cierres por lote (tabla de cuentas por cerrar)
-- =============================================================================
-- - Vista closure_candidates: por operario, gastos aprobados sin cerrar
--   (total, #gastos, #sin factura) + anticipos activos + saldo a pagar.
-- - RPC create_closure_auto: cierra TODA la cuenta pendiente de un operario
--   (todos sus gastos aprobados sin cerrar + liquida sus anticipos activos).
-- =============================================================================

create or replace view public.closure_candidates
  with (security_invoker = true) as
select
  u.id    as user_id,
  u.nombre,
  u.email,
  g.n_gastos,
  g.n_sin_factura,
  g.total_gastos,
  coalesce(a.anticipo_total, 0)              as anticipo_total,
  g.total_gastos - coalesce(a.anticipo_total, 0) as saldo
from public.users u
join (
  select user_id,
         count(*)::int                              as n_gastos,
         count(*) filter (where sin_soporte)::int   as n_sin_factura,
         sum(monto)::bigint                         as total_gastos
  from public.expenses
  where estado = 'aprobado' and closure_id is null
  group by user_id
) g on g.user_id = u.id
left join (
  select user_id, sum(monto)::bigint as anticipo_total
  from public.anticipos where estado = 'activo'
  group by user_id
) a on a.user_id = u.id;

grant select on public.closure_candidates to authenticated;

comment on view public.closure_candidates is
  'Operarios con gastos aprobados sin cerrar. saldo = total_gastos - anticipos_activos (a pagar si > 0).';

-- Cierre automático de toda la cuenta pendiente de un operario.
create or replace function public.create_closure_auto(
  p_user_id       uuid,
  p_metodo_pago   public.payment_method default 'transferencia',
  p_observaciones text default null
) returns public.reimbursement_closures
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_ids     uuid[];
  v_total   bigint;
  v_ant_ids uuid[];
  v_ant     bigint;
  v_single  uuid;
  v_closure public.reimbursement_closures;
begin
  select array_agg(id), coalesce(sum(monto), 0)
    into v_ids, v_total
    from public.expenses
   where user_id = p_user_id and estado = 'aprobado' and closure_id is null;

  if v_ids is null then
    raise exception 'El operario no tiene gastos aprobados por cerrar.' using errcode = 'check_violation';
  end if;

  select array_agg(id), coalesce(sum(monto), 0)
    into v_ant_ids, v_ant
    from public.anticipos where user_id = p_user_id and estado = 'activo';
  v_ant := coalesce(v_ant, 0);
  v_single := case when array_length(v_ant_ids, 1) = 1 then v_ant_ids[1] else null end;

  insert into public.reimbursement_closures
    (user_id, total_gastos, anticipo_id, anticipo_aplicado, metodo_pago, observaciones, created_by)
  values
    (p_user_id, v_total, v_single, v_ant, p_metodo_pago, p_observaciones, auth.uid())
  returning * into v_closure;

  perform set_config('app.change_comment', 'Cierre por lote ' || v_closure.id, true);
  update public.expenses set estado = 'pagado', closure_id = v_closure.id where id = any(v_ids);
  if v_ant_ids is not null then
    update public.anticipos set estado = 'liquidado', closure_id = v_closure.id where id = any(v_ant_ids);
  end if;

  return v_closure;
end $$;

comment on function public.create_closure_auto is
  'Cierra toda la cuenta pendiente de un operario (gastos aprobados + anticipos activos). Atómico.';
