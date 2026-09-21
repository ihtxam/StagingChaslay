import { ArrowRight, Banknote, CreditCard, MonitorSmartphone } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  actionButtonIconSize,
  expressCheckoutArrowClass,
  expressCheckoutArrowIconSize,
  expressCheckoutButtonClass,
  type WebPosActionButtonSize,
} from '@/lib/webpos-action-button-size';

type ExpressMethod = 'cash' | 'card' | 'terminal';

type Props = {
  expressCheckout?: boolean;
  expressMethods?: { cash?: boolean; card?: boolean; terminal?: boolean };
  onExpressPay?: (method: ExpressMethod) => void;
  onOpenCheckout?: () => void;
  expressDisabled?: boolean;
  checkoutDisabled?: boolean;
  actionButtonSize?: WebPosActionButtonSize;
};

export default function WebPosExpressCheckoutBar({
  expressCheckout = false,
  expressMethods,
  onExpressPay,
  onOpenCheckout,
  expressDisabled = false,
  checkoutDisabled = false,
  actionButtonSize = 'md',
}: Props) {
  const { t } = useI18n();
  const expressIcon = actionButtonIconSize(actionButtonSize);
  const showCash = expressMethods?.cash !== false;
  const showCard = expressMethods?.card !== false;
  const showTerminal = expressMethods?.terminal === true;
  const hasQuickPay =
    expressCheckout && (showCash || showCard || showTerminal) && !!onExpressPay;
  const showPayRow = hasQuickPay || !!onOpenCheckout;
  if (!showPayRow) return null;

  return (
    <div className="shrink-0 border-t border-stone-200 bg-white p-3">
      <div className="flex items-stretch gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          {hasQuickPay && showCash ? (
            <button
              type="button"
              disabled={expressDisabled}
              onClick={() => onExpressPay!('cash')}
              className={`${expressCheckoutButtonClass(actionButtonSize)} bg-emerald-600 hover:bg-emerald-700`}
            >
              <Banknote size={expressIcon} />
              {t('webPosCash')}
            </button>
          ) : null}
          {hasQuickPay && showCard ? (
            <button
              type="button"
              disabled={expressDisabled}
              onClick={() => onExpressPay!('card')}
              className={`${expressCheckoutButtonClass(actionButtonSize)} bg-sky-600 hover:bg-sky-700`}
            >
              <CreditCard size={expressIcon} />
              {t('webPosCard')}
            </button>
          ) : null}
          {hasQuickPay && showTerminal ? (
            <button
              type="button"
              disabled={expressDisabled}
              onClick={() => onExpressPay!('terminal')}
              className={`${expressCheckoutButtonClass(actionButtonSize)} bg-violet-700 hover:bg-violet-800`}
            >
              <MonitorSmartphone size={expressIcon} />
              {t('webPosTerminal')}
            </button>
          ) : null}
        </div>
        {onOpenCheckout && !hasQuickPay ? (
          <button
            type="button"
            disabled={checkoutDisabled}
            onClick={onOpenCheckout}
            className={expressCheckoutArrowClass(actionButtonSize)}
            title={t('webPosOpenCheckout')}
          >
            <ArrowRight size={expressCheckoutArrowIconSize(actionButtonSize)} strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
