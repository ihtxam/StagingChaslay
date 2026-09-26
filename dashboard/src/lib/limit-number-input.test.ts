import { describe, expect, it } from 'vitest';
import {
  handleLimitNumberInputChange,
  limitNumberInputDisplay,
  parseLimitNumberField,
} from './limit-number-input';

describe('limit-number-input', () => {
  it('allows empty while typing', () => {
    let value: number | '' = 1;
    handleLimitNumberInputChange('', (v) => {
      value = v;
    });
    expect(value).toBe('');
    expect(limitNumberInputDisplay(value)).toBe('');
  });

  it('parses empty on save with fallback', () => {
    expect(parseLimitNumberField('', 1)).toBe(1);
    expect(parseLimitNumberField(2, 1)).toBe(2);
  });
});
