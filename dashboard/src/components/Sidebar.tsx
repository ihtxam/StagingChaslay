import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, LogOut, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { APP_NAME } from '@/lib/brand';
import { useI18n, type Locale } from '@/lib/i18n';

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
  /** Distinguishes open-state persistence per panel (e.g. merchant / superadmin). */
  panelKey?: string;
  /** Optional prominent action shown under panel branding (e.g. POS). */
  quickAction?: {
    label: string;
    path: string;
  } | null;
  language?: Locale;
  onLanguageChange?: (locale: Locale) => void;
}

const STORAGE_PREFIX = 'sidebar_groups_open:';

function isPathActive(pathname: string, itemPath?: string): boolean {
  if (!itemPath) return false;
  const isRoot = itemPath === '/merchant' || itemPath === '/superadmin' || itemPath === '/reseller';
  if (isRoot) return pathname === itemPath;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
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
  panelKey = 'default',
  quickAction = null,
  language,
  onLanguageChange,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const impersonating = useAuthStore((s) => s.impersonating);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);

  const roleLabel = impersonating
    ? 'Merchant (SA)'
    : user?.isOwner
      ? t('staffOwnerTitle')
      : user?.roleName || user?.role || '';

  const activeGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of menuItems) {
      if (!entry.id || !entry.children?.length) continue;
      if (entry.children.some((c) => isPathActive(location.pathname, c.path))) {
        ids.add(entry.id);
      }
    }
    return ids;
  }, [menuItems, location.pathname]);

  // Accordion: at most one group open (keeps the sidebar short).
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
        ? 'bg-teal-900 text-white shadow-sm'
        : 'text-teal-50/95 hover:bg-teal-900/45 hover:text-white'
    }`;

  return (
    <>
      <aside
        className={`panel-sidebar ${
          isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        } fixed lg:relative lg:translate-x-0 lg:pointer-events-auto w-56 h-dvh max-h-dvh lg:h-full lg:max-h-full transition-transform duration-200 z-40 flex flex-col shrink-0`}
      >
        <div className="panel-sidebar-divider px-4 py-3 border-b flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white">{APP_NAME}</h1>
            <p className="text-[11px] text-teal-100/70 mt-0.5">{t('panel')}</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="lg:hidden p-1.5 rounded-md text-teal-50/95 hover:bg-teal-900/45 hover:text-white"
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
              className={`flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors shadow-lg ${
                isPathActive(location.pathname, quickAction.path)
                  ? 'bg-emerald-400 text-white ring-2 ring-emerald-300/60'
                  : 'bg-[#22c55e] hover:bg-emerald-400 text-white'
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                🖥️
              </span>
              <span>{quickAction.label}</span>
            </Link>
          </div>
        )}

        <nav className="flex-1 min-h-0 p-2 space-y-0.5 overflow-y-auto">
          {menuItems.map((entry) => {
            const children = entry.children?.filter(Boolean) ?? [];

            if (children.length === 0 && entry.path) {
              const active = isPathActive(location.pathname, entry.path);
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
              const active = isPathActive(location.pathname, only.path);
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

            const groupId = entry.id || entry.label;
            const isOpenGroup = openGroups.has(groupId);
            const parentActive = children.some((c) => isPathActive(location.pathname, c.path));

            return (
              <div key={groupId} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(groupId)}
                  aria-expanded={isOpenGroup}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                    parentActive
                      ? 'bg-teal-900/90 text-white shadow-sm'
                      : 'text-teal-50/95 hover:bg-teal-900/45 hover:text-white'
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
                            className="px-2.5 pt-2 pb-0.5 pl-9 text-[10px] font-semibold uppercase tracking-wide text-teal-200/55"
                          >
                            {child.label}
                          </p>
                        );
                      }
                      const active = isPathActive(location.pathname, child.path);
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

        <div className="panel-sidebar-footer p-3 border-t space-y-2 shrink-0">
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

          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-900 text-teal-50">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-[11px] text-teal-100/70" title={roleLabel}>
                {roleLabel}
              </p>
            </div>
          </div>

          {onLanguageChange && (
            <select
              className="w-full rounded-md border border-white/25 bg-teal-900/40 px-2.5 py-1.5 text-xs text-teal-50"
              value={language || 'en'}
              onChange={(e) => onLanguageChange(e.target.value as Locale)}
              aria-label={t('language')}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 lg:hidden z-30" onClick={onToggle} />
      )}
    </>
  );
}
