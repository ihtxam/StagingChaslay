import { lazy, type ComponentType } from 'react';

/** Deferred route modules — static imports here would run the full merchant graph at Dashboard chunk init (TDZ). */

export function merchantLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(factory);
}

export const Sidebar = merchantLazy(() => import('@/components/Sidebar'));
export const MerchantSubNav = merchantLazy(() => import('@/components/MerchantSubNav'));
export const Header = merchantLazy(() => import('@/components/Header'));

export const Overview = merchantLazy(() => import('./Overview'));
export const Orders = merchantLazy(() => import('./Orders'));
export const Products = merchantLazy(() => import('./Products'));
export const CateringGuidePage = merchantLazy(() => import('./CateringGuidePage'));
export const InventoryLayout = merchantLazy(() => import('./inventory/InventoryLayout'));
export const InventoryHomePage = merchantLazy(() =>
  import('./inventory/home-page').then((m) => ({ default: m.InventoryHomePage }))
);
export const InventoryListPage = merchantLazy(() =>
  import('./inventory/ops-pages').then((m) => ({ default: m.InventoryListPage }))
);
export const InboundStockPage = merchantLazy(() =>
  import('./inventory/ops-pages').then((m) => ({ default: m.InboundStockPage }))
);
export const OutboundStockPage = merchantLazy(() =>
  import('./inventory/ops-pages').then((m) => ({ default: m.OutboundStockPage }))
);
export const StockCountingPage = merchantLazy(() =>
  import('./inventory/ops-pages').then((m) => ({ default: m.StockCountingPage }))
);
export const StockHistoryPage = merchantLazy(() =>
  import('./inventory/ops-pages').then((m) => ({ default: m.StockHistoryPage }))
);
export const StockItemsPage = merchantLazy(() =>
  import('./inventory/settings-pages').then((m) => ({ default: m.StockItemsPage }))
);
export const StockCategoriesPage = merchantLazy(() =>
  import('./inventory/settings-pages').then((m) => ({ default: m.StockCategoriesPage }))
);
export const CookbookPage = merchantLazy(() =>
  import('./inventory/settings-pages').then((m) => ({ default: m.CookbookPage }))
);
export const SuppliersPage = merchantLazy(() =>
  import('./inventory/settings-pages').then((m) => ({ default: m.SuppliersPage }))
);
export const UnitsPage = merchantLazy(() =>
  import('./inventory/settings-pages').then((m) => ({ default: m.UnitsPage }))
);
export const InventoryReportPage = merchantLazy(() =>
  import('./inventory/report-pages').then((m) => ({ default: m.InventoryReportPage }))
);
export const ConsumptionReportPage = merchantLazy(() =>
  import('./inventory/report-pages').then((m) => ({ default: m.ConsumptionReportPage }))
);
export const DeadStockReportPage = merchantLazy(() =>
  import('./inventory/report-pages').then((m) => ({ default: m.DeadStockReportPage }))
);
export const InventoryTransfersPage = merchantLazy(() => import('./inventory/InventoryTransfersPage'));
export const Categories = merchantLazy(() => import('./Categories'));
export const Modifiers = merchantLazy(() => import('./Modifiers'));
export const Customers = merchantLazy(() => import('./Customers'));
export const Members = merchantLazy(() => import('./Members'));
export const Loyalty = merchantLazy(() => import('./Loyalty'));
export const Offers = merchantLazy(() => import('./Offers'));
export const Vouchers = merchantLazy(() => import('./Vouchers'));
export const Terminals = merchantLazy(() => import('./Terminals'));
export const Settings = merchantLazy(() => import('./Settings'));
export const DesktopSettings = merchantLazy(() => import('./DesktopSettings'));
export const DesktopStorePage = merchantLazy(() => import('./DesktopStorePage'));
export const DesktopTimingsPage = merchantLazy(() => import('./DesktopTimingsPage'));
export const PlatformShop = merchantLazy(() => import('./PlatformShop'));
export const Support = merchantLazy(() => import('./Support'));
export const Billing = merchantLazy(() => import('./Billing'));
export const OnlineShop = merchantLazy(() => import('./OnlineShop'));
export const Reservations = merchantLazy(() => import('./Reservations'));
export const HostStation = merchantLazy(() => import('./HostStation'));
export const PhoneOrders = merchantLazy(() => import('./PhoneOrders'));
export const ReviewsInbox = merchantLazy(() => import('./ReviewsInbox'));
export const Newsletter = merchantLazy(() => import('./Newsletter'));
export const WebPos = merchantLazy(() => import('./WebPos'));
export const WaiterApp = merchantLazy(() => import('./WaiterApp'));
export const DeliveryDriverPage = merchantLazy(() => import('./DeliveryDriver'));
export const StorekeeperApp = merchantLazy(() => import('./StorekeeperApp'));
export const Reports = merchantLazy(() => import('./Reports'));
export const HqDashboardPage = merchantLazy(() => import('./HqDashboard'));
export const HqSyncMenuPage = merchantLazy(() => import('./HqSyncMenuPage'));
export const BulkPricingPage = merchantLazy(() => import('./BulkPricingPage'));
export const ScheduledMenusPage = merchantLazy(() => import('./ScheduledMenusPage'));
export const PizzaBuilderPage = merchantLazy(() => import('./PizzaBuilderPage'));
export const PizzaBuilderEditorPage = merchantLazy(() => import('./PizzaBuilderEditorPage'));
export const OrderCenterApp = merchantLazy(() => import('./OrderCenterApp'));

export const MerchantOrderAlerts = merchantLazy(() => import('@/components/merchant/MerchantOrderAlerts'));
export const WebPosPinModal = merchantLazy(() => import('@/components/WebPosPinModal'));
export const InventoryExpiryAlerts = merchantLazy(() => import('@/components/merchant/InventoryExpiryAlerts'));
export const MerchantTillPrintHub = merchantLazy(() => import('@/components/merchant/MerchantTillPrintHub'));
