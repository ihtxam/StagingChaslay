import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { ALL_PERMISSIONS, type Permission } from '@/lib/permissions';

type RoleRow = {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
};

type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  roleId: string;
  roleName: string;
  canAccessPanel: boolean;
  isActive: boolean;
  pinSet: boolean;
  passwordSet?: boolean;
};

type StaffEditForm = {
  name: string;
  roleId: string;
  pin: string;
  clearPin: boolean;
  email: string;
  password: string;
  canAccessPanel: boolean;
};

const emptyCreateForm = {
  name: '',
  roleId: '',
  pin: '',
  email: '',
  password: '',
  canAccessPanel: false,
};

export default function StaffPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'staff' | 'roles'>('staff');
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [rolePerms, setRolePerms] = useState<Permission[]>([]);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [editForm, setEditForm] = useState<StaffEditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [staffForm, setStaffForm] = useState(emptyCreateForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, staffRes] = await Promise.all([
        api.get('/merchant/roles'),
        api.get('/merchant/staff'),
      ]);
      setRoles(rolesRes.data.roles || []);
      setStaff(staffRes.data.staff || []);
      if (!staffForm.roleId && rolesRes.data.roles?.[0]?.id) {
        setStaffForm((f) => ({ ...f, roleId: rolesRes.data.roles[0].id }));
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('staffLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [staffForm.roleId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRoleEdit = (role: RoleRow) => {
    setEditingRole(role);
    setRolePerms(role.permissions as Permission[]);
  };

  const saveRole = async () => {
    if (!editingRole) return;
    try {
      await api.put(`/merchant/roles/${editingRole.id}`, { permissions: rolePerms });
      toast.success(t('staffRoleUpdated'));
      setEditingRole(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('staffRoleSaveFailed'));
    }
  };

  const addStaff = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/merchant/staff', staffForm);
      toast.success(t('staffUserCreated'));
      setStaffForm({ ...emptyCreateForm, roleId: roles[0]?.id || '' });
      void load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('staffUserCreateFailed'));
    }
  };

  const openStaffEdit = (row: StaffRow) => {
    setEditingStaff(row);
    setEditForm({
      name: row.name,
      roleId: row.roleId,
      pin: '',
      clearPin: false,
      email: row.email || '',
      password: '',
      canAccessPanel: row.canAccessPanel,
    });
  };

  const closeStaffEdit = () => {
    setEditingStaff(null);
    setEditForm(null);
  };

  const saveStaffEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editForm) return;
    if (editForm.canAccessPanel) {
      if (!editForm.email.trim()) {
        toast.error(t('staffEmailRequired'));
        return;
      }
      if (!editingStaff.passwordSet && !editForm.password.trim()) {
        toast.error(t('staffPasswordRequired'));
        return;
      }
    }
    if (editForm.pin && (editForm.pin.length < 4 || editForm.pin.length > 8)) {
      toast.error(t('staffPinInvalid'));
      return;
    }
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        roleId: editForm.roleId,
        canAccessPanel: editForm.canAccessPanel,
        email: editForm.canAccessPanel ? editForm.email.trim() : editForm.email.trim() || null,
      };
      if (editForm.clearPin) {
        body.pin = null;
      } else if (editForm.pin.trim()) {
        body.pin = editForm.pin.trim();
      }
      if (editForm.password.trim()) {
        body.password = editForm.password.trim();
      }
      await api.put(`/merchant/staff/${editingStaff.id}`, body);
      toast.success(t('staffUserUpdated'));
      closeStaffEdit();
      void load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('staffUserUpdateFailed'));
    } finally {
      setEditSaving(false);
    }
  };

  const removeStaff = async (id: string) => {
    if (!confirm(t('staffRemoveConfirm'))) return;
    try {
      await api.delete(`/merchant/staff/${id}`);
      toast.success(t('staffUserRemoved'));
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('staffUserRemoveFailed'));
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-[var(--text-muted)]">{t('staffLoading')}</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">{t('staffPageTitle')}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t('staffPageHint')}</p>
      </div>

      <div className="flex gap-2 border-b border-[var(--border)]">
        {(['staff', 'roles'] as const).map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === tabId ? 'border-stone-900 text-stone-900' : 'border-transparent text-[var(--text-muted)]'
            }`}
          >
            {tabId === 'staff' ? t('staffTabUsers') : t('staffTabRoles')}
          </button>
        ))}
      </div>

      {tab === 'staff' ? (
        <div className="space-y-6">
          <form onSubmit={addStaff} className="card p-4 space-y-3">
            <h2 className="font-medium">{t('staffAddUser')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                {t('name')}
                <input
                  className="input mt-1"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                {t('staffRole')}
                <select
                  className="input mt-1"
                  value={staffForm.roleId}
                  onChange={(e) => setStaffForm({ ...staffForm, roleId: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                {t('staffPinLabel')}
                <input
                  className="input mt-1"
                  inputMode="numeric"
                  pattern="[0-9]{4,8}"
                  placeholder={t('staffPinPlaceholder')}
                  value={staffForm.pin}
                  onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm pt-6">
                <input
                  type="checkbox"
                  checked={staffForm.canAccessPanel}
                  onChange={(e) => setStaffForm({ ...staffForm, canAccessPanel: e.target.checked })}
                />
                {t('staffCanAccessPanel')}
              </label>
              {staffForm.canAccessPanel ? (
                <>
                  <label className="block text-sm">
                    {t('staffEmailPanel')}
                    <input
                      className="input mt-1"
                      type="email"
                      required
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    {t('password')}
                    <input
                      className="input mt-1"
                      type="password"
                      required
                      minLength={8}
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    />
                  </label>
                </>
              ) : null}
            </div>
            <button type="submit" className="btn-primary">
              {t('staffAddUser')}
            </button>
          </form>

          <div className="card !p-0 table-scroll">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-[var(--bg-muted)] text-left">
                <tr>
                  <th className="px-3 py-2">{t('name')}</th>
                  <th className="px-3 py-2">{t('staffRole')}</th>
                  <th className="px-3 py-2">{t('staffPinCol')}</th>
                  <th className="px-3 py-2">{t('staffPanelCol')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">
                      <span className="cell-truncate block" title={s.name}>
                        {s.name}
                      </span>
                    </td>
                    <td className="px-3 py-2">{s.roleName}</td>
                    <td className="px-3 py-2">{s.pinSet ? t('staffPinSet') : '-'}</td>
                    <td className="px-3 py-2">
                      {s.canAccessPanel ? (
                        <span className="cell-truncate block" title={s.email || t('yes')}>
                          {s.email || t('yes')}
                        </span>
                      ) : (
                        t('no')
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="text-stone-800 text-xs font-medium mr-3 underline-offset-2 hover:underline"
                        onClick={() => openStaffEdit(s)}
                      >
                        {t('edit')}
                      </button>
                      <button
                        type="button"
                        className="text-red-600 text-xs"
                        onClick={() => void removeStaff(s.id)}
                      >
                        {t('remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{role.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('staffPermissionsCount').replace('{count}', String(role.permissions.length))}
                  {role.isSystem ? ` - ${t('staffSystemProfile')}` : ''}
                </p>
              </div>
              <button type="button" className="btn-secondary text-sm" onClick={() => openRoleEdit(role)}>
                {t('staffEditPermissions')}
              </button>
            </div>
          ))}
        </div>
      )}

      {editingStaff && editForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={(e) => void saveStaffEdit(e)}
            className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-xl bg-white dark:bg-stone-900 p-4 shadow-xl space-y-3"
          >
            <h3 className="font-semibold">
              {t('staffEditUser').replace('{name}', editingStaff.name)}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">{t('staffEditUserHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                {t('name')}
                <input
                  className="input mt-1"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                {t('staffRole')}
                <select
                  className="input mt-1"
                  value={editForm.roleId}
                  onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                {t('staffNewPin')}
                <input
                  className="input mt-1"
                  inputMode="numeric"
                  pattern="[0-9]{4,8}"
                  placeholder={
                    editingStaff.pinSet ? t('staffPinKeepPlaceholder') : t('staffPinPlaceholder')
                  }
                  disabled={editForm.clearPin}
                  value={editForm.pin}
                  onChange={(e) =>
                    setEditForm({ ...editForm, pin: e.target.value.replace(/\D/g, ''), clearPin: false })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={editForm.clearPin}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      clearPin: e.target.checked,
                      pin: e.target.checked ? '' : editForm.pin,
                    })
                  }
                />
                {t('staffClearPin')}
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={editForm.canAccessPanel}
                  onChange={(e) => setEditForm({ ...editForm, canAccessPanel: e.target.checked })}
                />
                {t('staffCanAccessPanel')}
              </label>
              {editForm.canAccessPanel ? (
                <>
                  <label className="block text-sm">
                    {t('staffEmailPanel')}
                    <input
                      className="input mt-1"
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    {t('staffNewPassword')}
                    <input
                      className="input mt-1"
                      type="password"
                      minLength={8}
                      required={!editingStaff.passwordSet}
                      placeholder={
                        editingStaff.passwordSet
                          ? t('staffPasswordKeepPlaceholder')
                          : t('staffPasswordRequiredPlaceholder')
                      }
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    />
                  </label>
                </>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={closeStaffEdit} disabled={editSaving}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={editSaving}>
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingRole ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-xl bg-white dark:bg-stone-900 p-4 shadow-xl">
            <h3 className="font-semibold mb-3">
              {t('staffEditRole').replace('{name}', editingRole.name)}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={rolePerms.includes(p)}
                    onChange={(e) =>
                      setRolePerms((prev) =>
                        e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)
                      )
                    }
                  />
                  {t(`perm_${p}`)}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditingRole(null)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={() => void saveRole()}>
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
