"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditionEntitlementsService = void 0;
const edition_features_1 = require("@/lib/edition-features");
const business_module_1 = require("@/lib/business-module");
const db_1 = require("@/db");
const schema = __importStar(require("@/db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const edition_service_1 = require("@/services/edition.service");
const cache = new Map();
const TTL_MS = 30000;
class EditionEntitlementsService {
    static invalidate(merchantId) {
        cache.delete(merchantId);
    }
    static async getFeatures(merchantId) {
        const hit = cache.get(merchantId);
        if (hit && Date.now() - hit.at < TTL_MS)
            return hit.features;
        const features = await edition_service_1.EditionService.getMerchantFeatures(merchantId);
        const enriched = await this.enrichForMerchant(merchantId, features);
        cache.set(merchantId, { at: Date.now(), features: enriched });
        return enriched;
    }
    /** Retail merchants get pos_scale by default when their edition predates the feature. */
    static async enrichForMerchant(merchantId, features) {
        if (features == null)
            return null;
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(schema.merchants.id, merchantId),
            columns: { businessCategory: true },
        });
        const module = (0, business_module_1.normalizeBusinessModule)(merchant?.businessCategory);
        if (module === "retail" && !features.includes("pos_scale")) {
            return [...features, "pos_scale"];
        }
        return features;
    }
    static async require(merchantId, feature) {
        const features = await this.getFeatures(merchantId);
        if (!(0, edition_features_1.hasEditionFeature)(features, feature)) {
            const err = new Error(`Edition does not include feature: ${feature}`);
            err.status = 403;
            throw err;
        }
        return features;
    }
}
exports.EditionEntitlementsService = EditionEntitlementsService;
//# sourceMappingURL=edition-entitlements.service.js.map