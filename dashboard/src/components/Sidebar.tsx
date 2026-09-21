import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, CreditCard, LifeBuoy, LogOut, Settings, Store, User, UserCircle2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { displaySidebarAccountName, displaySidebarShopName, REBORN_LOGO_WHITE } from '@/lib/brand';
import { useI18n, type Locale } from '@/lib/i18n';
import StaffSwitchButton, { type StaffSwitchButtonHandle } from '@/components/StaffSwitchButton';

export interface SidebarLeaf {
  label: string;
  path?: string;
  icon?: ReactNode;
  /** Non-clickable section label inside a group (OrderPin-style). */
  heading?: boolean;
}

export interface SidebarNavEntry {
  /** Stable id for expandable groups (sessionStorage). */
  id?: string;
  label: string;
  path?: string;
  icon: ReactNode;
  children?: SidebarLeaf[];
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  menuItems: SidebarNavEntry[];
  /** Icon-only primary rail on desktop (pair with MerchantSubNav). */
  railMode?: boolean;
  /** Distinguishes open-state persistence per panel (e.g. merchant / superadmin). */
  panelKey?: string;
  showStaffSwitch?: boolean;
  /** Active register user (PIN session when clocked in, else JWT account). */
  registerDisplay?: { name: string; roleLabel: string };
  /** Optional prominent action shown under panel branding (e.g. POS). */
  quickAction?: {
    label: string;
    path: string;
  } | null;
  language?: Locale;
  onLanguageChange?: (locale: Locale) => void;
  /** Cliavo-style profile menu: Settings, Billing, Support, language, Sign out */
  profileMenu?: {
    settingsPath?: string;
    billingPath?: string;
    supportPath?: string;
  };
  /** Merchant shop name in the sidebar header (defaults to "Shop"). */
  shopName?: string | null;
  /** Optional Reborn platform shop shortcut pinned above the footer. */
  shopPath?: string | null;
}

const STORAGE_PREFIX = 'sidebar_groups_open:';

function isPathActive(pathname: string, itemPath?: string, search = ''): boolean {
  if (!itemPath) return false;
  const [basePath, query = ''] = itemPath.split('?');
  const isRoot = basePath === '/merchant' || basePath === '/superadmin' || basePath === '/reseller';
  const pathMatches = isRoot
    ? pathname === basePath
    : pathname === basePath || pathname.startsWith(`${basePath}/`);
  if (!pathMatches) return false;
  if (!query) return true;
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(search);
  for (const [key, value] of want.entries()) {
    if (have.get(key) !== value) return false;
  }
  return true;
}

function loadOpenGroups(panelKey: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + panelKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveOpenGroups(panelKey: string, open: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + panelKey, JSON.stringify([...open]));
  } catch {
    /* ignore quota / private mode */
  }
}

