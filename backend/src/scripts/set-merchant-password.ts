import dotenv from "dotenv";
import { AuthService } from "../services/auth.service";
import { queryRaw } from "../lib/ensure-merchant-schema";

dotenv.config();

/**
 * Set a merchant owner password by email.
 *
 *   npm run set-merchant-password -- 'YourNewPassword123' info@example.com
 *
 * Does not print the password. Never commit a production password.
 */
async function main() {
  const password = process.argv[2];
  const emailArg = process.argv[3];

  if (!password || password.startsWith("-") || !emailArg) {
    console.error("Usage: npm run set-merchant-password -- '<new-password>' <email>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const email = String(emailArg).trim().toLowerCase();
  const rows = await queryRaw<{ id: string; email: string }>(
    `SELECT id, email FROM merchants WHERE lower(email) = $1 LIMIT 1`,
    [email]
  );
  const merchant = rows[0];
  if (!merchant) {
    console.error(`Merchant not found: ${email}`);
    process.exit(1);
  }

  const passwordHash = await AuthService.hashPassword(password);
  await queryRaw(`UPDATE merchants SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
    passwordHash,
    merchant.id,
  ]);
  console.log(`Merchant password updated for ${merchant.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to set merchant password:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
