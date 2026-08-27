import SubscriptionCatalog from '@/components/subscription/SubscriptionCatalog';

export default function ResellerPackages() {
  return (
    <SubscriptionCatalog
      apiPrefix="reseller"
      title="Subscription packages & add-ons"
      description="Define sellable packages and optional add-ons for your merchants. They subscribe from their billing page."
    />
  );
}
