/**
 * Scale device detection — run: npx tsx dashboard/src/lib/print-agent.scale.test.ts
 */
import assert from 'node:assert/strict';
import {
  isGenericBluetoothSerialDevice,
  isLikelyScaleDevice,
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

console.log('print-agent.scale.test.ts: ok');
