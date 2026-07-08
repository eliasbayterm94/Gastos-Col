-- =============================================================================
-- Forest Gastos — Seed data
-- =============================================================================
-- Idempotente: usa ON CONFLICT. Ejecutar tras las migraciones 0001–0005.
-- Los tipos/categorías/ubicaciones son ejemplos editables por el admin.
-- =============================================================================

-- ------------------------- Tipos de gasto (nivel superior) -------------------
insert into public.expense_types (nombre, descripcion, sort_order) values
  ('Viaje / Comisión',   'Gastos de desplazamiento a origen',            10),
  ('Compra de café',     'Compra de café cereza, seco o pergamino',      20),
  ('Trilladora',         'Gastos operativos de la trilladora',           30),
  ('Análisis de calidad','Muestras, laboratorio y catación',             40),
  ('Otros',              'Gastos varios no clasificados',                90)
on conflict (nombre) do nothing;

-- ------------------------- Categorías (detalle por tipo) ---------------------
insert into public.expense_categories (type_id, nombre, sort_order)
select t.id, c.nombre, c.sort_order
from (values
  ('Viaje / Comisión',   'Transporte',              10),
  ('Viaje / Comisión',   'Alimentación',            20),
  ('Viaje / Comisión',   'Hospedaje',               30),
  ('Viaje / Comisión',   'Combustible',             40),
  ('Viaje / Comisión',   'Peajes',                  50),
  ('Compra de café',     'Café cereza',             10),
  ('Compra de café',     'Café seco / pergamino',   20),
  ('Compra de café',     'Fletes de café',          30),
  ('Trilladora',         'Insumos',                 10),
  ('Trilladora',         'Mantenimiento',           20),
  ('Trilladora',         'Servicios públicos',      30),
  ('Trilladora',         'Mano de obra',            40),
  ('Análisis de calidad','Muestras',                10),
  ('Análisis de calidad','Laboratorio',             20),
  ('Análisis de calidad','Envío de muestras',       30),
  ('Otros',              'Papelería',               10),
  ('Otros',              'Otros gastos',            90)
) as c(tipo, nombre, sort_order)
join public.expense_types t on t.nombre = c.tipo
on conflict (type_id, nombre) do nothing;

-- ------------------------- Ubicaciones (ejemplos) ----------------------------
insert into public.locations (nombre, is_milling, descripcion) values
  ('Oficina Bogotá',      false, 'Sede administrativa'),
  ('Huila',               false, 'Región de origen'),
  ('Nariño',              false, 'Región de origen'),
  ('Tolima',              false, 'Región de origen'),
  ('Trilladora Principal',true,  'Trilladora (dry mill)')
on conflict (nombre) do nothing;

-- ------------------------- Bootstrap del primer admin ------------------------
-- El perfil se crea automáticamente al registrarse el usuario en Supabase Auth
-- (trigger handle_new_user). Este UPDATE lo promueve a admin cuando ya exista.
update public.users
   set rol = 'admin', nombre = coalesce(nullif(nombre, ''), 'Elias'), active = true
 where email = 'elias@forestcol.com';
