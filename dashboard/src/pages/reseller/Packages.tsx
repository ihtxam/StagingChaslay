import SubscriptionCatalog from '@/components/subscription/SubscriptionCatalog';

export default function ResellerPackages() {
  return (
    <SubscriptionCatalog
      apiPrefix="reseller"
      title="Packages & add-ons"
      description="Define sellable packages and optional add-ons for your merchants."
      variant="agency"
    />
  );
}
