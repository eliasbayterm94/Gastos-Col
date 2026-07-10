# Forest Gastos

Plataforma de seguimiento de gastos y reconciliación de anticipos para el equipo
de operaciones de origen de Forest Coffee SAS. Captura de soportes desde el
celular, revisión y cierre por contabilidad, y push de documentos soporte a
Siigo Nube.

> Estado actual: **Fase 2 — Backend** (RPCs de dominio + Netlify Functions).
> El frontend (React PWA) llega en las fases 3–5.

## Decisiones de arquitectura (Fase 0, aprobadas)

| Área | Decisión |
|---|---|
| Stack | Vite + React PWA (mobile-first) · Supabase (DB + Storage) · Netlify Functions · Tailwind mapeado a `forest-tokens.css` |
| Auth | Supabase Auth — email + contraseña, usuarios provisionados por admin |
| Extracción IA | Híbrido: entrada manual ahora, pre-llenado con Claude Vision después |
| Siigo | Push por gasto (un documento soporte por gasto). Sin adjuntar archivo por API — Supabase Storage es la fuente de verdad del soporte. Clasificación contable (compra/gasto, retenciones) la define contabilidad al hacer push, en una fase posterior |
| Roles | `usuario` · `contabilidad` · `admin`, aplicados por RLS a nivel de base de datos |

Ver [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) para el detalle del esquema, la
máquina de estados y la matriz de permisos.

## Estructura

```
supabase/
  migrations/
    0001_extensions_enums_helpers.sql   Extensiones, enums, funciones de rol
    0002_core_tables.sql                Tablas
    0003_functions_triggers.sql         Máquina de estados, bitácoras, integridad
    0004_rls_policies.sql               Row Level Security por rol
    0005_storage.sql                    Bucket 'soportes' y sus políticas
  seed.sql                              Tipos, categorías, ubicaciones, admin
docs/
  DATA_MODEL.md                         Documentación del modelo de datos
src/styles/                             (Fase 3) tokens de diseño Forest
```

## Aplicar el esquema

Con la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase db reset                        # aplica migrations + seed en local
# o contra un proyecto remoto:
supabase link --project-ref <ref>
supabase db push                         # aplica migrations
psql "$DATABASE_URL" -f supabase/seed.sql # carga catálogos y promueve admin
```

> ⚠️ Confirmar antes de correr migraciones contra producción.

### Bootstrap del primer admin

1. El usuario `elias@forestcol.com` se registra (o lo crea el admin) en Supabase
   Auth. El trigger `handle_new_user` crea su perfil con rol `usuario`.
2. `seed.sql` lo promueve a `admin`. A partir de ahí, la gestión de usuarios se
   hace desde la app (Fase 5).

## Convenciones

- Montos en COP como **enteros** (`BIGINT`). Nunca floats en rutas de dinero.
- Fechas en **America/Bogota** (validado en triggers).
- Identificadores de código/tablas/variables en **inglés**; etiquetas de UI en **español**.
