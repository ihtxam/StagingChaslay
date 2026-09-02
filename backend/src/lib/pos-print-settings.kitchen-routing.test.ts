import assert from 'node:assert/strict';
import { migrateKitchenPrintRoutingToPrinters } from './pos-print-settings';

const printers = [
  {
    id: 'kitchen-1',
    name: 'Kitchen',
    enabled: true,
    printKitchenTickets: true,
    printReceipts: false,
    printAllProducts: true,
    linkedCategoryIds: [] as string[],
  },
  {
    id: 'bar-1',
    name: 'Bar',
    enabled: true,
    printKitchenTickets: true,
    printReceipts: true,
    printAllProducts: true,
    linkedCategoryIds: [] as string[],
  },
];

const migrated = migrateKitchenPrintRoutingToPrinters(printers, {
  'cat-food': 'kitchen1',
  'cat-drinks': 'receipt',
});

assert.deepEqual(migrated.printers[0].linkedCategoryIds, ['cat-food']);
assert.deepEqual(migrated.printers[1].linkedCategoryIds, ['cat-drinks']);
assert.equal(migrated.routing, undefined);

console.log('pos-print-settings kitchen routing migration: ok');
