export const STOREFRONT_HEADER_OFFSET = 100;

export function scrollToAnchor(hash: string, offset = STOREFRONT_HEADER_OFFSET) {
  const id = hash.replace(/^#/, '').trim();
  if (!id) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

export function handleStorefrontNavClick(
  e: React.MouseEvent<HTMLAnchorElement>,
  href: string,
  onAfterNavigate?: () => void
) {
  if (!href.startsWith('#')) return false;
  e.preventDefault();
  scrollToAnchor(href);
  try {
    history.replaceState(null, '', href);
  } catch {
    /* ignore */
  }
  onAfterNavigate?.();
  return true;
}
