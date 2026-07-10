# Guía del Administrador — Forest Gastos

Tienes visibilidad global y las únicas herramientas para tocar registros cerrados.
Cada acción sensible exige **motivo** y queda en la **auditoría**.

## Panel global
Gasto total y desgloses por **estado, mes, categoría y operario** (gráficas simples).

## Usuarios
- **Nuevo usuario**: nombre, correo y rol (Operario / Contabilidad / Administrador).
  Se le envía una invitación por correo para fijar su contraseña.
- Cambia el **rol** desde la lista, o **desactiva/activa** una cuenta. Los usuarios no se
  eliminan: se desactivan (conserva su historial).

## Catálogos
CRUD de **Tipos**, **Categorías** (cada una bajo un tipo) y **Ubicaciones**
(marca las que son trilladora). Desactiva lo que ya no se use en vez de borrarlo.

## Overrides (uso excepcional)
- **Gastos pagados**: editar (monto/descripción) o eliminar. La edición queda logueada
  como *override*; la eliminación deja un *tombstone* con todo el historial.
- **Cierres**: **reabrir** un cierre — los gastos vuelven a *aprobado* y el anticipo a
  *activo*. Útil para corregir un error de digitación.
- En todos los casos el **motivo es obligatorio**.

## Auditoría
Registro de todas las acciones sensibles (eliminaciones, ediciones de pagado,
reaperturas). Filtra por **acción** y **rango de fechas**; muestra quién, cuándo y por qué.

## Notas
- Los montos son enteros en pesos; las fechas usan la zona horaria de Colombia.
- Puedes navegar también a los módulos de contabilidad y operario (tu rol abarca todo).
