// POST /.netlify/functions/admin-create-user { email, nombre, rol, password? }
// Solo admin. Crea el usuario en Supabase Auth (service role) y fija su perfil
// (nombre, rol). Si no se da password, se envía invitación por correo.
import { handler, requireUser, serviceClient, json, httpError } from './_lib/supabase.js';

const VALID_ROLES = ['usuario', 'contabilidad', 'admin'];

export const handlerFn = handler(async (event) => {
  if (event.httpMethod !== 'POST') throw httpError(405, 'Método no permitido');
  await requireUser(event, ['admin']);

  const { email, nombre, rol = 'usuario', password, area_id } = JSON.parse(event.body || '{}');
  if (!email || !nombre) throw httpError(400, 'Faltan email y nombre');
  if (!VALID_ROLES.includes(rol)) throw httpError(400, 'Rol inválido');

  const svc = serviceClient();

  // Crear en Auth. Con password => activo de inmediato; sin password => invitación.
  let authUser;
  if (password) {
    const { data, error } = await svc.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nombre },
    });
    if (error) throw httpError(400, `No se pudo crear el usuario: ${error.message}`);
    authUser = data.user;
  } else {
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
      data: { nombre },
    });
    if (error) throw httpError(400, `No se pudo invitar: ${error.message}`);
    authUser = data.user;
  }

  // El trigger handle_new_user ya creó el perfil con rol 'usuario'; fijamos rol/nombre/área.
  const patch = { nombre, rol, active: true };
  if (area_id) patch.area_id = area_id;
  const { error: upErr } = await svc.from('users').update(patch).eq('id', authUser.id);
  if (upErr) throw httpError(500, `Perfil no actualizado: ${upErr.message}`);

  return json(200, { id: authUser.id, email, nombre, rol, invited: !password });
});

export { handlerFn as handler };
