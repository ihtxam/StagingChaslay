"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
exports.requireSuperadmin = requireSuperadmin;
exports.requireReseller = requireReseller;
exports.requireMerchantOwner = requireMerchantOwner;
exports.requireMerchantPanel = requireMerchantPanel;
exports.requireMerchant = requireMerchant;
exports.requireMerchantAccess = requireMerchantAccess;
exports.verifyMerchantAccess = verifyMerchantAccess;
exports.setMerchantContext = setMerchantContext;
exports.requirePermission = requirePermission;
const auth_service_1 = require("@/services/auth.service");
const permissions_1 = require("@/lib/permissions");
/**
 * Middleware to verify JWT token
 */
function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing or invalid authorization header" });
        }
        const token = authHeader.substring(7);
        const payload = auth_service_1.AuthService.verifyToken(token);
        req.user = payload;
        if (payload.merchantId) {
            req.merchantId = payload.merchantId;
        }
        next();
    }
    catch (error) {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
/**
 * Middleware to check if user is superadmin
 */
function requireSuperadmin(req, res, next) {
    if (!req.user || req.user.role !== "superadmin") {
        return res.status(403).json({ error: "Superadmin access required" });
    }
    next();
}
/**
 * Middleware to check if user is a reseller (agency)
 */
function requireReseller(req, res, next) {
    if (!req.user || req.user.role !== "reseller" || !req.user.resellerId) {
        return res.status(403).json({ error: "Reseller access required" });
    }
    next();
}
/**
 * Merchant owner only (not staff)
 */
function requireMerchantOwner(req, res, next) {
    if (!req.user || req.user.role !== "merchant") {
        return res.status(403).json({ error: "Merchant owner access required" });
    }
    next();
}
/**
 * Merchant owner or staff with POS / waiter / catalog / panel entry permissions.
 * Route-level requirePermission still gates writes (settings, billing, inventory, catalog).
 */
function requireMerchantPanel(req, res, next) {
    if (!req.user) {
        return res.status(403).json({ error: "Authentication required" });
    }
    if (req.user.role === "merchant")
        return next();
    if (req.user.role === "staff") {
        if ((0, permissions_1.hasAnyPermission)(req.user.permissions, permissions_1.STAFF_MERCHANT_ENTRY_PERMISSIONS))
            return next();
        return res.status(403).json({ error: "Staff access required" });
    }
    return res.status(403).json({ error: "Merchant access required" });
}
/** @deprecated use requireMerchantPanel */
function requireMerchant(req, res, next) {
    return requireMerchantPanel(req, res, next);
}
/**
 * Merchant owner or staff (any authenticated merchant context)
 */
function requireMerchantAccess(req, res, next) {
    if (!req.user || (req.user.role !== "merchant" && req.user.role !== "staff")) {
        return res.status(403).json({ error: "Merchant access required" });
    }
    next();
}
/**
 * Middleware to verify merchant access to their own data
 */
function verifyMerchantAccess(req, res, next) {
    const requestedMerchantId = req.params.merchantId || req.body.merchantId;
    if (!req.user || (req.user.role !== "merchant" && req.user.role !== "staff")) {
        return res.status(403).json({ error: "Merchant access required" });
    }
    if (requestedMerchantId && requestedMerchantId !== req.user.merchantId) {
        return res.status(403).json({ error: "Access denied: cannot access other merchant data" });
    }
    next();
}
/**
 * Middleware to set merchant context
 */
function setMerchantContext(req, res, next) {
    if (req.user?.merchantId) {
        req.merchantId = req.user.merchantId;
    }
    next();
}
function requirePermission(...required) {
    return (req, res, next) => {
        if (req.user?.role === "merchant")
            return next();
        if (req.user?.role === "staff") {
            const granted = req.user.permissions || [];
            if (required.some((p) => granted.includes(p)))
                return next();
            return res.status(403).json({ error: "Permission denied" });
        }
        return res.status(403).json({ error: "Authentication required" });
    };
}
//# sourceMappingURL=auth.middleware.js.map