export default function Sidebar({
  isOpen,
  onToggle,
  menuItems,
  railMode = false,
  panelKey = 'default',
  registerDisplay,
  showStaffSwitch = false,
  quickAction = null,
  language,
  onLanguageChange,
  profileMenu,
  shopName,
  shopPath,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const impersonating = useAuthStore((s) => s.impersonating);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);

  const roleLabel =
    registerDisplay?.roleLabel ||
    (impersonating
      ? 'Merchant (SA)'
      : user?.isOwner
        ? t('staffOwnerTitle')
        : user?.roleName || user?.role || '');

  const accountName = displaySidebarAccountName(registerDisplay?.name || user?.name);
  const headerShopName = displaySidebarShopName(shopName);

  const activeGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of menuItems) {
      if (!entry.id || !entry.children?.length) continue;
      if (entry.children.some((c) => isPathActive(location.pathname, c.path, location.search))) {
        ids.add(entry.id);
      }
    }
    return ids;
  }, [menuItems, location.pathname]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const stored = loadOpenGroups(panelKey);
    const activeId = [...activeGroupIds][0];
    if (activeId) return new Set([activeId]);
    const firstStored = [...stored][0];
    return firstStored ? new Set([firstStored]) : new Set();
  });

  useEffect(() => {
    const activeId = [...activeGroupIds][0];
    if (!activeId) return;
    setOpenGroups((prev) => {
      if (prev.size === 1 && prev.has(activeId)) return prev;
      const next = new Set([activeId]);
      saveOpenGroups(panelKey, next);
      return next;
    });
  }, [activeGroupIds, panelKey]);

  const [profileOpen, setProfileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const staffSwitchRef = useRef<StaffSwitchButtonHandle>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDoc, true);
    return () => document.removeEventListener('pointerdown', onDoc, true);
  }, [profileOpen]);

  useEffect(() => {
    if (openGroups.size === 0) return;
    const onDoc = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        const next = new Set<string>();
        saveOpenGroups(panelKey, next);
        setOpenGroups(next);
      }
    };
    document.addEventListener('pointerdown', onDoc, true);
    return () => document.removeEventListener('pointerdown', onDoc, true);
  }, [openGroups, panelKey]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      // Opening a group closes every other; clicking the open one collapses all.
      const next = prev.has(id) ? new Set<string>() : new Set([id]);
      saveOpenGroups(panelKey, next);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const backToAdmin = () => {
    const returnUserRaw = sessionStorage.getItem('sa_return_user');
    let returnRole: string | null = null;
    try {
      returnRole = returnUserRaw ? (JSON.parse(returnUserRaw) as { role?: string }).role || null : null;
    } catch {
      returnRole = null;
    }
    if (!stopImpersonation()) {
      toast.error('Admin session expired — please sign in again');
      navigate('/login');
      return;
    }
    if (returnRole === 'reseller') {
      toast.success('Back to reseller');
      navigate('/reseller/merchants');
    } else {
      toast.success('Back to Superadmin');
      navigate('/superadmin/merchants');
    }
  };

  const closeMobile = () => {
    if (window.innerWidth < 1024) onToggle();
  };

  // Closed off-canvas drawer must not trap touch/scroll on mobile.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const lock = isOpen && mq.matches;
    if (!lock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const linkClass = (active: boolean, nested = false) =>
    `flex items-center gap-2.5 rounded-md text-sm transition-colors ${
      nested ? 'px-2.5 py-1.5 pl-9' : 'px-2.5 py-2'
    } ${
      active
        ? 'bg-black/25 text-white shadow-sm'
        : 'text-white/90 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <>
      <aside
        className={`panel-sidebar ${
          isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        } fixed lg:relative lg:translate-x-0 lg:pointer-events-auto ${
          railMode ? 'w-[4.5rem] lg:w-[4.5rem]' : 'w-56'
        } h-dvh max-h-dvh lg:h-full lg:max-h-full transition-transform duration-200 z-40 flex flex-col shrink-0`}
      >
        <div className="panel-sidebar-divider px-4 py-3 border-b flex items-center justify-between shrink-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-9 w-9 shrink-0 overflow-hidden" aria-hidden>
              <img
                src={REBORN_LOGO_WHITE}
                alt=""
                className="h-9 w-auto max-w-none object-contain object-left"
              />
            </div>
            <div className="min-w-0">
              {!railMode ? (
                <>
                  <h1 className="text-base font-semibold tracking-tight text-white truncate">{headerShopName}</h1>
                  <p className="text-[11px] text-white/70 mt-0.5">{t('panel')}</p>
                </>
              ) : (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">{t('panel')}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="lg:hidden p-1.5 rounded-md text-white/90 hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {quickAction && (
          <div className="panel-sidebar-divider px-3 pt-3 pb-3 border-b shrink-0">
            <Link
              to={quickAction.path}
              onClick={closeMobile}
              aria-label={quickAction.label}
              title={quickAction.label}
              className={`block w-full rounded-lg transition-colors shadow-lg ${
                railMode ? 'h-11' : 'h-12'
              } ${
                isPathActive(location.pathname, quickAction.path, location.search)
                  ? 'bg-emerald-400 ring-2 ring-emerald-300/60'
                  : 'bg-[#22c55e] hover:bg-emerald-400'
              }`}
            />
          </div>
        )}

        <nav ref={navRef} className="flex-1 min-h-0 p-2 space-y-0.5 overflow-y-auto">
          {menuItems.map((entry) => {
            const children = entry.children?.filter(Boolean) ?? [];

            if (railMode && children.length > 0) {
              const groupId = entry.id || entry.label;
              const parentActive = children.some((c) =>
                isPathActive(location.pathname, c.path, location.search)
              );
              const firstPath = children.find((c) => c.path)?.path || entry.path;
              if (!firstPath) return null;
              return (
                <Link
                  key={groupId}
                  to={firstPath}
                  onClick={closeMobile}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold leading-tight transition-colors ${
                    parentActive
                      ? 'bg-black/25 text-white shadow-sm'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`}
                  title={entry.label}
                >
                  <span className="text-base leading-none">{entry.icon}</span>
                  <span className="max-w-full truncate text-center">{entry.label.split(' ')[0]}</span>
                </Link>
              );
            }

            if (children.length === 0 && entry.path) {
              const active = isPathActive(location.pathname, entry.path, location.search);
              return (
                <Link
                  key={entry.path}
                  to={entry.path}
                  onClick={closeMobile}
                  className={linkClass(active)}
                >
                  <span className="inline-flex w-5 shrink-0 items-center justify-center opacity-80 [&_svg]:h-4 [&_svg]:w-4">
                    {entry.icon}
                  </span>
                  <span className="font-medium truncate">{entry.label}</span>
                </Link>
              );
            }

            if (children.length === 1 && !entry.id) {
              const only = children[0];
              const active = isPathActive(location.pathname, only.path, location.search);
              return (
                <Link
                  key={only.path}
                  to={only.path}
                  onClick={closeMobile}
                  className={linkClass(active)}
                >
                  <span className="inline-flex w-5 shrink-0 items-center justify-center opacity-80 [&_svg]:h-4 [&_svg]:w-4">
                    {only.icon || entry.icon}
                  </span>
                  <span className="font-medium truncate">{only.label}</span>
                </Link>
              );
            }

            if (children.length === 0) return null;

            if (railMode) return null;

            const groupId = entry.id || entry.label;
            const isOpenGroup = openGroups.has(groupId);
            const parentActive = children.some((c) => isPathActive(location.pathname, c.path, location.search));

            return (
              <div key={groupId} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(groupId)}
                  aria-expanded={isOpenGroup}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                    parentActive
                      ? 'bg-black/25 text-white shadow-sm'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="inline-flex w-5 shrink-0 items-center justify-center opacity-80 [&_svg]:h-4 [&_svg]:w-4">
                    {entry.icon}
                  </span>
                  <span className="font-medium truncate flex-1 text-left">{entry.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 opacity-70 transition-transform ${
                      isOpenGroup ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
                {isOpenGroup && (
                  <div className="space-y-0.5">
                    {children.map((child, idx) => {
                      if (child.heading || !child.path) {
                        return (
                          <p
                            key={`h-${child.label}-${idx}`}
                            className="px-2.5 pt-2 pb-0.5 pl-9 text-[10px] font-semibold uppercase tracking-wide text-white/55"
                          >
                            {child.label}
                          </p>
                        );
                      }
                      const active = isPathActive(location.pathname, child.path, location.search);
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={closeMobile}
                          className={linkClass(active, true)}
                        >
                          <span className="inline-flex w-4 shrink-0 items-center justify-center opacity-80 [&_svg]:h-3.5 [&_svg]:w-3.5">
                            {child.icon}
                          </span>
                          <span className="font-medium truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div
          className={`panel-sidebar-footer relative z-10 p-3 border-t space-y-2 shrink-0 ${
            railMode ? 'overflow-visible' : 'overflow-x-hidden'
          }`}
        >
          {shopPath ? (
            <Link
              to={shopPath}
              onClick={closeMobile}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                isPathActive(location.pathname, shopPath, location.search)
                  ? 'bg-black/25 text-white shadow-sm'
                  : 'text-white/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex w-5 shrink-0 items-center justify-center opacity-80 [&_svg]:h-4 [&_svg]:w-4">
                <Store />
              </span>
              <span className="font-medium truncate">{t('platformShopTitle')}</span>
            </Link>
          ) : null}

          {profileMenu?.settingsPath &&
          !isPathActive(location.pathname, profileMenu.settingsPath, location.search) ? (
            <Link
              to={profileMenu.settingsPath}
              onClick={closeMobile}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                'text-white/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex w-5 shrink-0 items-center justify-center opacity-80 [&_svg]:h-4 [&_svg]:w-4">
                <Settings />
              </span>
              <span className="font-medium truncate">{t('settings')}</span>
            </Link>
          ) : null}

          {impersonating && (
            <button
              type="button"
              onClick={backToAdmin}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('backToSuperadmin')}
            </button>
          )}

          {profileMenu ? (
            <div className={`relative ${railMode ? 'flex justify-center' : ''}`} ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-label={accountName}
                title={accountName}
                className={`rounded-md hover:bg-white/10 transition-colors ${
                  railMode
                    ? 'flex h-10 w-10 items-center justify-center'
                    : 'flex w-full items-center gap-2.5 px-2 py-2'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/30 text-white">
                  <User className="h-4 w-4" />
                </div>
                {!railMode ? (
                  <>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-white">{accountName}</p>
                      <p className="truncate text-[11px] text-white/70">{roleLabel}</p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-white/70 shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                    />
                  </>
                ) : null}
              </button>
              {profileOpen ? (
                <div
                  className={
                    railMode
                      ? 'absolute bottom-0 left-full z-[60] ml-2 w-56 overflow-hidden rounded-lg border border-white/15 bg-[var(--brand-burgundy)] shadow-xl'
                      : 'absolute bottom-full left-0 right-0 z-50 mb-1 max-h-[min(50vh,16rem)] overflow-y-auto overscroll-y-contain rounded-lg border border-white/15 bg-[var(--brand-burgundy)] shadow-xl lg:static lg:bottom-auto lg:z-auto lg:mb-0 lg:mt-1 lg:max-h-none lg:overflow-hidden lg:bg-black/35'
                  }
                  role="menu"
                >
                  {showStaffSwitch ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-white/90 hover:bg-white/10"
                      onClick={() => staffSwitchRef.current?.open()}
                      title={t('webPosSwitchUser')}
                    >
                      <UserCircle2 className="w-4 h-4" />
                      {t('webPosSwitchUser')}
                    </button>
                  ) : null}
                  {profileMenu.supportPath ? (
                    <Link
                      to={profileMenu.supportPath}
                      onClick={() => {
                        setProfileOpen(false);
                        closeMobile();
                      }}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-white/90 hover:bg-white/10"
                    >
                      <LifeBuoy className="w-4 h-4" />
                      {t('support')}
                    </Link>
                  ) : null}
                  {profileMenu.billingPath ? (
                    <Link
                      to={profileMenu.billingPath}
                      onClick={() => {
                        setProfileOpen(false);
                        closeMobile();
                      }}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-white/90 hover:bg-white/10"
                    >
                      <CreditCard className="w-4 h-4" />
                      {t('billing')}
                    </Link>
                  ) : null}
                  {onLanguageChange ? (
                    <div className="px-3 py-2.5 border-t border-white/10">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60 mb-2">
                        {t('language')}
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        {([
                          { code: 'en' as Locale, label: 'EN' },
                          { code: 'fr' as Locale, label: 'FR' },
                          { code: 'de' as Locale, label: 'DE' },
                        ]).map(({ code, label }) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => onLanguageChange(code)}
                            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                              (language || 'en') === code
                                ? 'bg-white/25 text-white'
                                : 'bg-black/20 text-white/80 hover:bg-black/35'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-rose-200 hover:bg-rose-900/40 border-t border-white/10"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('logout')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/30 text-white">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{accountName}</p>
                <p className="truncate text-[11px] text-white/70" title={roleLabel}>
                  {roleLabel}
                </p>
              </div>
            </div>
          )}

          {onLanguageChange && !profileMenu ? (
            <select
              className="w-full rounded-md border border-white/25 bg-black/25 px-2.5 py-1.5 text-xs text-white/90"
              value={language || 'en'}
              onChange={(e) => onLanguageChange(e.target.value as Locale)}
              aria-label={t('language')}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          ) : null}

          {!profileMenu ? (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('logout')}
            </button>
          ) : null}
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 lg:hidden z-30" onClick={onToggle} />
      )}

      {showStaffSwitch ? (
        <StaffSwitchButton ref={staffSwitchRef} variant="menu" showTrigger={false} />
      ) : null}
    </>
  );
}
