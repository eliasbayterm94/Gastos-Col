-- =============================================================================
-- Forest Gastos — Seed data (catálogos + bootstrap admin)
-- =============================================================================
-- Idempotente. Ejecutar tras las migraciones 0001–0008.
-- Modelo orthogonal: TIPO (motivo del gasto) y CATEGORÍA (naturaleza) son
-- listas independientes. ÁREA va en el usuario; REGIÓN de cliente en el gasto.
-- Estrategia: se desactiva todo y se reactiva/inserta la lista vigente, de modo
-- que re-ejecutarlo deja el catálogo exactamente como aquí definido.
-- =============================================================================

-- ── Áreas (perfil del usuario) ───────────────────────────────────────────────
insert into public.areas (nombre, sort_order) values
  ('Operaciones', 10), ('Ventas', 20), ('Mercadeo', 30), ('Administrativo', 40),
  ('Contabilidad', 50), ('Logística', 60), ('Finca', 70)
on conflict (nombre) do update set active = true, sort_order = excluded.sort_order;

-- ── Regiones de cliente (gasto, opcional) ────────────────────────────────────
insert into public.client_regions (nombre, sort_order) values
  ('North America', 10), ('Europe', 20), ('UK', 30),
  ('Middle East', 40), ('Australia', 50), ('Otros', 90)
on conflict (nombre) do update set active = true, sort_order = excluded.sort_order;

-- ── Tipos de gasto = MOTIVO del viaje/gasto ──────────────────────────────────
update public.expense_types set active = false;
insert into public.expense_types (nombre, descripcion, sort_order, is_client) values
  ('Compra de café',              'Viajes para comprar café',            10, false),
  ('Visita a proveedores',        'Conocer y visitar proveedores',       20, false),
  ('Control de calidad',          'Aprobación y análisis de cafés',      30, false),
  ('Capacitación',                'Formación del equipo',                40, false),
  ('Evento de café',              'Eventos de café en origen',           50, false),
  ('Visita / evento con cliente', 'Visitas y eventos con clientes',      60, true),
  ('Gasto operativo',             'Gastos operativos / administrativos', 70, false),
  ('Otro',                        'Otros motivos',                       90, false)
on conflict (nombre) do update
  set active = true, descripcion = excluded.descripcion,
      sort_order = excluded.sort_order, is_client = excluded.is_client;

-- ── Categorías = NATURALEZA del gasto (independiente del tipo) ────────────────
update public.expense_categories set active = false;
insert into public.expense_categories (nombre, type_id, sort_order, active) values
  ('Tiquetes aéreos',            null, 10,  true),
  ('Transporte terrestre',       null, 20,  true),
  ('Combustible',                null, 30,  true),
  ('Peajes',                     null, 40,  true),
  ('Alimentación',               null, 50,  true),
  ('Hospedaje',                  null, 60,  true),
  ('Compra de café (producto)',  null, 70,  true),
  ('Material de mercadeo',       null, 80,  true),
  ('Muestras y envíos',          null, 90,  true),
  ('Inscripciones / entradas',   null, 100, true),
  ('Papelería / varios',         null, 110, true),
  ('Gasto Braseros',             null, 120, true),
  ('Flete Empaque',              null, 130, true),
  ('Descargue Café Finca',       null, 140, true),
  ('Plantilla Sacos',            null, 150, true),
  ('Otros',                      null, 900, true)
on conflict (nombre) do update
  set active = true, type_id = null, sort_order = excluded.sort_order;

-- ── Ubicaciones (ejemplos; el admin las ajusta) ──────────────────────────────
insert into public.locations (nombre, is_milling, descripcion) values
  ('Oficina Bogotá',       false, 'Sede administrativa'),
  ('Huila',                false, 'Región de origen'),
  ('Nariño',               false, 'Región de origen'),
  ('Tolima',               false, 'Región de origen'),
  ('Trilladora Principal', true,  'Trilladora (dry mill)')
on conflict (nombre) do nothing;

-- ── Bootstrap del primer admin ───────────────────────────────────────────────
update public.users
   set rol = 'admin', nombre = coalesce(nullif(nombre, ''), 'Elias'), active = true
 where email = 'elias@forestcol.com';
