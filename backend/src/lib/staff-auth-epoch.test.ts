import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "@/services/auth.service";

test("staff JWT without authEpoch is rejected when merchant epoch is newer", async () => {
  const merchantId = "00000000-0000-4000-8000-000000000001";
  const withoutEpoch = AuthService.generateToken({
    id: "staff-1",
    email: "bar@example.com",
    role: "staff",
    merchantId,
    staffId: "staff-1",
    name: "Bar",
    roleName: "Waiter",
    permissions: ["USE_WEBPOS"],
  });
  const payload = AuthService.verifyToken(withoutEpoch);
  assert.equal(payload.authEpoch, undefined);

  const original = AuthService.getMerchantAuthEpoch;
  AuthService.getMerchantAuthEpoch = async () => 4;
  try {
    await assert.rejects(
      () => AuthService.assertMerchantTokenEpoch(payload),
      /Session revoked/
    );
  } finally {
    AuthService.getMerchantAuthEpoch = original;
  }
});

test("staff JWT with matching authEpoch passes epoch check", async () => {
  const merchantId = "00000000-0000-4000-8000-000000000002";
  const withEpoch = AuthService.generateToken({
    id: "staff-2",
    email: "bar@example.com",
    role: "staff",
    merchantId,
    staffId: "staff-2",
    name: "Bar",
    roleName: "Waiter",
    permissions: ["USE_WEBPOS"],
    authEpoch: 4,
  });
  const payload = AuthService.verifyToken(withEpoch);
  const original = AuthService.getMerchantAuthEpoch;
  AuthService.getMerchantAuthEpoch = async () => 4;
  try {
    await AuthService.assertMerchantTokenEpoch(payload);
  } finally {
    AuthService.getMerchantAuthEpoch = original;
  }
});
