/** Decide whether WebPOS should talk to the Print Agent / Bridge. */

export type PrintTargetDecision = {
  /** True when checkout must not wait on a printer probe or toast a printer error. */
  skip: boolean;
  names: string[];
};

export function normalizePrintNames(names: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/**
 * Skip local print when nothing is configured, or when discovery already
 * finished and the till has zero live printers (stale Settings names).
 */
export function resolvePrintAttempt(opts: {
  roleTargets?: Array<{ name?: string | null } | null> | null;
  fallbackName?: string | null;
  livePrinters?: Array<{ name?: string | null } | null> | null;
  printersReady?: boolean;
  /** When the Print Agent / Bridge is known down, do not probe again. */
  agentOk?: boolean;
}): PrintTargetDecision {
  const fromRole = normalizePrintNames((opts.roleTargets || []).map((t) => t?.name));
  const fallback = String(opts.fallbackName || '').trim();
  const names = fromRole.length > 0 ? fromRole : fallback ? [fallback] : [];

  if (!names.length) return { skip: true, names: [] };

  if (opts.agentOk === false) {
    return { skip: true, names: [] };
  }

  if (opts.printersReady === true && (opts.livePrinters?.length ?? 0) === 0) {
    return { skip: true, names: [] };
  }

  return { skip: false, names };
}

export function shouldSkipAutoPrint(opts: Parameters<typeof resolvePrintAttempt>[0]): boolean {
  return resolvePrintAttempt(opts).skip;
}
