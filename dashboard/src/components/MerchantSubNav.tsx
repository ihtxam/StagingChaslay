import { Link, useLocation } from 'react-router-dom';
import type { SidebarLeaf, SidebarNavEntry } from '@/components/Sidebar';

function isPathActive(pathname: string, itemPath?: string, search = ''): boolean {
  if (!itemPath) return false;
  const [basePath, query = ''] = itemPath.split('?');
  const isRoot = basePath === '/merchant';
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

function activeGroup(menuItems: SidebarNavEntry[], pathname: string, search: string) {
  for (const entry of menuItems) {
    if (!entry.id || !entry.children?.length) continue;
    if (entry.children.some((c) => isPathActive(pathname, c.path, search))) return entry;
  }
  return null;
}

export default function MerchantSubNav({ menuItems }: { menuItems: SidebarNavEntry[] }) {
  const location = useLocation();
  const group = activeGroup(menuItems, location.pathname, location.search);
  const children = group?.children?.filter(Boolean) ?? [];
  if (!group || !children.length) return null;

  return (
    <aside className="panel-subnav hidden lg:flex w-52 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {group.label}
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {children.map((child: SidebarLeaf, idx) => {
          if (child.heading || !child.path) {
            return (
              <p
                key={`h-${child.label}-${idx}`}
                className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] first:pt-1"
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
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--bg-muted)] text-[var(--text)] ring-1 ring-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
              }`}
            >
              <span className="opacity-80">{child.icon}</span>
              <span className="truncate">{child.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
