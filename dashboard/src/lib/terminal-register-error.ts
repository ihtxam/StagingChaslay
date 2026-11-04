import type { AxiosError } from 'axios';
import type { I18nParams } from '@/lib/i18n';

export type TerminalDuplicateApiBody = {
  error?: string;
  registeredToMerchant?: {
    id?: string;
    name?: string;
    slug?: string | null;
    supportCode?: string | null;
  };
};

export function terminalDuplicateDetailSuffix(
  owner: NonNullable<TerminalDuplicateApiBody['registeredToMerchant']>
): string {
  const parts = [owner.slug, owner.supportCode]
    .map((value) => (value == null ? '' : String(value).trim()))
    .filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

export function terminalRegisterErrorMessage(
  error: unknown,
  t: (key: string, params?: I18nParams) => string,
  fallbackKey: string
): string {
  const axiosErr = error as AxiosError<TerminalDuplicateApiBody> | undefined;
  const data = axiosErr?.response?.data;
  const owner = data?.registeredToMerchant;
  if (owner?.name?.trim()) {
    return t('terminalAlreadyRegisteredToMerchant', {
      name: owner.name.trim(),
      detail: terminalDuplicateDetailSuffix(owner),
    });
  }
  if (data?.error?.trim()) {
    return data.error.trim();
  }
  return t(fallbackKey);
}
