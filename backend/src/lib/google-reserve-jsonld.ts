/** Reserve with Google: FoodEstablishment + ReserveAction pointing at our book. */

export type GoogleReserveJsonLdInput = {
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  reserveUrl: string;
  image?: string | null;
  priceRange?: string | null;
};

export function shopReservationsUrl(opts: {
  shopUrl: string;
  explicitReserveUrl?: string | null;
  publish?: boolean;
}): string | null {
  const explicit = String(opts.explicitReserveUrl || "").trim();
  if (explicit.startsWith("http")) return explicit;
  if (opts.publish === false) return null;
  const base = String(opts.shopUrl || "").replace(/\/+$/, "");
  if (!base.startsWith("http")) return null;
  return `${base}/reservations`;
}

export function buildGoogleReserveJsonLd(input: GoogleReserveJsonLdInput) {
  const street = [input.address, input.city].filter(Boolean).join(", ");
  return {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    name: input.name,
    acceptsReservations: true,
    telephone: input.phone || undefined,
    image: input.image || undefined,
    priceRange: input.priceRange || undefined,
    address: street
      ? {
          "@type": "PostalAddress",
          streetAddress: input.address || undefined,
          addressLocality: input.city || undefined,
          addressCountry: input.country || undefined,
        }
      : undefined,
    potentialAction: {
      "@type": "ReserveAction",
      target: input.reserveUrl,
    },
    url: input.reserveUrl,
  };
}
