/**
 * POS / panel polls paid addons (KDS / ODS / inventory). Treat HTTP 403 as
 * "not licensed": stop the loop and never throw into checkout or settings.
 */

export function isAddonForbiddenStatus(error: unknown): boolean {
  const err = error as {
    response?: { status?: number; data?: { code?: string } };
    status?: number;
  };
  const status = err?.response?.status ?? err?.status;
  if (status === 403) return true;
  const code = String(err?.response?.data?.code || '');
  return (
    code === 'KDS_ADDON_REQUIRED' ||
    code === 'ODS_ADDON_REQUIRED' ||
    code === 'INVENTORY_ADDON_REQUIRED'
  );
}

/** Skip the request when the merchant flag is off or a prior 403 stopped the gate. */
export function shouldPollLicensedAddon(
  licensed: boolean | null | undefined,
  stopped: boolean
): boolean {
  if (stopped) return false;
  if (licensed === false) return false;
  return true;
}

/** true / false when any source is explicit; undefined if the till has not loaded the flag. */
export function readAddonLicenseFlag(
  ...flags: Array<boolean | null | undefined>
): boolean | undefined {
  if (flags.some((flag) => flag === true)) return true;
  if (flags.some((flag) => flag === false)) return false;
  return undefined;
}

export function createAddonPollGate() {
  let stopped = false;
  return {
    isStopped: () => stopped,
    stop: () => {
      stopped = true;
    },
    noteError(error: unknown): boolean {
      if (isAddonForbiddenStatus(error)) {
        stopped = true;
        return true;
      }
      return false;
    },
    reset() {
      stopped = false;
    },
  };
}
