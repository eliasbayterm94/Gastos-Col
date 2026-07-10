import AppSidebarLayout from '../../components/AppSidebarLayout.jsx';
import { IcGrid, IcUsers, IcTag, IcShield, IcList } from '../../components/Icons.jsx';

const NAV = [
  { to: '/admin', label: 'Panel', icon: IcGrid, end: true },
  { to: '/admin/usuarios', label: 'Usuarios', icon: IcUsers },
  { to: '/admin/catalogos', label: 'Categorías', icon: IcTag },
  { to: '/admin/overrides', label: 'Overrides', icon: IcShield },
  { to: '/admin/auditoria', label: 'Auditoría', icon: IcList },
];

export default function AdminLayout() {
  return <AppSidebarLayout nav={NAV} title="Forest Gastos" badge="Administrador" />;
}
