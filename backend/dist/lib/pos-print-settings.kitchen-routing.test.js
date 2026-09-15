"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const pos_print_settings_1 = require("./pos-print-settings");
const printers = [
    {
        id: 'kitchen-1',
        name: 'Kitchen',
        enabled: true,
        printKitchenTickets: true,
        printReceipts: false,
        printAllProducts: true,
        linkedCategoryIds: [],
    },
    {
        id: 'bar-1',
        name: 'Bar',
        enabled: true,
        printKitchenTickets: true,
        printReceipts: true,
        printAllProducts: true,
        linkedCategoryIds: [],
    },
];
const migrated = (0, pos_print_settings_1.migrateKitchenPrintRoutingToPrinters)(printers, {
    'cat-food': 'kitchen1',
    'cat-drinks': 'receipt',
});
strict_1.default.deepEqual(migrated.printers[0].linkedCategoryIds, ['cat-food']);
strict_1.default.deepEqual(migrated.printers[1].linkedCategoryIds, ['cat-drinks']);
strict_1.default.equal(migrated.routing, undefined);
console.log('pos-print-settings kitchen routing migration: ok');
//# sourceMappingURL=pos-print-settings.kitchen-routing.test.js.map