"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const product_dietary_1 = require("./product-dietary");
const tags = (0, product_dietary_1.normalizeDietaryTags)(["vegan", "gluten_free", "invalid"]);
if (tags.length !== 2 || !tags.includes("vegan")) {
    throw new Error("normalize failed");
}
if (!(0, product_dietary_1.productMatchesDietaryFilters)(["vegan", "gluten_free"], ["vegan"])) {
    throw new Error("single filter should match");
}
if ((0, product_dietary_1.productMatchesDietaryFilters)(["vegan"], ["vegan", "gluten_free"])) {
    throw new Error("AND filter should fail");
}
console.log("product-dietary.test.ts OK");
//# sourceMappingURL=product-dietary.test.js.map