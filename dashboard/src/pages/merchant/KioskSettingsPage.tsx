import KioskAdminPanel from '@/components/kiosk/KioskAdminPanel';

/** Merchant panel — kiosk operators with MANAGE_KIOSK land here after login. */
export default function KioskSettingsPage({ embedded }: { embedded?: boolean }) {
  return <KioskAdminPanel mode="merchant" showOwnerExtras embedded={embedded} />;
}
