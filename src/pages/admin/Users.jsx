import { useEffect, useState } from 'react';
import { listUsers, createUser, updateUser, listAreas } from '../../lib/admin.js';
import { Spinner, Sheet, useToast } from '../../components/ui.jsx';
import { IcPlus } from '../../components/Icons.jsx';

const ROLES = [['usuario', 'Operario'], ['contabilidad', 'Contabilidad'], ['admin', 'Administrador']];
const selStyle = { minHeight: 38, padding: '6px 30px 6px 10px', width: 'auto' };

export default function Users() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [areas, setAreas] = useState([]);
  const [creating, setCreating] = useState(false);

  const load = () => { setRows(null); listUsers().then(setRows).catch(() => setRows([])); };
  useEffect(() => { load(); listAreas().then(setAreas).catch(() => {}); }, []);

  async function changeRole(u, rol) {
    try { await updateUser(u.id, { rol }); toast.show('Rol actualizado', 'ok'); load(); }
    catch (e) { toast.show(e.message, 'err'); }
  }
  async function changeArea(u, area_id) {
    try { await updateUser(u.id, { area_id: area_id || null }); toast.show('Área actualizada', 'ok'); load(); }
    catch (e) { toast.show(e.message, 'err'); }
  }
  async function toggleActive(u) {
    try { await updateUser(u.id, { active: !u.active }); toast.show(u.active ? 'Usuario desactivado' : 'Usuario activado', 'ok'); load(); }
    catch (e) { toast.show(e.message, 'err'); }
  }

  return (
    <div>
      <div className="fc-row-between" style={{ marginBottom: 'var(--fc-space-5)' }}>
        <div><div className="fc-eyebrow">Administrador</div><div className="fc-page-title">Usuarios</div></div>
        <button className="fc-btn fc-btn-primary" onClick={() => setCreating(true)}><IcPlus size={16} /> Nuevo usuario</button>
      </div>

      {rows === null ? <Spinner full /> : (
        <div className="fc-table-wrap">
          <table className="fc-table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Área</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td className="fc-td-mono">{u.email}</td>
                  <td>
                    <select className="fc-select" style={selStyle}
                      value={u.area_id || ''} onChange={(e) => changeArea(u, e.target.value)}>
                      <option value="">— Sin área —</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="fc-select" style={selStyle}
                      value={u.rol} onChange={(e) => changeRole(u, e.target.value)}>
                      {ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td><span className={`fc-badge ${u.active ? 'activo' : 'cerrado'}`}>{u.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <button className="fc-btn fc-btn-ghost" onClick={() => toggleActive(u)}>
                      {u.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <NewUser areas={areas} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); toast.show('Usuario creado', 'ok'); }} />}
    </div>
  );
}

function NewUser({ areas, onClose, onDone }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('usuario');
  const [areaId, setAreaId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !nombre.trim()) return toast.show('Completa nombre y correo', 'err');
    if (password && password.length < 6) return toast.show('La contraseña debe tener al menos 6 caracteres', 'err');
    setBusy(true);
    try {
      const payload = { email: email.trim(), nombre: nombre.trim(), rol };
      if (password) payload.password = password;
      if (areaId) payload.area_id = areaId;
      await createUser(payload);
      onDone();
    } catch (e) { toast.show(e.message, 'err'); setBusy(false); }
  }

  return (
    <Sheet title="Nuevo usuario" onClose={onClose}>
      <div className="fc-field">
        <label className="fc-label">Nombre <span className="req">*</span></label>
        <input className="fc-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className="fc-field">
        <label className="fc-label">Correo <span className="req">*</span></label>
        <input className="fc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="fc-field">
        <label className="fc-label">Rol</label>
        <select className="fc-select" value={rol} onChange={(e) => setRol(e.target.value)}>
          {ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="fc-field">
        <label className="fc-label">Área</label>
        <select className="fc-select" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">— Sin área —</option>
          {(areas || []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </div>
      <div className="fc-field">
        <label className="fc-label">Contraseña</label>
        <input className="fc-input" type="text" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Déjala en blanco para enviar invitación por correo" autoComplete="new-password" />
        <div className="fc-help-text">
          Si pones una contraseña, la cuenta queda lista de inmediato y se la entregas al usuario.
          Si la dejas en blanco, se envía una invitación por correo (requiere SMTP configurado en Supabase).
        </div>
      </div>
      <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" disabled={busy} onClick={submit}>
        {busy ? 'Creando…' : 'Crear usuario'}
      </button>
    </Sheet>
  );
}
