export const STOREFRONT_HEADER_OFFSET = 100;

function resolveAnchorElement(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  if (el) return el;
  if (id === 'contact') {
    return (
      document.getElementById('footer') ||
      document.querySelector('footer.hb-footer, .shop-global-footer')
    );
  }
  return null;
}

export function scrollToAnchor(hash: string, offset = STOREFRONT_HEADER_OFFSET): boolean {
  const id = hash.replace(/^#/, '').trim();
  if (!id) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }
  const el = resolveAnchorElement(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  return true;
}

/** Retry scroll until the anchor exists (async footer render). */
export function scrollToAnchorWhenReady(
  hash: string,
  opts?: { offset?: number; attempts?: number; intervalMs?: number }
) {
  const attempts = opts?.attempts ?? 12;
  const intervalMs = opts?.intervalMs ?? 100;
  let tries = 0;
  const tryScroll = () => {
    if (scrollToAnchor(hash, opts?.offset)) return;
    tries += 1;
    if (tries < attempts) window.setTimeout(tryScroll, intervalMs);
  };
  tryScroll();
}

export function handleStorefrontNavClick(
  e: React.MouseEvent<HTMLAnchorElement>,
  href: string,
  onAfterNavigate?: () => void
) {
  if (!href.startsWith('#')) return false;
  e.preventDefault();
  scrollToAnchorWhenReady(href);
  try {
    history.replaceState(null, '', href);
  } catch {
    /* ignore */
  }
  onAfterNavigate?.();
  return true;
}
