import { Router, Request, Response } from "express";
import { AuthService } from "@/services/auth.service";
import { verifyToken, requireMerchant, requireSuperadmin } from "@/middleware/auth.middleware";
import {
  PasswordResetRateLimitError,
  PasswordResetService,
} from "@/services/password-reset.service";

function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || "").split(",")[0];
  return (first || req.ip || req.socket.remoteAddress || "unknown").trim();
}

const router = Router();

/**
 * POST /api/auth/login
 * Official unified login — merchant owner, staff, reseller, or superadmin.
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await AuthService.loginAny(String(email), String(password));
    if (result.kind === "superadmin") {
      return res.json({ success: true, kind: "superadmin", token: result.token, superadmin: result.superadmin });
    }
    if (result.kind === "reseller") {
      return res.json({ success: true, kind: "reseller", token: result.token, reseller: result.reseller });
    }
    return res.json({
      success: true,
      kind: result.kind,
      token: result.token,
      merchant: result.merchant,
      isOwner: result.isOwner !== false,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(401).json({ error: error instanceof Error ? error.message : "Failed to login" });
  }
});

/**
 * POST /api/auth/merchant/register
 * Register a new merchant account
 */
router.post("/merchant/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, businessName, businessCategory } = req.body;

    if (!email || !password || !name || !businessName) {
      return res.status(400).json({ error: "Email, password, name, and business name are required" });
    }

    const category = businessCategory === "retail" || businessCategory === "restaurant"
      ? businessCategory
      : undefined;
    if (!category) {
      return res.status(400).json({ error: "businessCategory must be retail or restaurant" });
    }

    const merchant = await AuthService.registerMerchant(
      email,
      password,
      name,
      businessName,
      category
    );

    res.status(201).json({
      success: true,
      message: "Merchant registered successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error registering merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register merchant" });
  }
});

/**
 * POST /api/auth/merchant/login
 * Login merchant account
 */
router.post("/merchant/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await AuthService.loginMerchant(email, password);

    res.json({
      success: true,
      token: result.token,
      merchant: result.merchant,
      isOwner: result.isOwner !== false,
    });
  } catch (error) {
    console.error("Error logging in merchant:", error);
    res.status(401).json({ error: error instanceof Error ? error.message : "Failed to login" });
  }
});

/**
 * POST /api/auth/superadmin/register
 * Register a new superadmin account (protected)
 */
router.post("/superadmin/register", verifyToken, requireSuperadmin, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    const superadmin = await AuthService.registerSuperadmin(email, password, name);

    res.status(201).json({
      success: true,
      message: "Superadmin registered successfully",
      superadmin,
    });
  } catch (error) {
    console.error("Error registering superadmin:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register superadmin" });
  }
});

/**
 * POST /api/auth/superadmin/login
 * Login superadmin account
 */
router.post("/superadmin/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await AuthService.loginSuperadmin(email, password);

    res.json({
      success: true,
      token: result.token,
      superadmin: result.superadmin,
    });
  } catch (error) {
    console.error("Error logging in superadmin:", error);
    res.status(401).json({ error: error instanceof Error ? error.message : "Failed to login" });
  }
});

/**
 * POST /api/auth/reseller/login
 */
router.post("/reseller/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const { ResellerService } = await import("@/services/reseller.service");
    const result = await ResellerService.login(email, password);
    res.json({ success: true, token: result.token, reseller: result.reseller });
  } catch (error) {
    console.error("Error logging in reseller:", error);
    res.status(401).json({ error: error instanceof Error ? error.message : "Failed to login" });
  }
});

/**
 * POST /api/auth/forgot-password
 * Public: look up email across merchant / staff / reseller / superadmin and email a 1h reset link.
 */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || "");
    const result = await PasswordResetService.requestReset(email, clientIp(req));
    res.json(result);
  } catch (error) {
    if (error instanceof PasswordResetRateLimitError) {
      return res.status(429).json({ error: error.message });
    }
    console.error("Error requesting password reset:", error);
    res.json({ success: true, message: PasswordResetService.genericSentMessage() });
  }
});

/**
 * GET /api/auth/reset-password/:token
 * Public preview for the set-new-password page.
 */
router.get("/reset-password/:token", async (req: Request, res: Response) => {
  try {
    const preview = await PasswordResetService.previewToken(req.params.token);
    res.json({ success: true, reset: preview });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid or expired reset link",
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Public: consume a reset token and set a new password.
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password, newPassword } = req.body || {};
    const nextPassword = String(newPassword || password || "");
    const result = await PasswordResetService.applyReset(String(token || ""), nextPassword);
    res.json({ success: true, message: "Password updated. You can sign in now.", ...result });
  } catch (error) {
    console.error("Error applying password reset:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to reset password",
    });
  }
});

/**
 * POST /api/auth/change-own-password
 * Authenticated password change for superadmin / reseller / merchant / staff.
 */
router.post("/change-own-password", verifyToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { currentPassword, newPassword } = req.body || {};
    await PasswordResetService.changeOwnPassword(
      req.user,
      String(currentPassword || ""),
      String(newPassword || "")
    );
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing own password:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to change password",
    });
  }
});

