/** Table QR stand download defaults (merchant dashboard). */

export type TableQrLayoutTemplate = "vertical" | "horizontal" | "curved";

export type TableQrSettings = {
  headerText?: string;
  subtitleText?: string;
  layoutTemplate?: TableQrLayoutTemplate;
  /** Auto-accept QR table orders (skip pending_approval). */
  qrAutoApprove?: boolean;
  /** Allow pay-at-table from customer phone. */
  qrPayAtTableEnabled?: boolean;
};

export const DEFAULT_TABLE_QR_SETTINGS: Required<TableQrSettings> = {
  headerText: "MENU",
  subtitleText: "Scan me to order",
  layoutTemplate: "vertical",
  qrAutoApprove: false,
  qrPayAtTableEnabled: true,
};

const LAYOUTS: TableQrLayoutTemplate[] = ["vertical", "horizontal", "curved"];

export function normalizeTableQrSettings(raw: unknown): TableQrSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const layout = String(src.layoutTemplate || "").toLowerCase();
  return {
    headerText: String(src.headerText ?? DEFAULT_TABLE_QR_SETTINGS.headerText).trim().slice(0, 80) ||
      DEFAULT_TABLE_QR_SETTINGS.headerText,
    subtitleText: String(src.subtitleText ?? DEFAULT_TABLE_QR_SETTINGS.subtitleText).trim().slice(0, 120) ||
      DEFAULT_TABLE_QR_SETTINGS.subtitleText,
    layoutTemplate: LAYOUTS.includes(layout as TableQrLayoutTemplate)
      ? (layout as TableQrLayoutTemplate)
      : DEFAULT_TABLE_QR_SETTINGS.layoutTemplate,
    qrAutoApprove: src.qrAutoApprove === true,
    qrPayAtTableEnabled: src.qrPayAtTableEnabled !== false,
  };
}
