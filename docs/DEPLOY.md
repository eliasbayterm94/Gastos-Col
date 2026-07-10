# Forest Gastos — Guía de despliegue

Stack: **Supabase** (DB + Storage + Auth) · **Netlify** (frontend PWA + Functions).
GitHub → Netlify auto-deploy. Todo el dinero en enteros COP; fechas en America/Bogota.

---

## 1. Seguridad de extremo a extremo (cómo se aplican los permisos)

Los permisos se validan en **tres capas**, y la base de datos es la fuente de verdad:

1. **RLS en Postgres** (migración `0004`) — decide qué fila puede ver/editar/borrar cada
   rol. Es imposible saltársela desde el cliente.
2. **RPCs + triggers** (`0003`, `0006`, `0007`) — la máquina de estados, la inmutabilidad
   de `pagado`, los cierres atómicos y las bitácoras. El motivo viaja por GUC transaccional.
3. **UI** — solo oculta lo que las capas anteriores ya prohíben. Nunca es la única barrera.

| Rol | Puede | No puede |
|---|---|---|
| `usuario` | Crear/editar sus gastos en borrador/rechazado; ver sus anticipos/cierres | Ver gastos ajenos; borrar nada |
| `contabilidad` | Ver todo; revisar/aprobar/rechazar; anticipos; cierres; push Siigo | Borrar; editar gastos `pagado` |
| `admin` | Todo, incl. editar/borrar `pagado` (con motivo, siempre logueado) | — |

---

## 2. Supabase

### 2.1 Crear proyecto
1. Crea un proyecto en supabase.com. Guarda **Project URL**, **anon key** y **service_role key**
   (Settings → API).

### 2.2 Aplicar el esquema
Con la [Supabase CLI](https://supabase.com/docs/guides/cli) (recomendado):
```bash
supabase link --project-ref <ref>
supabase db push                 # aplica migrations/0001..0007 en orden
psql "$DATABASE_URL" -f supabase/seed.sql
```
O desde el **SQL Editor** del panel: pega y ejecuta en orden
`0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007`, y por último `seed.sql`.

> El SQL Editor corre como `postgres`, así que el trigger sobre `auth.users`
> (`handle_new_user`) y el bucket de Storage se crean sin problema.

### 2.3 Verificar Storage
La migración `0005` crea el bucket privado **`soportes`**. Confírmalo en Storage. Si tu
proyecto restringe DDL sobre `storage`, créalo manual: bucket `soportes`, **privado**,
límite 10 MB, tipos `image/*, application/pdf`.

### 2.4 Auth
- Authentication → Providers → **Email**: habilitado.
- **Desactiva el registro público** (Authentication → Sign In / Providers → "Allow new users
  to sign up" = OFF). Los usuarios los provisiona el admin.
- Session length: larga (ej. 4 semanas) para sobrevivir viajes de campo.

### 2.5 Bootstrap del primer admin
1. Authentication → **Add user** → crea `elias@forestcol.com` con contraseña.
   (El trigger crea el perfil con rol `usuario`.)
2. Ejecuta de nuevo `seed.sql` (o solo su `UPDATE` final) para promoverlo a `admin`.
3. A partir de ahí, la gestión de usuarios se hace desde la app (Admin → Usuarios).

---

## 3. Netlify

1. **New site from Git** → conecta este repositorio.
2. Build: se toma de `netlify.toml` (`npm run build`, publish `dist`, functions
   `netlify/functions`). No hay que configurar nada más.
3. **Environment variables** (Site settings → Environment): ver §4.
4. La función programada `weekly-summary` (resumen a contabilidad, lunes 8:00 Bogotá)
   se activa sola por el `schedule` de `netlify.toml`.

---

## 4. Variables de entorno

> Copia `.env.example`. **Mantén `*_DRY_RUN=true` y `EXTRACTION_ENABLED=false`** hasta
> validar en staging. La `service_role key` NUNCA va al cliente (sin prefijo `VITE_`).

**Frontend (build):**
| Var | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon key |

**Functions (runtime):**
| Var | Notas |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role — solo backend |
| `SIIGO_DRY_RUN` | `true` por defecto (simula) |
| `SIIGO_BASE_URL` | `https://api.siigo.com` |
| `SIIGO_PARTNER_ID` | ej. `ForestGastos` |
| `SIIGO_USERNAME` / `SIIGO_ACCESS_KEY` | credencial API (§5) |
| `SIIGO_DOCUMENT_TYPE_ID` / `SIIGO_COST_CENTER` | ⚠️ diferido: clasificación contable |
| `EMAIL_DRY_RUN` | `true` por defecto |
| `GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN/SENDER` | notificaciones (§6) |
| `EXTRACTION_ENABLED` | `false` por defecto |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | extracción IA (diferida) |

---

## 5. Siigo (cuando se active)

1. En Siigo Nube: **Alianzas → Mi Credencial API** → genera el `access_key`. Usuario =
   correo de la credencial.
2. Define un `Partner-Id` (3–100 alfanumérico), ej. `ForestGastos`.
3. ⚠️ **La clasificación contable** (tipo de comprobante DS, centro de costo, cuentas,
   retenciones) la confirma el contador. Hasta tener `SIIGO_DOCUMENT_TYPE_ID` y
   `SIIGO_COST_CENTER`, el push real está bloqueado (501); `DRY_RUN` simula y registra
   el payload en `siigo_pushes`.
4. ⚠️ **Siigo API no adjunta el archivo** del soporte. Supabase Storage es la fuente de
   verdad; el `id` del gasto viaja en `observations`. Si el contador necesita el archivo
   físico en Siigo, se adjunta manualmente en su UI.
5. Para activar el envío real: pon `SIIGO_DRY_RUN=false` con las credenciales cargadas.

---

## 6. Gmail (notificaciones, opcional)

Con `EMAIL_DRY_RUN=true` los correos solo se registran. Para enviarlos de verdad:
1. Crea credenciales OAuth2 (Google Cloud) con scope `gmail.send`.
2. Obtén un `refresh_token` para la cuenta remitente (`GMAIL_SENDER`).
3. Carga `GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN/SENDER` y pon `EMAIL_DRY_RUN=false`.

Correos: rechazo → operario; cierre → operario; resumen semanal → contabilidad.

---

## 7. Checklist de validación en staging

- [ ] Login como admin; crear un operario y un contador (Admin → Usuarios).
- [ ] Operario: subir un gasto con foto en < 30 s; ver estado `enviado`.
- [ ] Contabilidad: revisar (soporte a la par), aprobar; rechazar con motivo → llega al operario.
- [ ] Contabilidad: crear anticipo; crear cierre combinado; verificar saldo y dirección.
- [ ] Siigo (DRY_RUN): "Enviar" registra el payload; estado "Simulado".
- [ ] Admin: editar/eliminar un gasto pagado con motivo → aparece en Auditoría.
- [ ] Verificar que un operario NO ve gastos de otro (RLS).

> Solo tras validar: desactiva los `DRY_RUN` y activa credenciales reales.
