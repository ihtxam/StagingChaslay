import { FormEvent, useMemo, useState } from 'react';
import { MoreVertical, Plus, Search, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';
import { staffRoleDisplayName } from '@/lib/permissions';
import { isValidStaffPin, sanitizeStaffPinInput } from '@/lib/staff-pin';

export type StaffRosterRow = {
  id: string;
  name: string;
  email: string | null;
  roleName: string;
  isActive: boolean;
};

type RoleOption = { id: string; name: string };

type Props = {
  staff: StaffRosterRow[];
  roles: RoleOption[];
  onAddUser: (payload: {
    name: string;
    roleId: string;
    pin: string;
    email: string;
    password: string;
    canAccessPanel: boolean;
    pinOnly: boolean;
  }) => Promise<void>;
  onEditUser: (id: string) => void;
  onRemoveUser: (id: string) => void;
  canRemove: (id: string) => boolean;
  headerAction?: React.ReactNode;
};

function statusDot(active: boolean) {
  return active ? 'bg-emerald-500' : 'bg-amber-500';
}

export default function StaffUsersRolesPanel({
  staff,
  roles,
  onAddUser,
  onEditUser,
  onRemoveUser,
  canRemove,
  headerAction,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    roleId: roles[0]?.id || '',
    pin: '',
    email: '',
    password: '',
    canAccessPanel: false,
    pinOnly: true,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((s) => {
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'inactive' && s.isActive) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        s.roleName.toLowerCase().includes(q)
      );
    });
  }, [staff, query, statusFilter]);

  const active = filtered.filter((s) => s.isActive);
  const inactive = filtered.filter((s) => !s.isActive);

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.roleId) return;
    const pin = addForm.pin.trim();
    if (pin && !isValidStaffPin(pin)) {
      toast.error(t('staffPinInvalid'));
      return;
    }
    setAddSaving(true);
    try {
      await onAddUser({
        ...addForm,
        name: addForm.name.trim(),
        pin,
        email: addForm.email.trim(),
        password: addForm.password.trim(),
      });
      setAddOpen(false);
      setAddForm({
        name: '',
        roleId: roles[0]?.id || '',
        pin: '',
        email: '',
        password: '',
        canAccessPanel: false,
        pinOnly: true,
      });
    } finally {
      setAddSaving(false);
    }
  };

  const renderSection = (title: string, dotClass: string, rows: StaffRosterRow[], tinted = false) => {
    if (!rows.length) return null;
    return (
      <div
        className={`overflow-hidden rounded-xl border border-[var(--border)] ${
          tinted ? 'bg-amber-50/40' : 'bg-[var(--bg-elevated)]'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5 text-sm font-semibold">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
          {title}
          <span className="text-[var(--text-muted)] font-normal">({rows.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--bg-muted)]/60 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-2.5">{t('staffColUser')}</th>
                <th className="px-4 py-2.5">{t('staffRole')}</th>
                <th className="px-4 py-2.5">{t('staffColContact')}</th>
                <th className="px-4 py-2.5">{t('status')}</th>
                <th className="px-4 py-2.5">{t('staffColLastActivity')}</th>
                <th className="px-4 py-2.5 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: '#13A99A' }}
                      >
                        <UserRound className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{s.name}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{s.roleName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        s.isActive
                          ? 'bg-teal-50 text-teal-800'
                          : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                      }`}
                    >
                      {staffRoleDisplayName(s.roleName, t)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{s.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(s.isActive)}`} />
                      {s.isActive ? t('staffStatusActive') : t('staffStatusInactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">—</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-muted)]"
                      onClick={() => onEditUser(s.id)}
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                      aria-label={t('moreActions')}
                      onClick={() => {
                        if (canRemove(s.id) && confirm(t('staffRemoveConfirm'))) {
                          void onRemoveUser(s.id);
                        }
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {headerAction ?? (
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2 self-end"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t('staffAddUser')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input w-full pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('staffSearchPlaceholder')}
          />
        </label>
        <select
          className="input sm:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">{t('staffFilterAllStatuses')}</option>
          <option value="active">{t('staffStatusActive')}</option>
          <option value="inactive">{t('staffStatusInactive')}</option>
        </select>
      </div>

      {renderSection(t('staffSectionActive'), 'bg-emerald-500', active)}
      {renderSection(t('staffSectionInactive'), 'bg-amber-500', inactive, true)}

      {!active.length && !inactive.length ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">{t('staffNoMatches')}</p>
      ) : null}

      {addOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
          <form
            onSubmit={submitAdd}
            className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">{t('staffAddUser')}</h3>
            <label className="block text-sm">
              {t('name')}
              <input
                className="input mt-1"
                required
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              {t('staffRole')}
              <select
                className="input mt-1"
                value={addForm.roleId}
                onChange={(e) => setAddForm({ ...addForm, roleId: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {staffRoleDisplayName(r.name, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              {t('staffPinLabel')}
              <input
                className="input mt-1"
                inputMode="numeric"
                maxLength={4}
                value={addForm.pin}
                onChange={(e) =>
                  setAddForm({ ...addForm, pin: sanitizeStaffPinInput(e.target.value) })
                }
              />
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={addSaving}>
                {addSaving ? t('saving') : t('staffAddUser')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
