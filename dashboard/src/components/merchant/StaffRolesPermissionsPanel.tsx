import { Fragment, useMemo, useState } from 'react';
import { Search, Shield } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { staffRoleDisplayName, type Permission } from '@/lib/permissions';

export type StaffRoleRow = {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
};

type Props = {
  roles: StaffRoleRow[];
  visiblePermissions: Permission[];
  onEditRole: (role: StaffRoleRow) => void;
};

export default function StaffRolesPermissionsPanel({
  roles,
  visiblePermissions,
  onEditRole,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, query]);

  return (
    <div className="space-y-4">
      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          className="input w-full pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('staffRolesSearchPlaceholder')}
        />
      </label>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--bg-muted)]/60 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-2.5">{t('staffRole')}</th>
              <th className="px-4 py-2.5">{t('staffPermissionsMatrix')}</th>
              <th className="px-4 py-2.5 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((role) => {
              const permSet = new Set(role.permissions);
              const expanded = expandedId === role.id;
              return (
                <Fragment key={role.id}>
                  <tr className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                          <Shield className="h-4 w-4" aria-hidden />
                        </span>
                        <div>
                          <p className="font-semibold">{staffRoleDisplayName(role.name, t)}</p>
                          {role.isSystem ? (
                            <p className="text-xs text-[var(--text-muted)]">{t('staffSystemProfile')}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left text-teal-800 underline-offset-2 hover:underline"
                        onClick={() => setExpandedId(expanded ? null : role.id)}
                      >
                        {t('staffPermissionsCount').replace('{count}', String(role.permissions.length))}
                        {expanded ? ` · ${t('staffPermissionsHideMatrix')}` : ` · ${t('staffPermissionsShowMatrix')}`}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-muted)]"
                        onClick={() => onEditRole(role)}
                      >
                        {t('staffEditPermissions')}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-t border-[var(--border)] bg-[var(--bg-muted)]/30">
                      <td colSpan={3} className="px-4 py-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {visiblePermissions.map((p) => (
                            <label
                              key={p}
                              className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs"
                            >
                              <input type="checkbox" readOnly checked={permSet.has(p)} className="mt-0.5" />
                              <span>{t(`perm_${p}`)}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!filtered.length ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">{t('staffNoMatches')}</p>
        ) : null}
      </div>
    </div>
  );
}
