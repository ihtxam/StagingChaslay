import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isReservationScrollAutoOpenSurface } from './reservation-scroll-reveal.ts';

describe('isReservationScrollAutoOpenSurface', () => {
  it('allows shop home paths', () => {
    assert.equal(isReservationScrollAutoOpenSurface('/shop/demo'), true);
    assert.equal(isReservationScrollAutoOpenSurface('/shop/demo/l/geneva'), true);
    assert.equal(isReservationScrollAutoOpenSurface('/shop/demo/pages/about'), true);
  });

  it('blocks transactional surfaces', () => {
    assert.equal(isReservationScrollAutoOpenSurface('/shop/demo/menu'), false);
    assert.equal(isReservationScrollAutoOpenSurface('/shop/demo/checkout'), false);
    assert.equal(isReservationScrollAutoOpenSurface('/shop/demo/reservations'), false);
  });
});
