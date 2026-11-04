/**
 * Idempotent demo owner login heal (no catalog re-seed).
 * Run: cd backend && npx tsx src/scripts/heal-demo-login.ts
 */
import dotenv from "dotenv";
import { demoMerchantSlugs } from "../lib/demo-merchant-login";
import { healDemoMerchantLogin } from "../lib/demo-merchant-heal";

dotenv.config();

async function main() {
  const result = await healDemoMerchantLogin();
  if (!result) {
    console.error(
      `No demo showcase merchant found. Checked slugs: ${demoMerchantSlugs().join(", ")}`
    );
    process.exit(1);
  }
  console.log("Demo login heal OK:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
