import dotenv from "dotenv";
import { ensureAllMerchantSchema } from "@/lib/ensure-merchant-schema";

dotenv.config();

async function main() {
  const result = await ensureAllMerchantSchema();
  const stillMissing = [
    ...result.missingAfter,
    ...result.ordersMissing.map((c) => `orders.${c}`),
    ...result.orderItemsMissing.map((c) => `order_items.${c}`),
  ];
  if (stillMissing.length) {
    console.error("[schema-patches] still missing after repair:", stillMissing);
    process.exit(1);
  }
  console.log("[schema-patches] all required columns present");
}

main().catch((err) => {
  console.error("[schema-patches] failed:", err);
  process.exit(1);
});
