import SubscriptionCatalog from '@/components/subscription/SubscriptionCatalog';

export default function DirectSalesPackages() {
  return (
    <SubscriptionCatalog
      apiPrefix="superadmin"
      title="Reborn Direct — packages & add-ons"
      description="Manage the subscription catalog for merchants sold directly by Reborn. Superadmin acts as the platform reseller (Reborn Direct); agency merchants see their agency's catalog instead."
    />
  );
}
