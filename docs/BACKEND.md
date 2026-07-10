# Forest Gastos — Backend (Fase 2)

Dos capas: **RPCs en Postgres** (lógica de dominio, atómica, gobernada por RLS)
y **Netlify Functions** (solo lo que necesita secretos externos).

## RPCs (migración 0006) — `SECURITY INVOKER`, RLS + triggers son la verdad

| RPC | Quién | Qué hace |
|---|---|---|
| `set_expense_status(expense_id, new_status, comment)` | según RLS | Cambia estado pasando el motivo en la misma transacción. Los triggers validan la transición y escriben la bitácora. |
| `create_closure(user_id, expense_ids[], anticipo_id?, metodo_pago?, obs?)` | contabilidad/admin | Cierre atómico: valida gastos aprobados del operario, crea el cierre, mueve gastos a `pagado`, liquida el anticipo. Todo o nada. |
| `reopen_closure(closure_id, motivo)` | admin | Revierte un cierre (gastos → aprobado, anticipo → activo) y lo registra en `audit_log`. |

> El motivo viaja por GUC transaccional (`app.change_comment`), que los RPCs
> fijan con `set_config(..., true)` antes del `UPDATE`. Verificado contra una
> base Postgres real (lifecycle, cierre combinado, reapertura, negativos).

## Netlify Functions (`netlify/functions/`)

| Endpoint | Método | Rol | Propósito |
|---|---|---|---|
| `siigo-push` | POST | contabilidad/admin | Push idempotente de documento soporte por gasto. `DRY_RUN` por defecto; registra cada intento en `siigo_pushes`. |
| `notify-rejection` | POST | contabilidad/admin | Correo al operario con el motivo del rechazo. |
| `notify-closure` | POST | contabilidad/admin | Correo al operario con el resultado del cierre. |
| `weekly-summary` | scheduled | sistema | Resumen semanal de pendientes a contabilidad (lunes 8:00 Bogotá). |
| `admin-create-user` | POST | admin | Crea usuario en Auth + fija rol/nombre. |
| `extract-receipt` | POST | autenticado | Claude Vision → sugerencias con confianza. **`EXTRACTION_ENABLED=false` por defecto** (híbrido Fase 0). |

Helpers en `_lib/`: `supabase.js` (clientes user/service + `requireUser` con
resolución de rol), `siigo.js` (auth + terceros + documento soporte), `email.js`
(Gmail API + plantillas en español).

### Cliente user vs service
- **user client**: actúa como el usuario (RLS aplica). Default para CRUD.
- **service client**: bypassa RLS (`service_role`). Solo para tareas del sistema
  (crear usuarios Auth, escribir `siigo_pushes`, fijar `siigo_document_id` en un
  gasto ya `pagado`). Siempre se revisa el rol del caller primero con `requireUser`.

## Qué NO pasa por funciones
- **CRUD de gastos/anticipos** y **subida de archivos**: el cliente habla directo
  con Supabase (PostgREST + Storage); la RLS de Fase 1 gobierna todo.
- **Cálculos de dinero**: `src/lib/money.js` (enteros COP, sin floats, sin LLM),
  con pruebas (`npm test`, corre con `node --test`, cero dependencias).

## Banderas de seguridad / honestidad
- `SIIGO_DRY_RUN=true` y `EMAIL_DRY_RUN=true` por defecto: nada se envía afuera
  hasta configurarlo explícitamente.
- ⚠️ El **payload contable** del documento soporte (tipo de comprobante, centro
  de costo, cuentas, retenciones, pagos) lo confirma el contador; el push real se
  bloquea (501) hasta que existan `SIIGO_DOCUMENT_TYPE_ID` y `SIIGO_COST_CENTER`.
- ⚠️ Siigo API **no adjunta el archivo** del soporte (Fase 0): Supabase Storage
  es la fuente de verdad; el `id` del gasto viaja en `observations`.
