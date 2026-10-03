import {
  normalizeDietaryTags,
  productMatchesDietaryFilters,
} from "./product-dietary";

const tags = normalizeDietaryTags(["vegan", "gluten_free", "invalid"]);
if (tags.length !== 2 || !tags.includes("vegan")) {
  throw new Error("normalize failed");
}

if (!productMatchesDietaryFilters(["vegan", "gluten_free"], ["vegan"])) {
  throw new Error("single filter should match");
}
if (productMatchesDietaryFilters(["vegan"], ["vegan", "gluten_free"])) {
  throw new Error("AND filter should fail");
}

console.log("product-dietary.test.ts OK");
