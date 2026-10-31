export type AdyenCredentialSlice = {
  adyenApiKey?: string | null;
  adyenMerchantAccount?: string | null;
  adyenClientId?: string | null;
  terminalId?: string | null;
};

export type AdyenCredentialLayers = {
  terminal?: AdyenCredentialSlice | null;
  profile?: AdyenCredentialSlice | null;
  merchant?: AdyenCredentialSlice | null;
  env?: {
    apiKey?: string | null;
    merchantAccount?: string | null;
    clientId?: string | null;
  } | null;
};

/** terminal → profile → merchant → env (legacy per-terminal overrides still win at terminal layer). */
export function resolveAdyenTerminalCredentials(layers: AdyenCredentialLayers) {
  const terminal = layers.terminal || undefined;
  const profile = layers.profile || undefined;
  const merchant = layers.merchant || undefined;
  const env = layers.env || undefined;

  const apiKey =
    terminal?.adyenApiKey ||
    profile?.adyenApiKey ||
    merchant?.adyenApiKey ||
    env?.apiKey ||
    null;
  const merchantAccount =
    terminal?.adyenMerchantAccount ||
    profile?.adyenMerchantAccount ||
    merchant?.adyenMerchantAccount ||
    env?.merchantAccount ||
    null;
  const clientId =
    terminal?.adyenClientId ||
    profile?.adyenClientId ||
    merchant?.adyenClientId ||
    env?.clientId ||
    null;

  return {
    apiKey,
    merchantAccount,
    clientId,
    terminalId: terminal?.terminalId || null,
  };
}

export function terminalBelongsToProfile(
  terminalProfileId: string | null | undefined,
  scopeProfileId: string | null | undefined,
  defaultProfileId: string | null | undefined
): boolean {
  const effectiveTerminalProfile = terminalProfileId || defaultProfileId || null;
  const effectiveScope = scopeProfileId || defaultProfileId || null;
  if (!effectiveScope) return true;
  return effectiveTerminalProfile === effectiveScope;
}