/**
 * POST /api/auth/reset-login-password
 * Temporary login-page password reset (merchant / staff / reseller / superadmin).
 * Disable with ALLOW_LOGIN_PASSWORD_RESET=0.
 */
router.post("/reset-login-password", async (req: Request, res: Response) => {
  try {
    const { email, newPassword, role } = req.body || {};
    const allowed = ["merchant", "staff", "reseller", "superadmin"] as const;
    if (!allowed.includes(role)) {
      return res.status(400).json({ error: "role must be merchant, staff, reseller, or superadmin" });
    }
    const result = await AuthService.resetLoginPasswordByEmail(role, String(email || ""), String(newPassword || ""));
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error resetting login password:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to reset password",
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get("/me", verifyToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user.role === "merchant") {
      const merchantId = req.user.merchantId || req.user.id;
      const merchant = await AuthService.getMerchantById(merchantId);
      res.json({
        user: {
          id: merchant.id,
          email: merchant.email,
          name: merchant.name,
          merchantId: merchant.id,
          roleName: "Owner",
          isOwner: true,
          inventoryAddonEnabled: merchant.inventoryAddonEnabled === true,
          inventoryEnabled: merchant.inventoryEnabled === true,
          signageAddonEnabled: merchant.signageAddonEnabled === true,
          signageEnabled: merchant.signageEnabled === true,
          signageScreenLimit: merchant.signageScreenLimit ?? 2,
          storekeeperAddonEnabled: merchant.storekeeperAddonEnabled === true,
        },
        role: "merchant",
      });
      return;
    }

    if (req.user.role === "staff" && req.user.staffId && req.user.merchantId) {
      const { StaffService } = await import("@/services/staff.service");
      const profile = await StaffService.getStaffProfile(req.user.merchantId, req.user.staffId);
      const token = AuthService.generateToken({
        id: profile.id,
        email: profile.email || req.user.email,
        role: "staff",
        merchantId: req.user.merchantId,
        staffId: profile.id,
        name: profile.name,
        roleName: profile.roleName,
        permissions: profile.permissions,
      });
      const { readInventoryAddonEnabled } = await import("@/lib/inventory-addon");
      const { readSignageAddon } = await import("@/lib/signage-addon");
      const inventoryOn = await readInventoryAddonEnabled(req.user.merchantId).catch(() => false);
      const signage = await readSignageAddon(req.user.merchantId).catch(() => ({
        enabled: false,
        screenLimit: 2,
      }));
      const { readStorekeeperAddonEnabled } = await import("@/lib/storekeeper-addon");
      const storekeeperOn = await readStorekeeperAddonEnabled(req.user.merchantId).catch(() => false);
      res.json({
        user: {
          id: profile.id,
          email: profile.email || req.user.email,
          name: profile.name,
          merchantId: req.user.merchantId,
          staffId: profile.id,
          roleName: profile.roleName,
          permissions: profile.permissions,
          isOwner: false,
          inventoryAddonEnabled: inventoryOn,
          inventoryEnabled: inventoryOn,
          signageAddonEnabled: signage.enabled,
          signageEnabled: signage.enabled,
          signageScreenLimit: signage.screenLimit,
          storekeeperAddonEnabled: storekeeperOn,
        },
        role: "staff",
        token,
      });
      return;
    }

    if (req.user.role === "reseller" && req.user.resellerId) {
      res.json({
        user: {
          id: req.user.resellerId,
          email: req.user.email,
          name: req.user.name,
          resellerId: req.user.resellerId,
        },
        role: "reseller",
      });
      return;
    }

    res.json({
      user: { id: req.user.id, email: req.user.email, name: req.user.name },
      role: req.user.role,
    });
  } catch (error) {
    console.error("Error getting user info:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get user info" });
  }
});

/**
 * POST /api/auth/change-password
 * Change password for merchant
 */
router.post("/change-password", verifyToken, requireMerchant, async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    await AuthService.updateMerchantPassword(req.user.id, newPassword);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to change password" });
  }
});

/**
 * GET /api/auth/invite/:token
 * Preview invite (public) — used by set-password page
 */
router.get("/invite/:token", async (req: Request, res: Response) => {
  try {
    const { MerchantInviteService } = await import("@/services/merchant-invite.service");
    const invite = await MerchantInviteService.getInvitePreview(req.params.token);
    res.json({ success: true, invite });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid or expired invite link",
    });
  }
});

/**
 * POST /api/auth/set-password
 * Accept invite token and set merchant password (public)
 */
router.post("/set-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: "token and password are required" });
    }
    const { MerchantInviteService } = await import("@/services/merchant-invite.service");
    const merchant = await MerchantInviteService.acceptInvite(token, password);
    res.json({
      success: true,
      message: "Password created. You can sign in now.",
      merchant,
    });
  } catch (error) {
    console.error("Error setting password from invite:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to set password",
    });
  }
});

export default router;
