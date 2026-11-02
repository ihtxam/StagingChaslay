import assert from 'node:assert/strict';
import {
  buildKitchenPrintJobs,
  resolveKitchenPrintJobsWithFallback,
  type KitchenTicketItem,
  type PosPrintSettingsClient,
} from './webpos-receipt.ts';

const ice: KitchenTicketItem = {
  name: 'Boule de glace',
  quantity: 1,
  unitPrice: 4,
  lineTotal: 4,
  categoryId: 'desserts',
};
const drink: KitchenTicketItem = {
  name: 'Aguardente 4 cl',
  quantity: 1,
  unitPrice: 5,
  lineTotal: 5,
  categoryId: 'drinks',
};

function kitchenSettings(
  printers: NonNullable<PosPrintSettingsClient['printers']>
): PosPrintSettingsClient {
  return { printers, paperWidthMm: 80 };
}

const names = (jobs: { items: KitchenTicketItem[] }[]) =>
  jobs.flatMap((job) => job.items.map((item) => item.name));

const selective = kitchenSettings([
  {
    id: 'kitchen',
    name: 'Cuisine',
    enabled: true,
    printKitchenTickets: true,
    printReceipts: false,
    printAllProducts: false,
    linkedCategoryIds: ['desserts', 'viandes'],
  },
]);

const jobs = buildKitchenPrintJobs([ice, drink], selective);
assert.deepEqual(names(jobs), ['Boule de glace']);
assert.equal(jobs[0]?.printerName, 'Cuisine');

const drinksOnly = resolveKitchenPrintJobsWithFallback([drink], selective);
assert.deepEqual(drinksOnly, [], 'deselected drinks-only ticket must not print to kitchen');

const catchAll = kitchenSettings([
  {
    id: 'kitchen',
    name: 'Cuisine',
    enabled: true,
    printKitchenTickets: true,
    printReceipts: false,
    printAllProducts: true,
    linkedCategoryIds: [],
  },
]);
assert.deepEqual(names(buildKitchenPrintJobs([ice, drink], catchAll)), [
  'Boule de glace',
  'Aguardente 4 cl',
]);

const splitStations = kitchenSettings([
  {
    id: 'kitchen',
    name: 'Cuisine',
    enabled: true,
    printKitchenTickets: true,
    printReceipts: false,
    printAllProducts: false,
    linkedCategoryIds: ['desserts'],
  },
  {
    id: 'bar',
    name: 'Bar',
    enabled: true,
    printKitchenTickets: true,
    printReceipts: false,
    printAllProducts: false,
    linkedCategoryIds: ['drinks'],
  },
]);
const split = buildKitchenPrintJobs([ice, drink], splitStations);
assert.deepEqual(
  split.map((job) => ({ printer: job.printerName, items: job.items.map((item) => item.name) })),
  [
    { printer: 'Cuisine', items: ['Boule de glace'] },
    { printer: 'Bar', items: ['Aguardente 4 cl'] },
  ]
);

console.log('webpos-kitchen-routing.test.ts OK');
