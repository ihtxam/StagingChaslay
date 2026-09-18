"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Platform message history pagination — run: npx tsx backend/src/services/platform-message.paginate.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const platform_message_service_1 = require("./platform-message.service");
const items = Array.from({ length: 45 }, (_, i) => ({ id: String(i + 1) }));
{
    const page = platform_message_service_1.PlatformMessageService.paginateHistory(items, 0, 20);
    strict_1.default.equal(page.offset, 0);
    strict_1.default.equal(page.limit, 20);
    strict_1.default.equal(page.total, 45);
    strict_1.default.equal(page.messages.length, 20);
    strict_1.default.equal(page.messages[0]?.id, '1');
    strict_1.default.equal(page.hasMore, true);
}
{
    const page = platform_message_service_1.PlatformMessageService.paginateHistory(items, 40, 20);
    strict_1.default.equal(page.messages.length, 5);
    strict_1.default.equal(page.messages[0]?.id, '41');
    strict_1.default.equal(page.hasMore, false);
}
{
    const page = platform_message_service_1.PlatformMessageService.paginateHistory(items, -8, 999);
    strict_1.default.equal(page.offset, 0);
    strict_1.default.equal(page.limit, 50);
    strict_1.default.equal(page.messages.length, 45);
    strict_1.default.equal(page.hasMore, false);
}
{
    const page = platform_message_service_1.PlatformMessageService.paginateHistory(items, '20', undefined);
    strict_1.default.equal(page.offset, 20);
    strict_1.default.equal(page.limit, 20);
    strict_1.default.equal(page.messages[0]?.id, '21');
}
console.log('platform-message.paginate.test.ts: ok');
//# sourceMappingURL=platform-message.paginate.test.js.map