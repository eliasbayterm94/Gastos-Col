# Forest Gastos

Plataforma de seguimiento de gastos y reconciliación de anticipos para el equipo
de operaciones de origen de Forest Coffee SAS. Captura de soportes desde el
celular, revisión y cierre por contabilidad, y push de documentos soporte a
Siigo Nube.

> Estado: **MVP completo** (Fases 0–6). PWA operario + portales de contabilidad y
> administración, con lógica de dominio y permisos aplicados en la base de datos.

## Decisiones de arquitectura (Fase 0)

| Área | Decisión |
|---|---|
| Stack | Vite + React PWA (mobile-first) · Supabase (DB + Storage + Auth) · Netlify Functions · Forest Design System (sin Tailwind) |
| Auth | Supabase Auth — email + contraseña, usuarios provisionados por admin |
| Extracción IA | Híbrido: entrada manual ahora, pre-llenado con Claude Vision después (detrás de flag) |
| Siigo | Push por gasto. Sin adjuntar archivo por API — Supabase Storage es la fuente de verdad. Clasificación contable diferida |
| Roles | `usuario` · `contabilidad` · `admin`, aplicados por **RLS** a nivel de base de datos |

## Documentación

| Doc | Contenido |
|---|---|
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Esquema, máquina de estados, matriz de permisos |
| [`docs/BACKEND.md`](docs/BACKEND.md) | RPCs de dominio y Netlify Functions |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Runbook de despliegue + variables de entorno |
| [`docs/guia-operario.md`](docs/guia-operario.md) | Guía de una página — operario |
| [`docs/guia-contabilidad.md`](docs/guia-contabilidad.md) | Guía de una página — contabilidad |
| [`docs/guia-admin.md`](docs/guia-admin.md) | Guía de una página — administrador |

## Estructura

```
supabase/migrations/   0001..0007  esquema, triggers, RLS, storage, RPCs
supabase/seed.sql                  tipos, categorías, ubicaciones, admin
netlify/functions/                 siigo-push, notify-*, admin-create-user, extract-receipt
netlify/functions/_lib/            helpers supabase / siigo / email
src/
  lib/        supabaseClient, AuthContext, api, contab, admin, money, image, format
  components/ layout, sidebar, charts, ui (badges, toast, sheet), icons
  pages/      Login · operario/* · contab/* · admin/*
  styles/     forest-design-system.css + fonts (self-hosted) + components.css
vite.config.js · netlify.toml · .env.example
```

## Desarrollo local

```bash
npm install
cp .env.example .env          # completa VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                   # frontend
npm test                      # pruebas de dinero (node --test, sin dependencias)
npm run build                 # build de producción (dist/)
```

Para aplicar el esquema y desplegar, ver [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Convenciones

- Montos en COP como **enteros** (`BIGINT`). Nunca floats en rutas de dinero.
- Fechas en **America/Bogota** (validado en triggers).
- Identificadores de código/tablas/variables en **inglés**; etiquetas de UI en **español**.
- La **RLS es la fuente de verdad** de permisos; la UI solo oculta lo ya prohibido.
