"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const platform_message_service_1 = require("./platform-message.service");
const visible = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const dismissed = new Set(['b']);
const tray = (0, platform_message_service_1.buildNotificationTray)(visible, dismissed, 2);
strict_1.default.equal(tray.length, 2);
strict_1.default.deepEqual(tray.map((row) => ({ id: row.id, unread: row.unread })), [
    { id: 'a', unread: true },
    { id: 'b', unread: false },
]);
const empty = (0, platform_message_service_1.buildNotificationTray)([], new Set(), 20);
strict_1.default.deepEqual(empty, []);
console.log('platform-message.tray.test.ts: ok');
//# sourceMappingURL=platform-message.tray.test.js.map