/** Owner.com-style SEO: write title/description from the live catalog. */

export function seoFromCatalog(opts: {
  businessName: string;
  city?: string | null;
  cuisineHint?: string | null;
  productNames: string[];
}): { title: string; description: string } {
  const name = String(opts.businessName || "Restaurant").trim().slice(0, 80);
  const city = String(opts.city || "").trim().slice(0, 40);
  const dishes = opts.productNames
    .map((n) => String(n || "").trim())
    .filter(Boolean)
    .slice(0, 4);
  const dishBit = dishes.length ? dishes.join(", ") : "seasonal dishes";
  const place = city ? ` in ${city}` : "";
  const cuisine = String(opts.cuisineHint || "").trim();
  const title = `${name}${place} — order online`.slice(0, 70);
  const description = (
    cuisine
      ? `${name}${place}: ${cuisine}. Order ${dishBit} for pickup or delivery.`
      : `Order from ${name}${place}. ${dishBit} — pickup or delivery online.`
  ).slice(0, 180);
  return { title, description };
}
