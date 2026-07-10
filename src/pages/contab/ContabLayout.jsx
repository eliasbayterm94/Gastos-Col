import AppSidebarLayout from '../../components/AppSidebarLayout.jsx';
import { IcGrid, IcInbox, IcWallet, IcReceipt, IcSend } from '../../components/Icons.jsx';

const NAV = [
  { to: '/c', label: 'Panel', icon: IcGrid, end: true },
  { to: '/c/revision', label: 'Revisión', icon: IcInbox },
  { to: '/c/anticipos', label: 'Anticipos', icon: IcWallet },
  { to: '/c/cierres', label: 'Cierres', icon: IcReceipt },
  { to: '/c/siigo', label: 'Siigo', icon: IcSend },
];

export default function ContabLayout() {
  return <AppSidebarLayout nav={NAV} title="Forest Gastos" badge="Contabilidad" />;
}
