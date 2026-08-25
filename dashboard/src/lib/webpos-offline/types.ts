/** Offline WebPOS types — keep sale payload aligned with backend SyncSalePayload. */

export type OfflineSalePayload = {
  clientId: string;
  orderNumber?: string;
  paymentMethod: string;
  paymentStatus?: string;
  status?: string;
  cancelReason?: string | null;
  cancelledAt?: string | number | null;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  tipAmount?: number;
  roundingAmount?: number;
  amountTendered?: number | null;
  changeDue?: number | null;
  staffName?: string | null;
  total: number;
  notes?: string;
  fulfillmentChannel?: 'takeaway' | 'dine_in' | 'delivery';
  completedAt?: string | number;
  scheduledFor?: string | number | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  shippingAddress?: string | null;
  tableId?: string | null;
  tableLabel?: string | null;
  guestCount?: number | null;
  masterOrderId?: string | null;
  splitCheckNumber?: number | null;
  splitPartCount?: number | null;
  items: Array<{
    productClientId?: string;
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taxAmount?: number;
    selectedExtras?: Array<{ id: string; name: string; price: number }>;
    comboSelections?: unknown[];
    isOpenPrice?: boolean;
  }>;
};

export type OutboxSaleStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type OutboxSale = {
  clientId: string;
  payload: OfflineSalePayload;
  status: OutboxSaleStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastError?: string | null;
  serverOrderId?: string | null;
};

export type CachedCategory = {
  id: string;
  name: string;
  sortOrder?: number | null;
  isActive?: boolean;
  updatedAt?: string;
  [key: string]: unknown;
};

export type CachedProduct = {
  id: string;
  name: string;
  categoryId?: string | null;
  price?: string | number;
  isActive?: boolean;
  updatedAt?: string;
  [key: string]: unknown;
};

export type OfflineSnapshotMeta = {
  key: 'snapshot';
  merchantId: string;
  savedAt: number;
  lastPullAt: string | null;
  serverTime?: string | null;
};

export type OfflineConfigSnapshot = {
  key: 'config';
  merchantId: string;
  savedAt: number;
  merchant: unknown;
  paymentConfig: unknown;
  entitlement: unknown;
  printSettings: unknown;
  staff: unknown[];
};

export type OfflineSyncState = {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
  catalogCachedAt: number | null;
};

/** Payment methods allowed when offline (no cloud processor / balance check). */
export const OFFLINE_SAFE_PAYMENT_METHODS = new Set(['cash', 'card', 'express', 'invoice']);

export function isWebPosOfflineEnabled(): boolean {
  try {
    return localStorage.getItem('manupos_webpos_offline') !== '0';
  } catch {
    return true;
  }
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}
