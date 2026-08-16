export type TableSection = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  tables: DiningTableRow[];
};

export type DiningTableRow = {
  id: string;
  label: string;
  capacity: number;
  floorPlanId: string;
  floorPlanName?: string;
  shape?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  status?: string;
};

export type TableQrCodeRow = {
  id: string;
  tableId: string;
  codeType: 'static' | 'temporary';
  code: string;
  expiresAt?: string | null;
};

export type QrDownloadStyle = 'code_only' | 'small' | 'medium' | 'large';

export const QR_DOWNLOAD_SIZES: Record<QrDownloadStyle, { qr: number; label: number; showLabel: boolean }> = {
  code_only: { qr: 200, label: 0, showLabel: false },
  small: { qr: 120, label: 14, showLabel: true },
  medium: { qr: 180, label: 18, showLabel: true },
  large: { qr: 280, label: 24, showLabel: true },
};
