import assert from 'node:assert/strict';
import {
  healStaleReceiptPrinterProfiles,
  reconcilePosPrinterProfiles,
  resolveEscPosPrinterName,
  resolveLivePrinterName,
  type AgentPrinter,
} from './print-agent.ts';
import { buildKitchenPrintJobs, type PosPrintSettingsClient } from './webpos-receipt.ts';

const usb: AgentPrinter = {
  id: 'usb:1234:5678',
  name: 'USB Printer Port',
  connectionType: 'usb',
  usbPrinterClass: true,
  isDefault: true,
};

const usbRenamed: AgentPrinter = {
  id: 'usb:1234:5678',
  name: 'USB printer 04D8:0001',
  connectionType: 'usb',
  usbPrinterClass: true,
  isDefault: true,
};

const lan: AgentPrinter = {
  id: 'lan:192.168.1.43',
  name: 'LAN 192.168.1.43:9100',
  connectionType: 'lan',
  isDefault: true,
};

const profile = {
  id: 'kitchen',
  name: 'USB Printer Port',
  matchHint: 'usb:1234:5678',
  enabled: true,
  printKitchenTickets: true,
  printReceipts: true,
};

const kept = reconcilePosPrinterProfiles([profile], [lan]);
assert.equal(kept.changed, false);
assert.equal(kept.profiles[0]?.name, 'USB Printer Port');

const renamed = reconcilePosPrinterProfiles([profile], [usbRenamed, lan]);
assert.equal(renamed.profiles[0]?.name, 'USB printer 04D8:0001');

assert.equal(resolveLivePrinterName('USB Printer Port', [lan]), null);
assert.equal(resolveLivePrinterName('USB Printer Port', [usbRenamed]), 'USB printer 04D8:0001');
assert.equal(resolveEscPosPrinterName('', [lan, usb]), 'USB Printer Port');
assert.equal(resolveEscPosPrinterName('LAN 192.168.1.43:9100', [lan, usb]), 'LAN 192.168.1.43:9100');
assert.equal(resolveEscPosPrinterName('USB Printer Port', [lan]), null);

const healed = healStaleReceiptPrinterProfiles(
  [{ ...profile, name: 'USB Printer Port' }],
  [lan]
);
assert.equal(healed.changed, false);
assert.equal(healed.profiles[0]?.name, 'USB Printer Port');

const filled = healStaleReceiptPrinterProfiles(
  [{ ...profile, name: '', printKitchenTickets: true, printReceipts: false }],
  [lan, usb]
);
assert.equal(filled.changed, true);
assert.equal(filled.profiles[0]?.name, 'USB Printer Port');

const settings: PosPrintSettingsClient = {
  paperWidthMm: 80,
  printers: [
    {
      id: 'kitchen',
      name: '',
      enabled: true,
      printKitchenTickets: true,
      printReceipts: false,
      printAllProducts: true,
      linkedCategoryIds: ['meat'],
    },
  ],
};
const jobs = buildKitchenPrintJobs(
  [{ name: 'Rind', quantity: 1, unitPrice: 10, lineTotal: 10, categoryId: 'meat' }],
  settings
);
assert.equal(jobs.length, 1);
assert.equal(jobs[0]?.useBridgeDefault, true);
assert.equal(jobs[0]?.items[0]?.name, 'Rind');

console.log('print-agent-usb-lan-keep.test.ts ok');
