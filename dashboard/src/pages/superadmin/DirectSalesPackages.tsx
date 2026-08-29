import SubscriptionCatalog from '@/components/subscription/SubscriptionCatalog';

export default function DirectSalesPackages() {
  return (
    <SubscriptionCatalog
      apiPrefix="superadmin"
      title="Chaslay Agency — packages & add-ons"
      description="Manage the subscription catalog sold through Chaslay Agency (agency@chaslay.com). Merchants without an assigned agency use this catalog. Platform does not sell directly."
    />
  );
}
