-- =============================================================================
-- Forest Gastos — 0009 · Ventana de edición hasta el cruce + gastos sin factura
-- =============================================================================
-- 1) Editar/eliminar gasto y soportes mientras NO esté "cruzado"
--    (cruzado = estado 'pagado'  O  ya enviado a Siigo => siigo_document_id).
--    Pueden: el operario dueño y contabilidad. Admin siempre.
--    Editar montos/fecha/tipo/categoría de un gasto aprobado/en revisión por el
--    dueño lo regresa a 'enviado' (re-aprobación).
-- 2) Gastos "sin factura": el operario declara que no hay soporte (motivo
--    obligatorio). Se distingue de "soporte pendiente".
-- =============================================================================

-- ── Campos "sin factura" ─────────────────────────────────────────────────────
alter table public.expenses add column if not exists sin_soporte boolean not null default false;
alter table public.expenses add column if not exists sin_soporte_motivo text;
alter table public.expenses drop constraint if exists chk_sin_soporte_motivo;
alter table public.expenses add constraint chk_sin_soporte_motivo
  check (sin_soporte = false or (sin_soporte_motivo is not null and length(trim(sin_soporte_motivo)) > 0));

-- ── Transiciones nuevas: re-edición devuelve a 'enviado' ─────────────────────
create or replace function public.is_valid_expense_transition(
  old_status public.expense_status, new_status public.expense_status)
returns boolean language sql immutable as $$
  select (old_status, new_status) in (
    ('borrador','enviado'),
    ('enviado','en_revision'),
    ('en_revision','aprobado'),
    ('en_revision','rechazado'),
    ('rechazado','enviado'),
    ('aprobado','pagado'),
    ('en_revision','enviado'),   -- re-edición / corrección
    ('aprobado','enviado')       -- re-edición tras aprobación
  );
$$;

-- ── Guard de UPDATE (reemplaza el de 0003, ampliado) ─────────────────────────
create or replace function public.expenses_before_update_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role    public.user_role := public.current_app_role();
  v_comment text := nullif(current_setting('app.change_comment', true), '');
  v_material boolean;
begin
  if new.fecha_gasto > public.bogota_today() then
    raise exception 'La fecha del gasto no puede ser futura (%).', new.fecha_gasto
      using errcode = 'check_violation';
  end if;

  -- Cruzado (pagado o en Siigo): solo admin puede modificar.
  if (old.estado = 'pagado' or old.siigo_document_id is not null) and v_role is distinct from 'admin' then
    raise exception 'El gasto ya fue cruzado (pagado o enviado a Siigo); solo un administrador puede modificarlo.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Auto-reset: el dueño edita campos materiales de un gasto en revisión/aprobado
  -- => vuelve a 'enviado' para re-aprobación. (Agregar/quitar soporte no aplica aquí.)
  v_material := (new.monto is distinct from old.monto)
             or (new.fecha_gasto is distinct from old.fecha_gasto)
             or (new.type_id is distinct from old.type_id)
             or (new.category_id is distinct from old.category_id);
  if v_role = 'usuario' and old.user_id = auth.uid()
     and old.estado in ('en_revision', 'aprobado')
     and v_material and new.estado = old.estado then
    new.estado := 'enviado';
  end if;

  if new.estado is distinct from old.estado then
    -- Quién: revisar/aprobar/pagar/rechazar es de contabilidad/admin.
    if new.estado in ('en_revision','aprobado','pagado','rechazado') and v_role = 'usuario' then
      raise exception 'No autorizado para cambiar el gasto a %.', new.estado
        using errcode = 'insufficient_privilege';
    end if;
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

  -- Admin editando un gasto pagado: queda en auditoría.
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

-- ── Delete de gasto: dueño/contabilidad si NO cruzado; admin siempre; tombstone
-- Reemplaza el tombstone genérico solo para expenses.
create or replace function public.expenses_before_delete()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role    public.user_role := public.current_app_role();
  v_comment text := nullif(current_setting('app.change_comment', true), '');
  v_crossed boolean := (old.estado = 'pagado' or old.siigo_document_id is not null);
begin
  if v_crossed then
    if v_role is distinct from 'admin' then
      raise exception 'El gasto ya fue cruzado; solo un administrador puede eliminarlo.'
        using errcode = 'insufficient_privilege';
    end if;
    if v_comment is null then
      raise exception 'Eliminar un gasto cruzado requiere motivo.' using errcode = 'check_violation';
    end if;
  elsif not (v_role in ('contabilidad','admin') or old.user_id = auth.uid()) then
    raise exception 'No autorizado para eliminar este gasto.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, motivo, detail)
  values (auth.uid(), 'delete', 'expense', old.id, v_comment,
          jsonb_build_object('row', to_jsonb(old),
            'status_log', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
                           from public.expense_status_log l where l.expense_id = old.id)));
  return old;
end $$;

drop trigger if exists trg_expenses_tombstone on public.expenses;
drop trigger if exists trg_expenses_before_delete on public.expenses;
create trigger trg_expenses_before_delete before delete on public.expenses
  for each row execute function public.expenses_before_delete();

-- ── RLS: ampliar edición/borrado hasta el cruce ──────────────────────────────
drop policy if exists expenses_update_owner on public.expenses;
create policy expenses_update_owner on public.expenses for update to authenticated
  using (user_id = auth.uid() and estado <> 'pagado' and siigo_document_id is null)
  with check (user_id = auth.uid() and estado <> 'pagado');

drop policy if exists expenses_update_contab on public.expenses;
create policy expenses_update_contab on public.expenses for update to authenticated
  using (public.current_app_role() = 'contabilidad' and estado <> 'pagado' and siigo_document_id is null)
  with check (public.current_app_role() = 'contabilidad');

drop policy if exists expenses_delete_admin on public.expenses;
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated using (
  public.is_admin()
  or (estado <> 'pagado' and siigo_document_id is null
      and (user_id = auth.uid() or public.current_app_role() = 'contabilidad'))
);

-- ── RLS: soportes editables hasta el cruce (dueño o contabilidad) ─────────────
drop policy if exists attachments_insert on public.file_attachments;
create policy attachments_insert on public.file_attachments for insert to authenticated
  with check (
    public.is_contabilidad_or_admin()
    or exists (select 1 from public.expenses e
               where e.id = file_attachments.expense_id
                 and e.user_id = auth.uid()
                 and e.estado <> 'pagado' and e.siigo_document_id is null)
  );

drop policy if exists attachments_delete on public.file_attachments;
create policy attachments_delete on public.file_attachments for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.expenses e
               where e.id = file_attachments.expense_id
                 and e.estado <> 'pagado' and e.siigo_document_id is null
                 and (e.user_id = auth.uid() or public.current_app_role() = 'contabilidad'))
  );

-- ── Storage: permitir borrar el archivo al dueño/contabilidad/admin ──────────
drop policy if exists soportes_delete on storage.objects;
create policy soportes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'soportes' and (public.is_contabilidad_or_admin() or public.owns_soporte_object(name)));
