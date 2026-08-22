/**
 * Adyen Tap to Pay (SoftPOS) endpoints for the Android POS, mounted at
 * /api/tap-to-pay. Guarded by the merchant dashboard JWT (same token the app
 * stores at online login) and scoped to the caller's merchant.
 *
 * Re-implemented for FoodTruckPOS from the Laravel adyen-api reference; that
 * project is untouched.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=tap-to-pay.routes.d.ts.map