"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditionEntitlementsService = void 0;
const edition_features_1 = require("@/lib/edition-features");
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
        cache.set(merchantId, { at: Date.now(), features });
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