import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePartyBookingGate,
  resolveLargePartyCallThreshold,
} from './reservation-party-threshold.ts';

describe('resolveLargePartyCallThreshold', () => {
  it('returns null for empty or zero', () => {
    assert.equal(resolveLargePartyCallThreshold(null), null);
    assert.equal(resolveLargePartyCallThreshold(0), null);
    assert.equal(resolveLargePartyCallThreshold(undefined), null);
  });

  it('clamps positive values', () => {
    assert.equal(resolveLargePartyCallThreshold(10), 10);
    assert.equal(resolveLargePartyCallThreshold(150), 100);
  });
});

describe('evaluatePartyBookingGate', () => {
  const min = 1;
  const max = 12;
  const threshold = 10;

  it('allows in-range parties below threshold', () => {
    assert.deepEqual(evaluatePartyBookingGate(4, min, max, threshold), {
      blocked: false,
      reason: null,
    });
  });

  it('blocks at and above call threshold', () => {
    assert.equal(evaluatePartyBookingGate(10, min, max, threshold).reason, 'call_threshold');
    assert.equal(evaluatePartyBookingGate(11, min, max, threshold).blocked, true);
  });

  it('blocks above max even without threshold', () => {
    assert.equal(evaluatePartyBookingGate(20, min, max, null).reason, 'above_max');
  });

  it('ignores threshold when null', () => {
    assert.equal(evaluatePartyBookingGate(11, min, max, null).blocked, false);
  });
});
