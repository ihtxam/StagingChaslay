import api from '@/lib/api';
import {
  notifyWebPosStaffSessionChanged,
  saveWebPosStaffSession,
  type StaffRosterRow,
  webPosSessionFromStaffProfile,
} from '@/lib/permissions';
import type { User } from '@/store/auth';

/**
 * After official staff email/password login, clock the same user into the register
 * session so WebPOS does not show a second PIN wall (identity already proved).
 */
export async function bootstrapStaffRegisterSessionAfterEmailLogin(
  user: Pick<User, 'role' | 'staffId' | 'name' | 'roleName' | 'permissions'>,
  jwtToken: string
): Promise<void> {
  const staffId = String(user.staffId || '').trim();
  if (user.role !== 'staff' || !staffId || !jwtToken) return;

  const res = await api.get('/merchant/staff');
  const staffList = (res.data?.staff || []) as StaffRosterRow[];
  const row = staffList.find((s) => s.id === staffId && s.isActive !== false);
  if (!row) return;

  saveWebPosStaffSession(
    webPosSessionFromStaffProfile({
      id: row.id,
      name: row.name,
      roleId: row.roleId,
      roleName: row.roleName,
      permissions: row.permissions || user.permissions || [],
      accessToken: jwtToken,
    })
  );
  notifyWebPosStaffSessionChanged();
}
