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
  /** `button` = compact top-bar chip; `menu` = row inside sidebar account popup */
  variant?: 'button' | 'menu';
  onOpen?: () => void;
};

export default function StaffSwitchButton({ className = '', variant = 'button', onOpen }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const openModal = () => {
    onOpen?.();
    setOpen(true);
  };

  return (
    <>
      {variant === 'menu' ? (
        <button
          type="button"
          className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 ${className}`}
          onClick={openModal}
          title={t('webPosSwitchUser')}
        >
          <UserCircle2 className="w-4 h-4" />
          {t('webPosSwitchUser')}
        </button>
      ) : (
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs font-medium hover:bg-[var(--bg-muted)] ${className}`}
          onClick={openModal}
          title={t('webPosSwitchUser')}
        >
          <UserCircle2 size={14} />
          <span className="hidden sm:inline">{t('webPosSwitchUser')}</span>
        </button>
      )}
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
