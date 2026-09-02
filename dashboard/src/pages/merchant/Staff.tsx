import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { notifyStaffRosterChanged } from '@/lib/permissions';
import { isValidStaffPin, sanitizeStaffPinInput } from '@/lib/staff-pin';
import { useI18n } from '@/lib/i18n';
import { ALL_PERMISSIONS, staffRoleDisplayName, permissionsForMerchantAddon, isKioskOperatorRoleName, type Permission } from '@/lib/permissions';
import { isKioskLicensed } from '@/lib/kiosk-addon';
import { loginHomeFromPermissions, type StaffLoginHome } from '@/lib/staff-login-home';
import { useLocationStore, type MerchantLocation } from '@/store/location';
import { useAuthStore } from '@/store/auth';

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
  pin?: string | null;
  passwordSet?: boolean;
  deliveryHourlyRateOverride?: string | null;
  deliveryPerOrderFeeOverride?: string | null;
  loginHome?: StaffLoginHome;
};

type StaffEditForm = {
  name: string;
  roleId: string;
  pin: string;
  clearPin: boolean;
  email: string;
  password: string;
  canAccessPanel: boolean;
  deliveryHourlyRateOverride: string;
  deliveryPerOrderFeeOverride: string;
  loginHome: 'panel' | 'pos';
  locationIds: string[];
};

const emptyCreateForm = {
  name: '',
  roleId: '',
  pin: '',
  email: '',
  password: '',
  canAccessPanel: false,
  loginHome: 'panel' as 'panel' | 'pos',
};

