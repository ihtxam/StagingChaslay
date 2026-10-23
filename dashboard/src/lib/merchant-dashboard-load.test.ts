import { describe, expect, it } from 'vitest';

describe('merchant Dashboard chunk (runtime TDZ)', () => {
  it('loads the merchant Dashboard module without before-init errors', async () => {
    const mod = await import('@/pages/merchant/Dashboard');
    expect(typeof mod.default).toBe('function');
  });
});
