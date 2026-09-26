import { describe, expect, it } from 'vitest';
import { isMultiLocationLicensed } from './locations-addon';

describe('isMultiLocationLicensed', () => {
  it('treats unlimited (0) and >1 as licensed', () => {
    expect(isMultiLocationLicensed({ maxLocations: 0 })).toBe(true);
    expect(isMultiLocationLicensed({ maxLocations: 2 })).toBe(true);
  });

  it('single location default is not licensed', () => {
    expect(isMultiLocationLicensed({ maxLocations: 1 })).toBe(false);
    expect(isMultiLocationLicensed(null)).toBe(false);
  });
});
