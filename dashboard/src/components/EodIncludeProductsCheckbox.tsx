import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  readEodIncludeProductsSold,
  readEodIncludeStaffPerformance,
  writeEodIncludeProductsSold,
  writeEodIncludeStaffPerformance,
} from '@/lib/webpos-receipt';

export function useEodIncludeProductsSold() {
  const [include, setIncludeState] = useState(() => readEodIncludeProductsSold());
  const setInclude = (value: boolean) => {
    setIncludeState(value);
    writeEodIncludeProductsSold(value);
  };
  return [include, setInclude] as const;
}

export function useEodIncludeStaffPerformance() {
  const [include, setIncludeState] = useState(() => readEodIncludeStaffPerformance());
  const setInclude = (value: boolean) => {
    setIncludeState(value);
    writeEodIncludeStaffPerformance(value);
  };
  return [include, setInclude] as const;
}

export type EodPrintOptions = {
  includeProductsSold?: boolean;
  includeStaffPerformance?: boolean;
};

export function EodIncludeStaffPerformanceCheckbox({
  checked,
  onChange,
  className = '',
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{t('eodIncludeStaffPerformance')}</span>
        <span className="text-xs text-stone-500">{t('eodIncludeStaffPerformanceHint')}</span>
      </span>
    </label>
  );
}

export function EodIncludeProductsCheckbox({
  checked,
  onChange,
  className = '',
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{t('eodIncludeProductsSold')}</span>
        <span className="text-xs text-stone-500">{t('eodIncludeProductsSoldHint')}</span>
      </span>
    </label>
  );
}
