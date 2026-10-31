import { describe, expect, it } from 'vitest';
import { canAddLocation, isAtLocationLimit } from './location-limits';

describe('location-limits', () => {
  it('allows add when under cap', () => {
    expect(canAddLocation({ maxLocations: 2, currentCount: 1 })).toBe(true);
    expect(isAtLocationLimit({ maxLocations: 2, currentCount: 1 })).toBe(false);
  });

  it('blocks add at cap', () => {
    expect(canAddLocation({ maxLocations: 2, currentCount: 2 })).toBe(false);
    expect(isAtLocationLimit({ maxLocations: 2, currentCount: 2 })).toBe(true);
  });

  it('treats zero max as unlimited', () => {
    expect(canAddLocation({ maxLocations: 0, currentCount: 99 })).toBe(true);
    expect(isAtLocationLimit({ maxLocations: 0, currentCount: 99 })).toBe(false);
  });
});
