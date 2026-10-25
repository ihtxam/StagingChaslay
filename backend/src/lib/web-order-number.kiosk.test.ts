import assert from "node:assert/strict";
import { merchantWebOrderCode } from "@/lib/web-order-number";

assert.equal(merchantWebOrderCode("merchant-jags-abc"), "JAGS");
