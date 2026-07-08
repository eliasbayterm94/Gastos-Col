-- =============================================================================
-- Forest Gastos — 0004 · Row Level Security (source of truth for permissions)
-- =============================================================================
-- Roles:
--   usuario      : sus propios gastos en estados editables (borrador, rechazado);
--                  lee sus anticipos, cierres y estados. Nunca DELETE.
--   contabilidad : lee todo; mueve gastos por el flujo; crea anticipos y cierres;
--                  push a Siigo. NO puede DELETE. NO puede editar gastos pagados.
--   admin        : todo, incluido DELETE y editar pagados (siempre con motivo, logueado).
-- Triggers en 0003 refuerzan la máquina de estados y la inmutabilidad de pagado;
-- la RLS gobierna QUIÉN, los triggers gobiernan CÓMO.
-- =============================================================================

alter table public.users                  enable row level security;
alter table public.expense_types          enable row level security;
alter table public.expense_categories     enable row level security;
alter table public.locations              enable row level security;
alter table public.anticipos              enable row level security;
alter table public.expenses               enable row level security;
alter table public.expense_status_log     enable row level security;
alter table public.file_attachments       enable row level security;
alter table public.reimbursement_closures enable row level security;
alter table public.siigo_pushes           enable row level security;
alter table public.audit_log              enable row level security;

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (id = auth.uid() or public.is_contabilidad_or_admin());

-- Gestión de usuarios: solo admin (agregar/rol/desactivar). La creación real de
-- la fila la hace el trigger handle_new_user o el service_role (bypassa RLS).
drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists users_admin_insert on public.users;
create policy users_admin_insert on public.users for insert to authenticated
  with check (public.is_admin());

drop policy if exists users_admin_delete on public.users;
create policy users_admin_delete on public.users for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Catálogos: expense_types, expense_categories, locations
-- Lectura para todos; escritura solo admin.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['expense_types','expense_categories','locations'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists %1$s_admin_all on public.%1$s', t);
    execute format(
      'create policy %1$s_admin_all on public.%1$s for all to authenticated
       using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- anticipos
-- ----------------------------------------------------------------------------
drop policy if exists anticipos_select on public.anticipos;
create policy anticipos_select on public.anticipos for select to authenticated
  using (user_id = auth.uid() or public.is_contabilidad_or_admin());

drop policy if exists anticipos_insert on public.anticipos;
create policy anticipos_insert on public.anticipos for insert to authenticated
  with check (public.is_contabilidad_or_admin());
drop policy if exists anticipos_update on public.anticipos;
create policy anticipos_update on public.anticipos for update to authenticated
  using (public.is_contabilidad_or_admin()) with check (public.is_contabilidad_or_admin());

drop policy if exists anticipos_delete on public.anticipos;
create policy anticipos_delete on public.anticipos for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- expenses
-- ----------------------------------------------------------------------------
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (user_id = auth.uid() or public.is_contabilidad_or_admin());

-- usuario inserta SOLO gastos propios; admin puede insertar cualquiera.
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    (user_id = auth.uid() and public.current_app_role() = 'usuario')
    or public.is_admin()
  );

-- usuario: actualiza solo gastos propios en estados editables.
drop policy if exists expenses_update_owner on public.expenses;
create policy expenses_update_owner on public.expenses for update to authenticated
  using (user_id = auth.uid() and estado in ('borrador','rechazado'))
  with check (user_id = auth.uid() and estado in ('borrador','rechazado','enviado'));

-- contabilidad: actualiza cualquier gasto EXCEPTO los pagados.
drop policy if exists expenses_update_contab on public.expenses;
create policy expenses_update_contab on public.expenses for update to authenticated
  using (public.current_app_role() = 'contabilidad' and estado <> 'pagado')
  with check (public.current_app_role() = 'contabilidad');

-- admin: actualiza todo, incluido pagado (el trigger exige motivo).
drop policy if exists expenses_update_admin on public.expenses;
create policy expenses_update_admin on public.expenses for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- DELETE: solo admin (el trigger tombstone exige motivo y deja snapshot).
drop policy if exists expenses_delete_admin on public.expenses;
create policy expenses_delete_admin on public.expenses for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- expense_status_log — lectura por dueño / contabilidad / admin. Inmutable:
-- sin políticas de INSERT/UPDATE/DELETE (solo lo escriben triggers definer).
-- ----------------------------------------------------------------------------
drop policy if exists status_log_select on public.expense_status_log;
create policy status_log_select on public.expense_status_log for select to authenticated
  using (
    public.is_contabilidad_or_admin()
    or exists (select 1 from public.expenses e
               where e.id = expense_status_log.expense_id and e.user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- file_attachments
-- ----------------------------------------------------------------------------
drop policy if exists attachments_select on public.file_attachments;
create policy attachments_select on public.file_attachments for select to authenticated
  using (
    public.is_contabilidad_or_admin()
    or exists (select 1 from public.expenses e
               where e.id = file_attachments.expense_id and e.user_id = auth.uid())
  );

-- Insertar soporte: dueño mientras el gasto sea editable, o contabilidad/admin.
drop policy if exists attachments_insert on public.file_attachments;
create policy attachments_insert on public.file_attachments for insert to authenticated
  with check (
    public.is_contabilidad_or_admin()
    or exists (select 1 from public.expenses e
               where e.id = file_attachments.expense_id
                 and e.user_id = auth.uid()
                 and e.estado in ('borrador','rechazado','enviado'))
  );

-- Borrar soporte: dueño solo en borrador (corrección pre-envío), o admin.
drop policy if exists attachments_delete on public.file_attachments;
create policy attachments_delete on public.file_attachments for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.expenses e
               where e.id = file_attachments.expense_id
                 and e.user_id = auth.uid()
                 and e.estado = 'borrador')
  );

-- ----------------------------------------------------------------------------
-- reimbursement_closures
-- ----------------------------------------------------------------------------
drop policy if exists closures_select on public.reimbursement_closures;
create policy closures_select on public.reimbursement_closures for select to authenticated
  using (user_id = auth.uid() or public.is_contabilidad_or_admin());

drop policy if exists closures_insert on public.reimbursement_closures;
create policy closures_insert on public.reimbursement_closures for insert to authenticated
  with check (public.is_contabilidad_or_admin());

-- Editar cierre (reabrir) solo admin; el trigger/RPC deja rastro.
drop policy if exists closures_update_admin on public.reimbursement_closures;
create policy closures_update_admin on public.reimbursement_closures for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists closures_delete_admin on public.reimbursement_closures;
create policy closures_delete_admin on public.reimbursement_closures for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- siigo_pushes — contabilidad/admin gestionan; nadie más ve internals.
-- ----------------------------------------------------------------------------
drop policy if exists siigo_select on public.siigo_pushes;
create policy siigo_select on public.siigo_pushes for select to authenticated
  using (public.is_contabilidad_or_admin());

drop policy if exists siigo_insert on public.siigo_pushes;
create policy siigo_insert on public.siigo_pushes for insert to authenticated
  with check (public.is_contabilidad_or_admin());

drop policy if exists siigo_update on public.siigo_pushes;
create policy siigo_update on public.siigo_pushes for update to authenticated
  using (public.is_contabilidad_or_admin()) with check (public.is_contabilidad_or_admin());

drop policy if exists siigo_delete on public.siigo_pushes;
create policy siigo_delete on public.siigo_pushes for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- audit_log — lectura contabilidad/admin. Inmutable (solo triggers definer).
-- ----------------------------------------------------------------------------
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (public.is_contabilidad_or_admin());
