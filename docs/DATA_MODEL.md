# Forest Gastos — Modelo de datos (Fase 1)

Fuente de verdad de permisos: **RLS a nivel de base de datos**. La UI oculta lo
que la API/DB ya prohíben; nunca al revés.

## Tablas

| Tabla | Propósito |
|---|---|
| `users` | Perfil de aplicación 1:1 con `auth.users`. `rol` ∈ (admin, contabilidad, usuario), `active`. |
| `expense_types` | Nivel superior (Viaje, Compra de café, Trilladora, …). Administrable. |
| `expense_categories` | Detalle bajo cada tipo (transporte, alimentación, …). `unique(type_id, nombre)`. |
| `locations` | Sitios administrables; `is_milling` marca trilladoras. Opcional en el gasto. |
| `anticipos` | Adelanto a un operario: `monto` (BIGINT COP), `fecha`, `metodo_entrega`, `estado`. |
| `expenses` | Gasto. `id` = clave de idempotencia para Siigo. `anticipo_id` null ⇒ reembolso directo. |
| `expense_status_log` | Bitácora **inmutable** de cada cambio de estado (quién, cuándo, de→a, motivo). |
| `file_attachments` | Soportes en Storage; varios por gasto. |
| `reimbursement_closures` | Cierre/liquidación; puede combinar liquidación de anticipo + gastos sin anticipo. |
| `siigo_pushes` | Log de cada push a Siigo; idempotente por gasto; guarda payload/response. |
| `audit_log` | Bitácora general inmutable: borrados (tombstone), overrides de pagados, reaperturas. |

Vista `anticipo_balances`: saldo vivo = `monto − Σ gastos vinculados (aprobado|pagado)`.
`security_invoker = true` ⇒ respeta la RLS del solicitante.

## Máquina de estados del gasto

```
borrador → enviado → en_revision → aprobado → pagado
                          │
                          └──→ rechazado ──(corrección)──→ enviado
```

- Transiciones válidas fijadas en `is_valid_expense_transition()` y forzadas por
  el trigger `expenses_before_update_guard` (BEFORE UPDATE). **No hay saltos de estado.**
- `rechazado` exige `motivo_rechazo`.
- `pagado` es inmutable salvo para **admin**, que debe pasar motivo
  (`app.change_comment`) y queda registrado en `audit_log` (`override_pagado`).
- Cada cambio se registra en `expense_status_log` (trigger `expenses_log_status`).
- El paso `aprobado → pagado` lo produce el motor de cierre (Fase 2).

### Cómo pasar el motivo (API)

```sql
select set_config('app.change_comment', 'texto del motivo', true);
update public.expenses set estado = 'rechazado', motivo_rechazo = '...' where id = $1;
```

El GUC es transaccional (`is_local = true`); lo leen los triggers vía
`current_setting('app.change_comment', true)`.

## Reconciliación de anticipos

- Saldo vivo: `anticipo.monto − Σ gastos vinculados aprobados/pagados`.
- Al cierre: `saldo = total_gastos − anticipo_aplicado` (con signo).
  - `saldo > 0` → **a_favor_operario** (Forest debe reembolsar la diferencia).
  - `saldo < 0` → **a_favor_forest** (el operario devuelve el remanente).
  - `saldo = 0` → **neutro**.
- La dirección la deriva el trigger `closures_set_direction`. Todo en enteros COP,
  reconciliable al peso.

## Matriz de permisos (RLS)

| Acción | usuario | contabilidad | admin |
|---|:--:|:--:|:--:|
| SELECT gastos propios | ✅ | ✅ (todos) | ✅ (todos) |
| SELECT gastos de otros | ❌ | ✅ | ✅ |
| INSERT gasto propio | ✅ | ❌¹ | ✅ |
| UPDATE gasto propio en borrador/rechazado | ✅ | — | ✅ |
| UPDATE gasto (flujo de revisión) | ❌ | ✅ (excepto pagado) | ✅ |
| UPDATE gasto **pagado** | ❌ | ❌ | ✅ (motivo + log) |
| DELETE cualquier registro | ❌ | ❌ | ✅ (tombstone + motivo) |
| Crear anticipos | ❌ | ✅ | ✅ |
| Crear cierres | ❌ | ✅ | ✅ |
| Reabrir cierres | ❌ | ❌ | ✅ (log) |
| Push a Siigo | ❌ | ✅ | ✅ |
| Gestión de usuarios/categorías/ubicaciones | ❌ | ❌ | ✅ |
| Ver `audit_log` | ❌ | ✅ | ✅ |

¹ Los gastos los crean los operarios; contabilidad no los inserta (sí admin).

### Reglas críticas verificadas por diseño

- **contabilidad no puede eliminar nada** → sin política DELETE para ese rol en
  ninguna tabla; DELETE solo con `is_admin()`.
- **contabilidad no puede editar pagados** → `expenses_update_contab` incluye
  `estado <> 'pagado'`, reforzado por el trigger BEFORE UPDATE.
- **usuario no ve gastos ajenos** → `expenses_select` filtra por `user_id = auth.uid()`.
- **Bitácoras inmutables** → `expense_status_log` y `audit_log` no tienen políticas
  de UPDATE/DELETE; solo los escriben funciones `SECURITY DEFINER`.

## Storage

Bucket privado `soportes`, rutas `soportes/{expense_id}/{uuid}.{ext}`. Políticas
en `storage.objects`: lectura/escritura por dueño del gasto o contabilidad/admin;
borrado físico solo admin. Acceso a archivos vía signed URLs desde el backend.

## Pendientes de fases siguientes

- **Fase 2**: RPC atómico de cierre (`create_closure`), endpoints CRUD, push Siigo
  con `DRY_RUN`, extracción Claude Vision, correos Gmail.
- **Clasificación contable Siigo** (compra/gasto, retenciones, cuentas): la define
  contabilidad al momento del push; se modelará entonces (no en Fase 1).
- **Tests de permisos por rol** (Fase 2): un operario no ve gastos ajenos,
  contabilidad no borra, contabilidad no edita pagados, etc.
