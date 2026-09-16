import type { ReactNode } from 'react';

/** Slim sticky bar for language switcher + login above shop/CMS headers. */
export default function ShopUtilityTopBar({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`shop-utility-topbar relative z-[60] overflow-visible border-b border-stone-200 bg-white/95 backdrop-blur-sm ${className}`}
    >
      <div className="flex h-10 items-center justify-end gap-2 px-4 sm:px-6">{children}</div>
    </div>
  );
}
