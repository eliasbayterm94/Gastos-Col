# Guía de Contabilidad — Forest Gastos

Pensada para computador. Revisa gastos, gestiona anticipos, cierra reembolsos y
envía documentos soporte a Siigo. **No puedes** eliminar registros ni editar gastos
ya pagados (eso es exclusivo del administrador).

## Panel
Vista rápida: pendientes de revisión, total de anticipos activos, aprobado sin cerrar,
y fallos de Siigo. Toca cada tarjeta para ir al módulo.

## Revisar gastos
1. Entra a **Revisión**. Los gastos aparecen del más antiguo al más nuevo.
2. Abre uno: verás el **soporte a la par de los datos**.
3. **Aprobar**, o **Rechazar / Solicitar corrección** (el **motivo es obligatorio** y le
   llega al operario para que corrija y reenvíe).
4. **Aprobación masiva**: ajusta el umbral (ej. $50.000) y aprueba de un golpe todos los
   gastos por debajo de ese monto.

> "Soporte pendiente" = el gasto llegó sin foto. Pídesela al operario antes de aprobar.

## Anticipos
1. En **Anticipos**, **Nuevo anticipo**: elige operario, monto, fecha y método.
2. La tabla muestra el **saldo vivo** y la **antigüedad** de cada anticipo sin liquidar.

## Cierres (liquidar / reembolsar)
1. En **Cierres**, elige el **operario**.
2. Marca los **gastos aprobados** a incluir. Opcional: elige un **anticipo** a liquidar.
3. El resumen calcula **total, anticipo aplicado y saldo**:
   - Saldo a favor del operario → Forest le reembolsa la diferencia.
   - Saldo a favor de Forest → el operario devuelve el remanente.
   - Un mismo cierre puede liquidar un anticipo y pagar gastos sin anticipo.
4. **Cerrar**: los gastos pasan a *pagado*, el anticipo a *liquidado*, y el operario
   recibe la notificación. Los cierres se hacen cuando quieras, sin calendario fijo.

## Enviar a Siigo
1. En **Siigo** ves los gastos aprobados/pagados y su estado de envío.
2. **Enviar** crea un documento soporte por gasto. Con **DRY_RUN** activo se simula.
3. Si falla, el botón cambia a **Reintentar**. Al enviarse, se guarda el # de documento Siigo.

> La clasificación contable (retenciones, cuentas) y el adjunto del archivo se manejan
> en una fase posterior / manualmente en Siigo. El soporte siempre queda guardado en la app.
