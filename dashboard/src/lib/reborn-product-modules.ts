/** Core Reborn POS capabilities (always listed in Settings → About). */
export const REBORN_CORE_PRODUCT_MODULES: Array<{ id: string; titleKey: string; descriptionKey: string }> =
  [
    { id: 'pos', titleKey: 'aboutModulePosTitle', descriptionKey: 'aboutModulePosDesc' },
    { id: 'shop', titleKey: 'aboutModuleShopTitle', descriptionKey: 'aboutModuleShopDesc' },
    { id: 'orders', titleKey: 'aboutModuleOrdersTitle', descriptionKey: 'aboutModuleOrdersDesc' },
    { id: 'staff', titleKey: 'aboutModuleStaffTitle', descriptionKey: 'aboutModuleStaffDesc' },
    { id: 'reports', titleKey: 'aboutModuleReportsTitle', descriptionKey: 'aboutModuleReportsDesc' },
    { id: 'payments', titleKey: 'aboutModulePaymentsTitle', descriptionKey: 'aboutModulePaymentsDesc' },
    { id: 'loyalty', titleKey: 'aboutModuleLoyaltyTitle', descriptionKey: 'aboutModuleLoyaltyDesc' },
    { id: 'multiLocation', titleKey: 'aboutModuleMultiLocationTitle', descriptionKey: 'aboutModuleMultiLocationDesc' },
  ];
