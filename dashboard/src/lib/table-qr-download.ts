import { qrImageUrl } from '@/lib/qr';
import {
  DEFAULT_TABLE_QR_SETTINGS,
  type QrDownloadStyle,
  type QrLayoutTemplate,
  type TableQrSettings,
  STYLED_QR_HEIGHTS,
} from '@/lib/table-management';

const COLORS = {
  dark: '#141417',
  white: '#ffffff',
  muted: '#a1a1aa',
};

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function formatTableLabel(label: string): string {
  const trimmed = String(label || '').trim();
  if (!trimmed) return '#—';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function wrapSubtitle(text: string): string {
  const t = text.trim();
  if (!t) return '';
  if (t.startsWith('—') || t.startsWith('-')) return t;
  return `— ${t} —`;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png');
  });
}

function drawHeaderText(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  headerText: string,
  subtitleText: string,
  scale: number
) {
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${Math.round(42 * scale)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(headerText.toUpperCase(), cx, y);

  const subtitle = wrapSubtitle(subtitleText);
  if (subtitle) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `500 ${Math.round(16 * scale)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(subtitle, cx, y + Math.round(52 * scale));
  }
}

function drawTableBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tableLabel: string,
  scale: number,
  onDark = true
) {
  ctx.fillStyle = onDark ? COLORS.white : COLORS.dark;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(56 * scale)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(formatTableLabel(tableLabel), cx, cy);
}

async function renderCodeOnly(payload: string, qrPx: number): Promise<Blob> {
  const pad = 8;
  const w = qrPx + pad * 2;
  const h = qrPx + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(0, 0, w, h);
  const img = await loadImage(qrImageUrl(payload, qrPx));
  ctx.drawImage(img, pad, pad, qrPx, qrPx);
  return canvasToBlob(canvas);
}

async function renderVerticalStand(
  payload: string,
  tableLabel: string,
  height: number,
  settings: TableQrSettings
): Promise<Blob> {
  const scale = height / 600;
  const width = Math.round(height * 0.67);
  const headerH = Math.round(height * 0.24);
  const footerH = Math.round(height * 0.16);
  const qrPad = Math.round(24 * scale);
  const qrSize = Math.min(width - qrPad * 2, height - headerH - footerH - qrPad * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = COLORS.white;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(0, 0, width, headerH);
  drawHeaderText(ctx, width / 2, Math.round(28 * scale), settings.headerText!, settings.subtitleText!, scale);

  const img = await loadImage(qrImageUrl(payload, qrSize));
  const qrX = (width - qrSize) / 2;
  const qrY = headerH + (height - headerH - footerH - qrSize) / 2;
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(0, height - footerH, width, footerH);
  drawTableBadge(ctx, width / 2, height - footerH / 2, tableLabel, scale);

  return canvasToBlob(canvas);
}

async function renderHorizontalStand(
  payload: string,
  tableLabel: string,
  height: number,
  settings: TableQrSettings
): Promise<Blob> {
  const scale = height / 600;
  const width = Math.round(height * 1.35);
  const qrColW = Math.round(width * 0.46);
  const textColX = qrColW;
  const textColW = width - qrColW;
  const qrPad = Math.round(20 * scale);
  const qrSize = Math.min(qrColW - qrPad * 2, height - qrPad * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = COLORS.white;
  ctx.fillRect(0, 0, qrColW, height);

  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(textColX, 0, textColW, height);

  const img = await loadImage(qrImageUrl(payload, qrSize));
  ctx.drawImage(img, (qrColW - qrSize) / 2, (height - qrSize) / 2, qrSize, qrSize);

  drawHeaderText(
    ctx,
    textColX + textColW / 2,
    Math.round(height * 0.18),
    settings.headerText!,
    settings.subtitleText!,
    scale
  );
  drawTableBadge(ctx, textColX + textColW / 2, height * 0.72, tableLabel, scale);

  return canvasToBlob(canvas);
}

async function renderCurvedStand(
  payload: string,
  tableLabel: string,
  height: number,
  settings: TableQrSettings
): Promise<Blob> {
  const scale = height / 600;
  const width = Math.round(height * 0.67);
  const headerH = Math.round(height * 0.24);
  const footerH = Math.round(height * 0.2);
  const qrPad = Math.round(24 * scale);
  const qrSize = Math.min(width - qrPad * 2, height - headerH - footerH - qrPad * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = COLORS.white;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(0, 0, width, headerH);
  drawHeaderText(ctx, width / 2, Math.round(28 * scale), settings.headerText!, settings.subtitleText!, scale);

  const img = await loadImage(qrImageUrl(payload, qrSize));
  const qrX = (width - qrSize) / 2;
  const qrY = headerH + (height - headerH - footerH - qrSize) / 2;
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  const footerTop = height - footerH;
  const curveDepth = Math.round(18 * scale);
  ctx.fillStyle = COLORS.dark;
  ctx.beginPath();
  ctx.moveTo(0, footerTop);
  ctx.quadraticCurveTo(width / 2, footerTop - curveDepth, width, footerTop);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  drawTableBadge(ctx, width / 2, footerTop + footerH * 0.55, tableLabel, scale);

  return canvasToBlob(canvas);
}

export function mergeTableQrSettings(partial?: TableQrSettings | null): Required<TableQrSettings> {
  return {
    headerText: partial?.headerText?.trim() || DEFAULT_TABLE_QR_SETTINGS.headerText,
    subtitleText: partial?.subtitleText?.trim() || DEFAULT_TABLE_QR_SETTINGS.subtitleText,
    layoutTemplate: partial?.layoutTemplate || DEFAULT_TABLE_QR_SETTINGS.layoutTemplate,
  };
}

export async function renderTableQrPng(options: {
  payload: string;
  tableLabel: string;
  style: QrDownloadStyle;
  settings?: TableQrSettings | null;
}): Promise<Blob> {
  const { payload, tableLabel, style } = options;
  const settings = mergeTableQrSettings(options.settings);

  if (style === 'code_only') {
    return renderCodeOnly(payload, 280);
  }

  const height = STYLED_QR_HEIGHTS[style];
  const layout: QrLayoutTemplate = settings.layoutTemplate;

  if (layout === 'horizontal') {
    return renderHorizontalStand(payload, tableLabel, height, settings);
  }
  if (layout === 'curved') {
    return renderCurvedStand(payload, tableLabel, height, settings);
  }
  return renderVerticalStand(payload, tableLabel, height, settings);
}

export function tableQrDownloadFilename(tableLabel: string, style: QrDownloadStyle): string {
  const slug = tableLabel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'table';
  return `table-${slug}-qr-${style}.png`;
}

export function downloadQrBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
