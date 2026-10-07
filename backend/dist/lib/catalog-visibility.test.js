"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const catalog_visibility_1 = require("./catalog-visibility");
const shopOnlyCategory = { visibility: { channels: ["shop"] } };
const posProduct = { visibility: { channels: ["pos", "shop"] }, isActive: true };
strict_1.default.equal((0, catalog_visibility_1.productVisibleOnChannel)(posProduct, shopOnlyCategory, "pos"), true);
strict_1.default.equal((0, catalog_visibility_1.productVisibleOnChannel)(posProduct, shopOnlyCategory, "shop"), true);
strict_1.default.equal((0, catalog_visibility_1.productVisibleOnChannel)({ visibility: { channels: ["shop"] }, isActive: true }, shopOnlyCategory, "pos"), false);
strict_1.default.equal((0, catalog_visibility_1.productVisibleOnChannel)({ visibility: { channels: ["shop"] }, isActive: true }, shopOnlyCategory, "delivery"), true);
console.log("catalog-visibility.test.ts ok");
//# sourceMappingURL=catalog-visibility.test.js.map