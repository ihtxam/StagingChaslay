"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const auth_service_1 = require("../services/auth.service");
dotenv_1.default.config();
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
    const email = String(emailArg || process.env.SEED_SUPERADMIN_EMAIL || "admin@chaslay.com")
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
    const db = (0, db_1.getDb)();
    const passwordHash = await auth_service_1.AuthService.hashPassword(password);
    const existing = await db
        .select()
        .from(db_1.schema.superadmins)
        .where((0, drizzle_orm_1.sql) `lower(${db_1.schema.superadmins.email}) = ${email}`)
        .limit(1);
    if (existing[0]) {
        await db
            .update(db_1.schema.superadmins)
            .set({
            passwordHash,
            isActive: true,
            name: existing[0].name && !/manupos|chaslayreborn\s+admin/i.test(existing[0].name)
                ? existing[0].name
                : name,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.superadmins.id, existing[0].id));
        console.log(`Superadmin password updated for ${existing[0].email}`);
        return;
    }
    const anyAdmin = await db.select().from(db_1.schema.superadmins).limit(1);
    if (anyAdmin[0] && !emailArg) {
        await db
            .update(db_1.schema.superadmins)
            .set({ passwordHash, isActive: true, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.superadmins.id, anyAdmin[0].id));
        console.log(`Superadmin password updated for ${anyAdmin[0].email}`);
        return;
    }
    await auth_service_1.AuthService.registerSuperadmin(email, password, name);
    console.log(`Superadmin created: ${email}`);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error("Failed to set superadmin password:", error instanceof Error ? error.message : error);
    process.exit(1);
});
//# sourceMappingURL=set-superadmin-password.js.map