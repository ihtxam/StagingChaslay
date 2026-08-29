import { forwardRef, useImperativeHandle, useState } from 'react';
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

export type StaffSwitchButtonHandle = {
  open: () => void;
};

type Props = {
  className?: string;
  /** `button` = compact top-bar chip; `menu` = row inside sidebar account popup */
  variant?: 'button' | 'menu';
  /** When false, only the PIN modal is mounted (trigger via ref.open()). */
  showTrigger?: boolean;
  onOpen?: () => void;
};

const StaffSwitchButton = forwardRef<StaffSwitchButtonHandle, Props>(function StaffSwitchButton(
  { className = '', variant = 'button', showTrigger = true, onOpen },
  ref
) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const openModal = () => {
    setOpen(true);
    onOpen?.();
  };

  useImperativeHandle(ref, () => ({ open: openModal }), []);

  return (
    <>
      {showTrigger ? (
        variant === 'menu' ? (
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
        )
      ) : null}
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
          });
          notifyWebPosStaffSessionChanged();
          setOpen(false);
          const perms = staff.permissions as Permission[];
          navigate(homePathForUser({ role: 'staff', permissions: perms, isOwner: false }), {
            replace: true,
          });
        }}
      />
    </>
  );
});

export default StaffSwitchButton;
