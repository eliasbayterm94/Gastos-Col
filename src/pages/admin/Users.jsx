import { useEffect, useState } from 'react';
import { listUsers, createUser, updateUser } from '../../lib/admin.js';
import { Spinner, Sheet, useToast, StatusBadge } from '../../components/ui.jsx';
import { IcPlus, IcUsers } from '../../components/Icons.jsx';

const ROLES = [['usuario', 'Operario'], ['contabilidad', 'Contabilidad'], ['admin', 'Administrador']];

export default function Users() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => { setRows(null); listUsers().then(setRows).catch(() => setRows([])); };
  useEffect(load, []);

  async function changeRole(u, rol) {
    try { await updateUser(u.id, { rol }); toast.show('Rol actualizado', 'ok'); load(); }
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
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td className="fc-td-mono">{u.email}</td>
                  <td>
                    <select className="fc-select" style={{ minHeight: 38, padding: '6px 30px 6px 10px', width: 'auto' }}
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

      {creating && <NewUser onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); toast.show('Usuario creado', 'ok'); }} />}
    </div>
  );
}

function NewUser({ onClose, onDone }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('usuario');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !nombre.trim()) return toast.show('Completa nombre y correo', 'err');
    setBusy(true);
    try { await createUser({ email: email.trim(), nombre: nombre.trim(), rol }); onDone(); }
    catch (e) { toast.show(e.message, 'err'); setBusy(false); }
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
      <div className="fc-help-text" style={{ marginBottom: 12 }}>Se enviará una invitación por correo para fijar la contraseña.</div>
      <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" disabled={busy} onClick={submit}>
        {busy ? 'Creando…' : 'Crear usuario'}
      </button>
    </Sheet>
  );
}
