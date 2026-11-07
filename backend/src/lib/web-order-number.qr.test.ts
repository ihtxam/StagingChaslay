import assert from "node:assert/strict";
import { merchantWebOrderCode } from "@/lib/web-order-number";
import { formatWebOrderNumberDisplay } from "@/lib/web-order-number";
assert.equal(merchantWebOrderCode("merchant-veg-1234"), "1234");
assert.equal(formatWebOrderNumberDisplay("QR-ADFE-3"), "QR-ADFE-3");
assert.equal(formatWebOrderNumberDisplay("QR-5"), "QR-5");
