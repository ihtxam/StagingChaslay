import { useState } from 'react';
import { UserCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WebPosPinModal from '@/components/WebPosPinModal';
import { useI18n } from '@/lib/i18n';
import { homePathForUser } from '@/lib/auth-home';
import {
  notifyWebPosStaffSessionChanged,
  saveWebPosStaffSession,
  type Permission,
} from '@/lib/permissions';

type Props = {
  className?: string;
};

export default function StaffSwitchButton({ className = '' }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs font-medium hover:bg-[var(--bg-muted)] ${className}`}
        onClick={() => setOpen(true)}
        title={t('webPosSwitchUser')}
      >
        <UserCircle2 size={14} />
        <span className="hidden sm:inline">{t('webPosSwitchUser')}</span>
      </button>
      <WebPosPinModal
        open={open}
        mode="switch"
        onClose={() => setOpen(false)}
        onSuccess={(staff) => {
          saveWebPosStaffSession({
            id: staff.id,
            name: staff.name,
            roleId: staff.roleId,
            roleName: staff.roleName,
            permissions: staff.permissions as Permission[],
            accessToken: staff.accessToken,
            preferredTerminalId: staff.preferredTerminalId,
          });
          notifyWebPosStaffSessionChanged();
          setOpen(false);
          const perms = staff.permissions as Permission[];
          navigate(homePathForUser({ role: 'staff', permissions: perms, isOwner: false }), { replace: true });
        }}
      />
    </>
  );
}
