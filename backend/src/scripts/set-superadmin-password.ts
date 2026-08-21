import dotenv from "dotenv";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { AuthService } from "../services/auth.service";

dotenv.config();

/**
 * Set or create the platform superadmin password.
 *
 *   npm run set-superadmin-password -- 'YourNewPassword123'
 *   npm run set-superadmin-password -- 'YourNewPassword123' admin@chaslay.com
 *
 * Does not print the password. Never commit a production password.
 */
async function main() {
  const password = process.argv[2];
  const emailArg = process.argv[3];
  const email = String(
    emailArg || process.env.SEED_SUPERADMIN_EMAIL || "admin@chaslay.com"
  )
    .trim()
    .toLowerCase();
  const name = process.env.SEED_SUPERADMIN_NAME || "Chaslay Admin";

  if (!password || password.startsWith("-")) {
    console.error("Usage: npm run set-superadmin-password -- '<new-password>' [email]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const db = getDb();
  const passwordHash = await AuthService.hashPassword(password);
  const existing = await db
    .select()
    .from(schema.superadmins)
    .where(sql`lower(${schema.superadmins.email}) = ${email}`)
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.superadmins)
      .set({
        passwordHash,
        isActive: true,
        name:
          existing[0].name && !/manupos|chaslayreborn\s+admin/i.test(existing[0].name)
            ? existing[0].name
            : name,
        updatedAt: new Date(),
      })
      .where(eq(schema.superadmins.id, existing[0].id));
    console.log(`Superadmin password updated for ${existing[0].email}`);
    return;
  }

  const anyAdmin = await db.select().from(schema.superadmins).limit(1);
  if (anyAdmin[0] && !emailArg) {
    await db
      .update(schema.superadmins)
      .set({ passwordHash, isActive: true, updatedAt: new Date() })
      .where(eq(schema.superadmins.id, anyAdmin[0].id));
    console.log(`Superadmin password updated for ${anyAdmin[0].email}`);
    return;
  }

  await AuthService.registerSuperadmin(email, password, name);
  console.log(`Superadmin created: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to set superadmin password:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
