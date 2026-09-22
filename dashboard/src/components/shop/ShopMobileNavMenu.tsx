import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import ShopNavActions from '@/components/shop/ShopNavActions';
import { handleStorefrontNavClick } from '@/chaslay-pagebuilder/utils/anchor-scroll';
import { useI18n } from '@/lib/i18n';

type MenuLink = { label: string; to: string; onClick?: () => void };

/** Compact hamburger menu for shop pages without a CMS navbar. */
export default function ShopMobileNavMenu({
  accountPath,
  topbarLinks = [],
  drawerLinks = [],
  loggedIn = false,
}: {
  accountPath: string;
  topbarLinks?: MenuLink[];
  drawerLinks?: MenuLink[];
  /** @deprecated use topbarLinks + drawerLinks */
  links?: MenuLink[];
  loggedIn?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const primaryLinks = topbarLinks.length ? topbarLinks : links ?? [];
  const extraLinks = drawerLinks.length ? drawerLinks : [];

  const renderLink = (link: MenuLink) =>
    link.onClick ? (
      <button
        key={link.label}
        type="button"
        className="text-left text-sm font-medium text-stone-800"
        onClick={() => {
          link.onClick?.();
          setOpen(false);
        }}
      >
        {link.label}
      </button>
    ) : link.to.startsWith('#') ? (
      <a
        key={link.label}
        href={link.to}
        className="text-sm font-medium text-stone-800"
        onClick={(e) => {
          handleStorefrontNavClick(e, link.to, () => setOpen(false));
        }}
      >
        {link.label}
      </a>
    ) : (
      <Link
        key={link.label}
        to={link.to}
        className="text-sm font-medium text-stone-800"
        onClick={() => setOpen(false)}
      >
        {link.label}
      </Link>
    );

  return (
    <div className="flex items-center gap-1.5">
      <ShopNavActions accountPath={accountPath} iconOnlyLogin loggedIn={loggedIn} />
      <div className="relative">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-100"
          aria-label={open ? t('shopClose') : t('shopMenu')}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
        </button>
        {open ? (
          <>
            <div
              className="fixed inset-0 z-[55] bg-black/30"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 top-full z-[60] mt-1 w-[min(100vw-1.5rem,18rem)] rounded-xl border border-stone-200 bg-white p-4 shadow-xl">
              <div className="flex flex-col gap-3">
                {primaryLinks.length ? (
                  <div className="flex flex-col gap-3 sm:hidden">{primaryLinks.map(renderLink)}</div>
                ) : null}
                {extraLinks.length ? (
                  <>
                    {primaryLinks.length ? (
                      <div className="border-t border-stone-100 pt-3 sm:hidden" aria-hidden />
                    ) : null}
                    <div className="flex flex-col gap-3">{extraLinks.map(renderLink)}</div>
                  </>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
