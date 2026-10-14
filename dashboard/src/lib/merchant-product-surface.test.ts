import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MERCHANT_PRODUCT_SURFACES,
  PRODUCT_SURFACE_PRESETS,
  filterEditionsForProductSurface,
  getProductSurfacePreset,
  listProductSurfacePresets,
  productSurfacePackagingEditionNames,
} from './merchant-product-surface';

describe('merchant product surfaces', () => {
  it('keeps every package key paired with a labeled preset', () => {
    for (const key of MERCHANT_PRODUCT_SURFACES) {
      const preset = PRODUCT_SURFACE_PRESETS[key];
      assert.ok(preset, `missing preset for ${key}`);
      assert.ok(preset.label);
      assert.ok(preset.description);
      assert.ok(preset.editionName);
    }
  });

  it('lists packages without reading a missing preset.label', () => {
    const listed = listProductSurfacePresets();
    assert.equal(listed.length, MERCHANT_PRODUCT_SURFACES.length);
    for (const preset of listed) {
      assert.match(preset.label, /\S/);
      assert.ok(preset.key);
    }
  });

  it('falls back when the surface key is unknown so create-merchant cannot crash', () => {
    const preset = getProductSurfacePreset('not_a_real_package');
    assert.equal(preset.label, PRODUCT_SURFACE_PRESETS.full_pos.label);
    assert.equal(getProductSurfacePreset(undefined).label, PRODUCT_SURFACE_PRESETS.full_pos.label);
  });

  it('filters editions without throwing when the surface is a valid package', () => {
    const editions = [
      { id: '1', name: 'Restaurant Pro', businessCategory: 'restaurant' },
      { id: '2', name: 'Shop only (no POS)', businessCategory: 'both' },
    ];
    assert.deepEqual(
      filterEditionsForProductSurface(editions, 'shop_only', 'restaurant').map((e) => e.name),
      ['Shop only (no POS)']
    );
    assert.ok(productSurfacePackagingEditionNames().includes('Full POS + Shop'));
  });
});