export default function StaffPage({
  embedded = false,
  kioskLicensed: kioskLicensedProp,
}: {
  embedded?: boolean;
  kioskLicensed?: boolean;
}) {
  const { t } = useI18n();
  const { locations, load: loadLocations } = useLocationStore();
  const authUser = useAuthStore((s) => s.user);
  const ownerEmail =
    authUser?.role === 'merchant' || authUser?.isOwner ? authUser.email : null;
  const ownerName =
    authUser?.role === 'merchant' || authUser?.isOwner ? authUser.name : null;
  const [tab, setTab] = useState<'staff' | 'roles'>('staff');
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [rolePerms, setRolePerms] = useState<Permission[]>([]);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [editForm, setEditForm] = useState<StaffEditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [kioskLicensed, setKioskLicensed] = useState(kioskLicensedProp ?? false);

  const [staffForm, setStaffForm] = useState(emptyCreateForm);

  const visiblePermissions = useMemo(
    () => permissionsForMerchantAddon(ALL_PERMISSIONS, kioskLicensed),
    [kioskLicensed]
  );
  const visibleRoles = useMemo(
    () => roles.filter((r) => kioskLicensed || !isKioskOperatorRoleName(r.name)),
    [roles, kioskLicensed]
  );

  useEffect(() => {
    if (kioskLicensedProp != null) setKioskLicensed(kioskLicensedProp);
  }, [kioskLicensedProp]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const requests: Promise<unknown>[] = [
        api.get('/merchant/roles'),
        api.get('/merchant/staff'),
      ];
      if (kioskLicensedProp == null) {
        requests.push(api.get('/merchant/settings').catch(() => ({ data: { settings: {} } })));
      }
      const [rolesRes, staffRes, settingsRes] = (await Promise.all(requests)) as [
        { data: { roles?: RoleRow[] } },
        { data: { staff?: StaffRow[] } },
        { data: { settings?: Record<string, unknown> } } | undefined,
      ];
      const rolesList = rolesRes.data.roles || [];
      setRoles(rolesList);
      setStaff(staffRes.data.staff || []);
      if (kioskLicensedProp == null && settingsRes) {
        const s = settingsRes.data?.settings || {};
        setKioskLicensed(isKioskLicensed(s));
      }
      setStaffForm((f) => {
        if (f.roleId || !rolesList[0]?.id) return f;
        return { ...f, roleId: rolesList[0].id };
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('staffLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [kioskLicensedProp, t]);

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
      await api.put(`/merchant/roles/${editingRole.id}`, {
        permissions: permissionsForMerchantAddon(rolePerms, kioskLicensed),
      });
      toast.success(t('staffRoleUpdated'));
      setEditingRole(null);
      notifyStaffRosterChanged();
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('staffRoleSaveFailed'));
    }
  };

  const addStaff = async (e: FormEvent) => {
    e.preventDefault();
    const email = staffForm.email.trim();
    const password = staffForm.password.trim();
    const canAccessPanel = staffForm.canAccessPanel || !!(email && password);
    if (canAccessPanel) {
      if (!email) {
        toast.error(t('staffEmailRequired'));
        return;
      }
      if (!password) {
        toast.error(t('staffPasswordRequired'));
        return;
      }
    }
    const pin = staffForm.pin.trim();
    if (pin && !isValidStaffPin(pin)) {
      toast.error(t('staffPinInvalid'));
      return;
    }
    try {
      await api.post('/merchant/staff', {
        ...staffForm,
        email,
        password,
        canAccessPanel,
        loginHome: canAccessPanel ? staffForm.loginHome : undefined,
      });
      toast.success(t('staffUserCreated'));
      setStaffForm({ ...emptyCreateForm, roleId: roles[0]?.id || '' });
      notifyStaffRosterChanged();
      void load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('staffUserCreateFailed'));
    }
  };

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const openStaffEdit = async (row: StaffRow) => {
    setEditingStaff(row);
    let locationIds: string[] = [];
    try {
      const res = await api.get(`/merchant/locations/staff/${row.id}`);
      locationIds = res.data?.locationIds || [];
    } catch {
      locationIds = [];
    }
    setEditForm({
      name: row.name,
      roleId: row.roleId,
      pin: '',
      clearPin: false,
      email: row.email || '',
      password: '',
      canAccessPanel: row.canAccessPanel,
      deliveryHourlyRateOverride: row.deliveryHourlyRateOverride ?? '',
      deliveryPerOrderFeeOverride: row.deliveryPerOrderFeeOverride ?? '',
      loginHome:
        row.loginHome === 'pos' || row.loginHome === 'panel'
          ? row.loginHome
          : loginHomeFromPermissions(
              roles.find((r) => r.id === row.roleId)?.permissions || [],
              row.canAccessPanel
            ) === 'pos'
            ? 'pos'
            : 'panel',
      locationIds,
    });
  };

  const closeStaffEdit = () => {
    setEditingStaff(null);
    setEditForm(null);
  };

  const saveStaffEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editForm) return;
    const nextOfficial =
      editForm.canAccessPanel || !!(editForm.email.trim() && editForm.password.trim());
    if (nextOfficial) {
      if (!editForm.email.trim()) {
        toast.error(t('staffEmailRequired'));
        return;
      }
      if (!editingStaff.passwordSet && !editForm.password.trim()) {
        toast.error(t('staffPasswordRequired'));
        return;
      }
    }
    if (editForm.pin && !isValidStaffPin(editForm.pin)) {
      toast.error(t('staffPinInvalid'));
      return;
    }
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        roleId: editForm.roleId,
        canAccessPanel: nextOfficial,
        email: editForm.email.trim() || null,
      };
      if (editForm.clearPin) {
        body.pin = null;
      } else if (editForm.pin.trim()) {
        body.pin = editForm.pin.trim();
      }
      if (editForm.password.trim()) {
        body.password = editForm.password.trim();
      }
      body.deliveryHourlyRateOverride = editForm.deliveryHourlyRateOverride.trim()
        ? Number(editForm.deliveryHourlyRateOverride)
        : null;
      body.deliveryPerOrderFeeOverride = editForm.deliveryPerOrderFeeOverride.trim()
        ? Number(editForm.deliveryPerOrderFeeOverride)
        : null;
      if (nextOfficial) {
        body.loginHome = editForm.loginHome;
      }
      await api.put(`/merchant/staff/${editingStaff.id}`, body);
      if (locations.length > 1) {
        await api.put(`/merchant/locations/staff/${editingStaff.id}`, {
          locationIds: editForm.locationIds,
        });
      }
      toast.success(t('staffUserUpdated'));
      closeStaffEdit();
      notifyStaffRosterChanged();
      void load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('staffUserUpdateFailed'));
    } finally {
      setEditSaving(false);
    }
  };

  const removeStaff = async (id: string) => {
    if (staff.length <= 1) {
      toast.error(t('staffCannotRemoveLast'));
      return;
    }
    if (!confirm(t('staffRemoveConfirm'))) return;
    try {
      await api.delete(`/merchant/staff/${id}`);
      toast.success(t('staffUserRemoved'));
      notifyStaffRosterChanged();
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('staffUserRemoveFailed'));
    }
  };

  const suggestLoginHome = (roleId: string, canAccessPanel: boolean): 'panel' | 'pos' => {
    const role = roles.find((r) => r.id === roleId);
    const suggested = loginHomeFromPermissions(role?.permissions || [], canAccessPanel);
    return suggested === 'pos' ? 'pos' : 'panel';
  };

  const showCreateLoginHome =
    staffForm.canAccessPanel || !!(staffForm.email.trim() && staffForm.password.trim());
  const showEditLoginHome =
    editForm?.canAccessPanel || !!(editForm?.email.trim() && editForm?.password.trim());

  useEffect(() => {
    if (!editingStaff && !editingRole) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editingStaff, editingRole]);

  if (loading) {
    return <div className="p-4 text-sm text-[var(--text-muted)]">{t('staffLoading')}</div>;
  }

  return (
    <div className={`space-y-6 ${embedded ? '' : 'max-w-4xl'}`}>
      {!embedded ? (
        <div>
          <h1 className="text-xl font-semibold">{t('staffPageTitle')}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('staffPageHint')}</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('staffWaiterTemplateHint')}</p>
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-[var(--border)]">
        {(['staff', 'roles'] as const).map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === tabId
                ? 'border-[var(--text)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)]'
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
                  onChange={(e) => {
                    const roleId = e.target.value;
                    const canAccessPanel =
                      staffForm.canAccessPanel ||
                      !!(staffForm.email.trim() && staffForm.password.trim());
                    setStaffForm({
                      ...staffForm,
                      roleId,
                      loginHome: suggestLoginHome(roleId, canAccessPanel),
                    });
                  }}
                >
                  {visibleRoles.map((r) => (
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
                  pattern="[0-9]{4,8}"
                  maxLength={8}
                  placeholder={t('staffPinPlaceholder')}
                  value={staffForm.pin}
                  onChange={(e) =>
                    setStaffForm({
                      ...staffForm,
                      pin: sanitizeStaffPinInput(e.target.value),
                    })
                  }
                />
              </label>
              <label className="block text-sm">
                {t('staffEmailPanel')}
                <input
                  className="input mt-1"
                  type="email"
                  autoComplete="off"
                  value={staffForm.email}
                  onChange={(e) => {
                    const email = e.target.value;
                    const canAccessPanel =
                      staffForm.canAccessPanel || !!(email.trim() && staffForm.password.trim());
                    setStaffForm({ ...staffForm, email, canAccessPanel });
                  }}
                />
              </label>
              <label className="block text-sm">
                {t('password')}
                <input
                  className="input mt-1"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={staffForm.password}
                  onChange={(e) => {
                    const password = e.target.value;
                    const canAccessPanel =
                      staffForm.canAccessPanel || !!(staffForm.email.trim() && password.trim());
                    setStaffForm({ ...staffForm, password, canAccessPanel });
                  }}
                />
                <span className="block text-xs text-[var(--text-muted)] font-normal mt-1">
                  {t('staffPasswordCreateHint')}
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={staffForm.canAccessPanel}
                  onChange={(e) => setStaffForm({ ...staffForm, canAccessPanel: e.target.checked })}
                />
                <span>
                  {t('staffEmailLogin')}
                  <span className="block text-xs text-[var(--text-muted)] font-normal">
                    {t('staffEmailLoginHint')}
                  </span>
                </span>
              </label>
              {showCreateLoginHome ? (
                <fieldset className="block text-sm sm:col-span-2">
                  <legend className="font-medium">{t('staffLoginHome')}</legend>
                  <p className="text-xs text-[var(--text-muted)] font-normal mt-0.5 mb-2">
                    {t('staffLoginHomeHint')}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ['panel', t('staffLoginHomePanel'), t('staffLoginHomePanelHint')],
                        ['pos', t('staffLoginHomePos'), t('staffLoginHomePosHint')],
                      ] as const
                    ).map(([value, title, hint]) => {
                      const active = staffForm.loginHome === value;
                      return (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 ${
                            active
                              ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                              : 'border-[var(--border)]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="createLoginHome"
                            className="mt-1"
                            checked={active}
                            onChange={() =>
                              setStaffForm({ ...staffForm, loginHome: value })
                            }
                          />
                          <span>
                            <span className="font-medium block">{title}</span>
                            <span className="text-xs text-[var(--text-muted)]">{hint}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
            </div>
            <button type="submit" className="btn-primary">
              {t('staffAddUser')}
            </button>
          </form>

          {ownerEmail ? (
            <div className="card p-4 space-y-1 border border-[var(--border)] bg-[var(--bg-muted)]">
              <p className="text-sm font-medium">{t('staffOwnerTitle')}</p>
              <p className="text-sm text-[var(--text)]">
                {ownerName ? `${ownerName} · ` : ''}
                <span className="font-mono text-xs sm:text-sm">{ownerEmail}</span>
              </p>
              <p className="text-xs text-[var(--text-muted)]">{t('staffOwnerHint')}</p>
            </div>
          ) : null}

          <div className="hidden sm:block card !p-0 table-scroll">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-[var(--bg-muted)] text-left">
                <tr>
                  <th className="px-3 py-2">{t('name')}</th>
                  <th className="px-3 py-2">{t('staffRole')}</th>
                  <th className="px-3 py-2">{t('staffPinCol')}</th>
                  <th className="px-3 py-2">{t('staffPanelCol')}</th>
                  <th className="px-3 py-2">{t('staffLoginHomeCol')}</th>
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
                    <td className="px-3 py-2">{staffRoleDisplayName(s.roleName, t)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums tracking-wider">
                      {s.pin ? (
                        s.pin
                      ) : s.pinSet ? (
                        <span className="text-xs text-[var(--text-muted)]" title={t('staffPinHiddenHint')}>
                          {t('staffPinHidden')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {s.canAccessPanel || s.email ? (
                        <span className="cell-truncate block" title={s.email || t('yes')}>
                          {s.email || t('yes')}
                        </span>
                      ) : (
                        t('no')
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.canAccessPanel || s.email
                        ? s.loginHome === 'pos'
                          ? t('staffLoginHomePos')
                          : t('staffLoginHomePanel')
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="text-[var(--text)] text-xs font-medium mr-3 underline-offset-2 hover:underline"
                        onClick={() => openStaffEdit(s)}
                      >
                        {t('edit')}
                      </button>
                      {staff.length > 1 ? (
                        <button
                          type="button"
                          className="text-red-600 text-xs"
                          onClick={() => void removeStaff(s.id)}
                        >
                          {t('remove')}
                        </button>
                      ) : (
                        <span
                          className="text-xs text-[var(--text-muted)]"
                          title={t('staffCannotRemoveLast')}
                        >
                          {t('staffLastUser')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {staffRoleDisplayName(s.roleName, t)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="text-[var(--text)] text-xs font-medium underline-offset-2 hover:underline"
                      onClick={() => openStaffEdit(s)}
                    >
                      {t('edit')}
                    </button>
                    {staff.length > 1 ? (
                      <button
                        type="button"
                        className="text-red-600 text-xs"
                        onClick={() => void removeStaff(s.id)}
                      >
                        {t('remove')}
                      </button>
                    ) : null}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <dt className="text-[var(--text-muted)]">{t('staffPinCol')}</dt>
                    <dd className="font-mono tabular-nums tracking-wider">
                      {s.pin ? (
                        s.pin
                      ) : s.pinSet ? (
                        <span title={t('staffPinHiddenHint')}>{t('staffPinHidden')}</span>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">{t('staffPanelCol')}</dt>
                    <dd className="truncate">
                      {s.canAccessPanel || s.email ? s.email || t('yes') : t('no')}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[var(--text-muted)]">{t('staffLoginHomeCol')}</dt>
                    <dd>
                      {s.canAccessPanel || s.email
                        ? s.loginHome === 'pos'
                          ? t('staffLoginHomePos')
                          : t('staffLoginHomePanel')
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRoles.map((role) => (
            <div key={role.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{staffRoleDisplayName(role.name, t)}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('staffPermissionsCount').replace('{count}', String(role.permissions.length))}
                  {role.isSystem ? ` - ${t('staffSystemProfile')}` : ''}
                </p>
                {role.name.trim().toLowerCase() === 'waiter' ||
                role.name.trim().toLowerCase() === 'waiter (pos only)' ? (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t('staffRoleWaiterHint')}</p>
                ) : null}
                {role.name.trim().toLowerCase().includes('menu editor') ? (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t('staffRoleWaiterMenuHint')}</p>
                ) : null}
                {role.name.trim().toLowerCase() === 'storekeeper' ? (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t('staffRoleStorekeeperHint')}</p>
                ) : null}
                {role.name.trim().toLowerCase() === 'kiosk operator' ? (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t('staffRoleKioskHint')}</p>
                ) : null}
                {role.name.trim().toLowerCase() === 'order center operator' ? (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t('staffRoleOrderCenterHint')}</p>
                ) : null}
              </div>
              <button type="button" className="btn-secondary text-sm" onClick={() => openRoleEdit(role)}>
                {t('staffEditPermissions')}
              </button>
            </div>
          ))}
        </div>
      )}

      {editingStaff && editForm ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/40 p-4"
          onClick={() => {
            setEditingStaff(null);
            setEditForm(null);
          }}
        >
          <div className="flex min-h-full items-start justify-center py-4 sm:items-center">
          <form
            onSubmit={(e) => void saveStaffEdit(e)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto overscroll-contain rounded-xl bg-[var(--bg-elevated)] p-4 shadow-xl space-y-3"
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
                  onChange={(e) => {
                    const roleId = e.target.value;
                    const canAccessPanel =
                      editForm.canAccessPanel ||
                      !!(editForm.email.trim() && editForm.password.trim());
                    setEditForm({
                      ...editForm,
                      roleId,
                      loginHome: suggestLoginHome(roleId, canAccessPanel),
                    });
                  }}
                >
                  {visibleRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {staffRoleDisplayName(r.name, t)}
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
                  maxLength={8}
                  placeholder={
                    editingStaff.pinSet ? t('staffPinKeepPlaceholder') : t('staffPinPlaceholder')
                  }
                  disabled={editForm.clearPin}
                  value={editForm.pin}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      pin: sanitizeStaffPinInput(e.target.value),
                      clearPin: false,
                    })
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
              <label className="block text-sm">
                {t('staffEmailPanel')}
                <input
                  className="input mt-1"
                  type="email"
                  autoComplete="off"
                  value={editForm.email}
                  onChange={(e) => {
                    const email = e.target.value;
                    const canAccessPanel =
                      editForm.canAccessPanel || !!(email.trim() && editForm.password.trim());
                    setEditForm({ ...editForm, email, canAccessPanel });
                  }}
                />
              </label>
              <label className="block text-sm">
                {t('staffNewPassword')}
                <input
                  className="input mt-1"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder={
                    editingStaff.passwordSet
                      ? t('staffPasswordKeepPlaceholder')
                      : t('staffPasswordRequiredPlaceholder')
                  }
                  value={editForm.password}
                  onChange={(e) => {
                    const password = e.target.value;
                    const canAccessPanel =
                      editForm.canAccessPanel || !!(editForm.email.trim() && password.trim());
                    setEditForm({ ...editForm, password, canAccessPanel });
                  }}
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={editForm.canAccessPanel}
                  onChange={(e) => setEditForm({ ...editForm, canAccessPanel: e.target.checked })}
                />
                <span>
                  {t('staffEmailLogin')}
                  <span className="block text-xs text-[var(--text-muted)] font-normal">
                    {t('staffEmailLoginHint')}
                  </span>
                </span>
              </label>
              {showEditLoginHome ? (
                <fieldset className="block text-sm sm:col-span-2">
                  <legend className="font-medium">{t('staffLoginHome')}</legend>
                  <p className="text-xs text-[var(--text-muted)] font-normal mt-0.5 mb-2">
                    {t('staffLoginHomeHint')}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ['panel', t('staffLoginHomePanel'), t('staffLoginHomePanelHint')],
                        ['pos', t('staffLoginHomePos'), t('staffLoginHomePosHint')],
                      ] as const
                    ).map(([value, title, hint]) => {
                      const active = editForm.loginHome === value;
                      return (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 ${
                            active
                              ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                              : 'border-[var(--border)]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="editLoginHome"
                            className="mt-1"
                            checked={active}
                            onChange={() => setEditForm({ ...editForm, loginHome: value })}
                          />
                          <span>
                            <span className="font-medium block">{title}</span>
                            <span className="text-xs text-[var(--text-muted)]">{hint}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
              {locations.length > 1 ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">{t('staffLocationsTitle')}</legend>
                  <p className="text-xs text-[var(--text-muted)]">{t('staffLocationsHint')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {locations.map((loc: MerchantLocation) => {
                      const checked = editForm.locationIds.includes(loc.id);
                      return (
                        <label
                          key={loc.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 ${
                            checked ? 'border-[var(--text)] bg-[var(--bg-muted)]' : 'border-[var(--border)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setEditForm({
                                ...editForm,
                                locationIds: checked
                                  ? editForm.locationIds.filter((id) => id !== loc.id)
                                  : [...editForm.locationIds, loc.id],
                              });
                            }}
                          />
                          <span className="text-sm">{loc.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
              <label className="block text-sm">
                {t('deliveryStaffHourlyOverride')}
                <input
                  className="input mt-1"
                  type="number"
                  min={0}
                  step={0.05}
                  placeholder={t('deliveryUnassigned')}
                  value={editForm.deliveryHourlyRateOverride}
                  onChange={(e) =>
                    setEditForm({ ...editForm, deliveryHourlyRateOverride: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                {t('deliveryStaffPerOrderOverride')}
                <input
                  className="input mt-1"
                  type="number"
                  min={0}
                  step={0.05}
                  placeholder={t('deliveryUnassigned')}
                  value={editForm.deliveryPerOrderFeeOverride}
                  onChange={(e) =>
                    setEditForm({ ...editForm, deliveryPerOrderFeeOverride: e.target.value })
                  }
                />
              </label>
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
        </div>
      ) : null}

      {editingRole ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/40 p-4"
          onClick={() => setEditingRole(null)}
        >
          <div
            className="mx-auto w-full max-w-lg max-h-[85vh] overflow-y-auto overscroll-contain rounded-xl bg-[var(--bg-elevated)] p-4 shadow-xl my-4 sm:my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-3">
              {t('staffEditRole').replace('{name}', staffRoleDisplayName(editingRole.name, t))}
            </h3>
            <p className="mb-3 text-xs text-[var(--text-muted)]">{t('staffRoleBackOfficeHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {visiblePermissions.map((p) => (
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
