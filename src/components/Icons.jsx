// Iconos SVG en línea (stroke currentColor). Sin dependencias externas.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
const S = ({ children, size = 20, ...p }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base} {...p}>{children}</svg>
);

export const IcList = (p) => <S {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></S>;
export const IcWallet = (p) => <S {...p}><path d="M3 7h18v12H3zM3 7l2-3h12l2 3M16 13h2" /></S>;
export const IcReceipt = (p) => <S {...p}><path d="M6 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1zM9 8h6M9 12h6" /></S>;
export const IcCamera = (p) => <S {...p}><path d="M3 8h3l2-2h8l2 2h3v12H3zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /></S>;
export const IcPlus = (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IcCheck = (p) => <S {...p}><path d="M20 6L9 17l-5-5" /></S>;
export const IcClose = (p) => <S {...p}><path d="M18 6L6 18M6 6l12 12" /></S>;
export const IcChevron = (p) => <S {...p}><path d="M9 18l6-6-6-6" /></S>;
export const IcBack = (p) => <S {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></S>;
export const IcRefresh = (p) => <S {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></S>;
export const IcLogout = (p) => <S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></S>;
export const IcInbox = (p) => <S {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2M5 5h14l3 7v7H2v-7z" /></S>;
export const IcUpload = (p) => <S {...p}><path d="M21 15v4H3v-4M12 3v13M7 8l5-5 5 5" /></S>;
