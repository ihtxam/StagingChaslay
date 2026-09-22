/**
 * Scale device detection — run: npx tsx dashboard/src/lib/print-agent.scale.test.ts
 */
import assert from 'node:assert/strict';
import {
  formatScalePortLabel,
  isGenericBluetoothSerialDevice,
  isLikelyScaleDevice,
  isPlaceholderScaleUsbAddress,
  isSavedScaleConnected,
  sanitizeScaleUsbAddress,
  type ScaleDevice,
} from './print-agent';

function d(partial: Partial<ScaleDevice> & Pick<ScaleDevice, 'port'>): ScaleDevice {
  return { port: partial.port, ...partial };
}

assert.equal(
  isGenericBluetoothSerialDevice(
    d({
      port: 'COM5',
      name: 'Standardmäßige Seriell-über-Bluetooth-Verbindung',
      manufacturer: 'Microsoft',
    })
  ),
  true
);

assert.equal(
  isLikelyScaleDevice(
    d({
      port: 'COM5',
      name: 'Standardmäßige Seriell-über-Bluetooth-Verbindung',
      manufacturer: 'Microsoft',
    })
  ),
  false
);

assert.equal(
  isLikelyScaleDevice(
    d({
      port: 'COM7',
      name: 'USB-SERIAL CH340 (COM7)',
      caption: 'USB-SERIAL CH340 (COM7)',
    })
  ),
  true
);

assert.equal(
  isLikelyScaleDevice(
    d({
      port: 'COM3',
      name: 'Aclas OS2X',
      manufacturer: 'Aclas',
    })
  ),
  true
);

assert.equal(
  isLikelyScaleDevice(
    d({
      port: 'COM4',
      name: 'COM4',
      caption: 'COM4',
    })
  ),
  false
);

// Tauri native serial returns portName, not port — desktop mapping must accept both.
const tauriDevice = {
  portName: 'COM7',
  name: 'USB-SERIAL CH340 (COM7)',
};
assert.equal(
  formatScalePortLabel(
    String(
      (tauriDevice as { port?: string; portName?: string; name?: string }).port ||
        tauriDevice.portName ||
        tauriDevice.name ||
        ''
    )
  ),
  'COM7'
);

assert.equal(
  isLikelyScaleDevice(
    d({
      port: 'usb:1a86:7523',
      name: 'USB scale (6790:29987)',
      usbAddress: 'usb:1a86:7523',
    })
  ),
  true
);

assert.equal(isPlaceholderScaleUsbAddress('usb:1234:5678'), true);
assert.equal(sanitizeScaleUsbAddress('usb:1234:5678'), null);
assert.equal(sanitizeScaleUsbAddress('usb:1a86:7523'), 'usb:1a86:7523');
assert.equal(
  isLikelyScaleDevice(
    d({
      port: 'usb:1234:5678',
      usbAddress: 'usb:1234:5678',
    })
  ),
  false
);
assert.equal(
  isSavedScaleConnected(
    { scaleComPort: 'COM5', scaleDeviceName: 'USB-SERIAL CH340' },
    []
  ),
  false
);
assert.equal(
  isSavedScaleConnected(
    { scaleComPort: 'COM5', scaleDeviceName: 'USB-SERIAL CH340' },
    [d({ port: 'COM5', name: 'USB-SERIAL CH340 (COM5)' })]
  ),
  true
);

console.log('print-agent.scale.test.ts: ok');
