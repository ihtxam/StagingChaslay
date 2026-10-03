import { useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Option = { id: string; name: string };

type Props = {
  title: string;
  subtitle?: string;
  options: Option[];
  onClose: () => void;
  onConfirm: (productId: string) => void;
};

export default function ShopFreeGiftPickerModal({
  title,
  subtitle,
  options,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [picked, setPicked] = useState(options[0]?.id || '');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-stone-500 hover:bg-stone-100"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <p className="mb-2 text-sm font-medium text-stone-700">{t('shopChooseFreeProduct')}</p>
          <ul className="space-y-2">
            {options.map((opt) => (
              <li key={opt.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 px-3 py-3 hover:border-stone-400">
                  <input
                    type="radio"
                    name="free-gift"
                    checked={picked === opt.id}
                    onChange={() => setPicked(opt.id)}
                    className="accent-stone-900"
                  />
                  <span className="text-sm font-medium text-stone-900">{opt.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-stone-200 p-4">
          <button
            type="button"
            disabled={!picked}
            className="w-full rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => picked && onConfirm(picked)}
          >
            {t('shopAddFreeProductToOrder')}
          </button>
        </div>
      </div>
    </div>
  );
}
