import { describe, expect, it } from 'vitest';
import {
  SHOP_ONLINE_ORDERS_DISABLED,
  customerShopError,
  isShopOnlineOrdersDisabled,
} from './shop-public-error';

describe('shop-public-error', () => {
  it('detects disabled shop codes and legacy messages', () => {
    expect(isShopOnlineOrdersDisabled(SHOP_ONLINE_ORDERS_DISABLED)).toBe(true);
    expect(isShopOnlineOrdersDisabled('Shop not found or closed')).toBe(true);
    expect(isShopOnlineOrdersDisabled('Shop not found')).toBe(false);
  });

  it('maps disabled shop to translated copy', () => {
    const t = (key: string) => (key === 'shopOnlineOrdersDisabled' ? 'Friendly pause' : key);
    expect(customerShopError(SHOP_ONLINE_ORDERS_DISABLED, 'fallback', t)).toBe('Friendly pause');
  });
});
