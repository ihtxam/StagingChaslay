"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEditionFeature = requireEditionFeature;
const edition_entitlements_service_1 = require("@/services/edition-entitlements.service");
/**
 * Require merchant edition to include a feature. Null edition = legacy full access.
 */
function requireEditionFeature(...features) {
    return async (req, res, next) => {
        try {
            const merchantId = req.merchantId || req.user?.merchantId;
            if (!merchantId) {
                return res.status(400).json({ error: "Merchant ID is required" });
            }
            const granted = await edition_entitlements_service_1.EditionEntitlementsService.getFeatures(merchantId);
            if (granted == null)
                return next();
            const ok = features.some((f) => granted.includes(f));
            if (!ok) {
                return res.status(403).json({
                    error: "Your POS edition does not include this feature",
                    requiredFeatures: features,
                });
            }
            next();
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : "Edition check failed",
            });
        }
    };
}
//# sourceMappingURL=edition.middleware.js.map