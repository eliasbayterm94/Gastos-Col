-- =============================================================================
-- Forest Gastos — 0005 · Storage bucket for soportes (fotos/escaneados)
-- =============================================================================
-- Convención de rutas: soportes/{expense_id}/{uuid}.{ext}
-- El primer segmento del path es el expense_id, usado para resolver el dueño.
-- Bucket privado; el acceso a archivos se hace vía signed URLs desde el backend.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'soportes', 'soportes', false,
  10485760,  -- 10 MB tope duro; el cliente comprime imágenes antes de subir
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: ¿el usuario autenticado es dueño del gasto dueño de este objeto?
create or replace function public.owns_soporte_object(object_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.expenses e
    where e.id = (split_part(object_name, '/', 1))::uuid
      and e.user_id = auth.uid()
  );
$$;

-- SELECT: dueño del gasto o contabilidad/admin.
drop policy if exists soportes_select on storage.objects;
create policy soportes_select on storage.objects for select to authenticated
  using (
    bucket_id = 'soportes'
    and (public.is_contabilidad_or_admin() or public.owns_soporte_object(name))
  );

-- INSERT: dueño del gasto o contabilidad/admin.
drop policy if exists soportes_insert on storage.objects;
create policy soportes_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'soportes'
    and (public.is_contabilidad_or_admin() or public.owns_soporte_object(name))
  );

-- DELETE: solo admin (los soportes son evidencia; el operario reemplaza vía app
-- en borrador, pero el borrado físico queda restringido a admin).
drop policy if exists soportes_delete on storage.objects;
create policy soportes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'soportes' and public.is_admin());
