/**
 * Public Google review URL — run: npx tsx backend/src/lib/pos-print-settings.google-review.test.ts
 */
import assert from "node:assert/strict";
import { publicGoogleReviewUrl } from "./pos-print-settings";

assert.equal(publicGoogleReviewUrl(null), null);
assert.equal(publicGoogleReviewUrl({}), null);
assert.equal(publicGoogleReviewUrl({ receiptGoogleReviewsUrl: "javascript:alert(1)" }), null);
assert.equal(publicGoogleReviewUrl({ receiptGoogleReviewsUrl: "not-a-url" }), null);
assert.equal(
  publicGoogleReviewUrl({ receiptGoogleReviewsUrl: "https://g.page/r/demo/review" }),
  "https://g.page/r/demo/review"
);
assert.equal(
  publicGoogleReviewUrl({
    receiptGoogleReviewsUrl: "https://search.google.com/local/writereview?placeid=ChIJdemo",
  }),
  "https://search.google.com/local/writereview?placeid=ChIJdemo"
);

console.log("pos-print-settings.google-review.test.ts ok");
