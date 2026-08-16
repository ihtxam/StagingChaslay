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

export type QrLayoutTemplate = 'vertical' | 'horizontal' | 'curved';

export type TableQrSettings = {
  headerText?: string;
  subtitleText?: string;
  layoutTemplate?: QrLayoutTemplate;
};

export const DEFAULT_TABLE_QR_SETTINGS: Required<TableQrSettings> = {
  headerText: 'MENU',
  subtitleText: 'Scan me to order',
  layoutTemplate: 'vertical',
};

/** Styled stand PNG heights (code_only uses plain QR sizing). */
export const STYLED_QR_HEIGHTS: Record<Exclude<QrDownloadStyle, 'code_only'>, number> = {
  small: 400,
  medium: 600,
  large: 900,
};

export const QR_LAYOUT_TEMPLATES: QrLayoutTemplate[] = ['vertical', 'horizontal', 'curved'];
