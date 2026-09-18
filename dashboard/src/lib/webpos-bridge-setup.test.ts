import { describe, expect, it } from 'vitest';
import { evaluateBridgeSetupMode } from './webpos-bridge-setup';

describe('evaluateBridgeSetupMode', () => {
  it('returns null while printer list is still loading', () => {
    expect(
      evaluateBridgeSetupMode({
        agentOk: true,
        printersReady: false,
        printers: [],
        printerName: '',
        printSettings: null,
      })
    ).toBeNull();
  });

  it('returns bridge_offline only after printers are ready and agent is down', () => {
    expect(
      evaluateBridgeSetupMode({
        agentOk: false,
        printersReady: true,
        printers: [],
        printerName: '',
        printSettings: null,
      })
    ).toBe('bridge_offline');
  });
});
